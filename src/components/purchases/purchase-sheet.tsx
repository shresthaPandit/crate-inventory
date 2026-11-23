"use client"

import { useMemo } from "react"
import {
  ArrowRightIcon,
  BanIcon,
  ClipboardListIcon,
  FactoryIcon,
  PackageCheckIcon,
  PhoneIcon,
  RotateCcwIcon,
  TruckIcon,
  WarehouseIcon,
} from "lucide-react"
import { HelpTip, NextStep } from "@/components/kit/help"
import { BinLabel, EmptyState, Mono } from "@/components/kit/misc"
import { StatusBadge, TONE_PILL, type Tone } from "@/components/kit/status-badge"
import { StockMeter } from "@/components/kit/stock-meter"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { onHand, orderTotals } from "@/lib/calc"
import { date, dateTime, inr } from "@/lib/format"
import { useInventory, useNow, useUI } from "@/lib/store"
import { cn } from "@/lib/utils"
import { ACTION } from "@/lib/words"
import { daysLate, expectedHint, HINT_CLASS, itemsText, linesQtyText, meaningOf, poBadge, qtyText } from "./lib"
import { usePurchaseActions } from "./purchase-actions"

type Icon = React.ComponentType<{ className?: string; strokeWidth?: number }>

export function PurchaseSheet({
  id,
  open,
  onOpenChange,
}: {
  id: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const po = useInventory((s) => (id ? s.purchaseOrders.find((p) => p.id === id) : undefined))
  const suppliers = useInventory((s) => s.suppliers)
  const godowns = useInventory((s) => s.godowns)
  const items = useInventory((s) => s.items)
  const stock = useInventory((s) => s.stock)
  const activities = useInventory((s) => s.activities)
  const openPanel = useUI((s) => s.openPanel)
  const openComposer = useUI((s) => s.openComposer)
  const actions = usePurchaseActions({ showViewLink: false })
  const now = useNow()

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])

  if (!po) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[600px]">
          <div className="border-b border-border px-6 pt-5 pb-4 pr-12">
            <SheetTitle className="text-xl">This order could not be found</SheetTitle>
            <SheetDescription className="text-[15px]">It may have been removed when the sample data was reset.</SheetDescription>
          </div>
          <EmptyState
            icon={TruckIcon}
            title="Nothing to show"
            description="Close this and pick another order from the Purchases list."
            action={
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            }
          />
        </SheetContent>
      </Sheet>
    )
  }

  const supplier = suppliers.find((s) => s.id === po.supplierId)
  const godown = godowns.find((g) => g.id === po.godownId)
  const supplierName = supplier?.name ?? "the supplier"
  const godownName = godown?.name ?? "the godown"

  const totals = orderTotals(po.lines)
  const badge = poBadge(po, now)
  const pending = po.status === "ordered"
  const late = badge === "late"
  const lateBy = daysLate(po, now)
  const hint = expectedHint(po, now)
  const qty = linesQtyText(po.lines, itemById)
  const tel = supplier?.phone ? `tel:${supplier.phone.replace(/\s/g, "")}` : undefined
  const cancelledAt = activities.find((a) => a.kind === "cancelled" && a.target?.type === "purchase" && a.target.id === po.id)?.at

  const orderAgain = () =>
    openComposer({ type: "purchase", defaults: { supplierId: po.supplierId, godownId: po.godownId, lines: po.lines } })

  const receiveButton = (
    <Button onClick={() => actions.askReceive(po)}>
      <PackageCheckIcon strokeWidth={2} />
      {ACTION.receivePurchase}
    </Button>
  )
  const orderAgainButton = (
    <Button variant="outline" onClick={orderAgain}>
      <RotateCcwIcon strokeWidth={1.75} />
      Order the same again
    </Button>
  )

  /* What happens next, in words */
  let next: React.ReactNode
  if (pending && !late) {
    next = (
      <NextStep tone="info" title={`Waiting for ${supplierName}`} action={receiveButton}>
        Expected on {date(po.expectedDate)}
        {hint ? ` (${hint.text.toLowerCase()})` : ""}. When the goods reach {godownName}, press Goods received. Stock will go up by{" "}
        {qty}.
      </NextStep>
    )
  } else if (late) {
    next = (
      <NextStep
        tone="warning"
        title={`This order is ${lateBy} ${lateBy === 1 ? "day" : "days"} late`}
        action={
          <>
            {receiveButton}
            {tel ? (
              <Button variant="outline" asChild>
                <a href={tel}>
                  <PhoneIcon strokeWidth={1.75} />
                  Call supplier
                </a>
              </Button>
            ) : null}
          </>
        }
      >
        It was expected on {date(po.expectedDate)}.
        {supplier?.phone ? ` Call ${supplier.contact} on ${supplier.phone} to ask when it will come.` : ""} When the goods reach{" "}
        {godownName}, press Goods received. Stock will go up by {qty}.
      </NextStep>
    )
  } else if (po.status === "received") {
    next = (
      <NextStep
        tone="positive"
        title={po.receivedAt ? `Received on ${date(po.receivedAt)}` : "Goods received"}
        action={orderAgainButton}
      >
        {qty} {po.lines.length === 1 && po.lines[0].qty === 1 ? "was" : "were"} added to {godownName} godown. Nothing more to do.
      </NextStep>
    )
  } else {
    next = (
      <NextStep tone="info" className="border-border bg-raised/60" title="This order was cancelled" action={orderAgainButton}>
        Nothing was added to stock. If you still need these items, order them again.
      </NextStep>
    )
  }

  /* Story of this order, oldest first */
  const history: { icon: Icon; tone: Tone; title: string; detail?: string; when?: string; upcoming?: boolean }[] = [
    {
      icon: ClipboardListIcon,
      tone: "info",
      title: `Order placed with ${supplierName}`,
      detail: `${itemsText(po.lines.length)}, ${qty}, ${inr(totals.total)} with GST.`,
      when: dateTime(po.date),
    },
  ]
  if (po.status === "received") {
    history.push({
      icon: PackageCheckIcon,
      tone: "positive",
      title: `Goods received at ${godownName}`,
      detail: `Stock went up by ${qty}.`,
      when: po.receivedAt ? dateTime(po.receivedAt) : undefined,
    })
  } else if (po.status === "cancelled") {
    history.push({
      icon: BanIcon,
      tone: "muted",
      title: "Order cancelled",
      detail: "Stock did not change.",
      when: cancelledAt ? dateTime(cancelledAt) : undefined,
    })
  } else {
    history.push({
      icon: TruckIcon,
      tone: late ? "negative" : "muted",
      title: late ? `Was expected at ${godownName}` : `Expected at ${godownName}`,
      detail: late ? `${lateBy} ${lateBy === 1 ? "day" : "days"} late. Not received yet.` : "Press Goods received when it arrives.",
      when: date(po.expectedDate),
      upcoming: true,
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[600px]">
        {/* Header */}
        <div className="flex flex-col gap-2 border-b border-border px-6 pt-5 pb-4 pr-12">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={badge} />
            <Mono>Supplier order {po.number}</Mono>
          </div>
          <SheetTitle className="text-xl leading-snug font-semibold">{supplierName}</SheetTitle>
          <SheetDescription className="text-[15px] text-fg-secondary">
            {itemsText(po.lines.length)} · {qty} · to {godownName}
          </SheetDescription>
        </div>

        {/* Body */}
        <div className="scroll-quiet flex flex-1 flex-col gap-7 overflow-y-auto px-6 py-5">
          {next}

          {/* Supplier */}
          <Section title="Supplier">
            <InfoCard icon={FactoryIcon}>
              <span className="truncate text-[15px] font-medium text-foreground">{supplierName}</span>
              {supplier ? (
                <>
                  <span className="text-sm text-fg-secondary">
                    {supplier.contact} · {supplier.city}
                  </span>
                  <span className="text-[13px] text-muted-foreground">Usually delivers in {supplier.leadTimeDays} days</span>
                </>
              ) : null}
              {tel ? (
                <a
                  href={tel}
                  className="mt-1 inline-flex w-fit items-center gap-2 rounded-lg text-[15px] font-medium text-primary-ink underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <PhoneIcon className="size-4" strokeWidth={1.75} />
                  {supplier?.phone}
                </a>
              ) : null}
            </InfoCard>
          </Section>

          {/* Deliver to */}
          <Section title="Deliver to" help={<HelpTip label="What is a godown?">{meaningOf("Godown")}</HelpTip>}>
            <InfoCard icon={WarehouseIcon}>
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[15px] font-medium text-foreground">{godownName} godown</span>
                {godown ? <Mono>{godown.code}</Mono> : null}
              </span>
              {godown ? (
                <span className="text-sm text-fg-secondary">
                  {godown.city} · looked after by {godown.manager}
                </span>
              ) : null}
            </InfoCard>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-1">
              <DateRow label="Ordered on" value={date(po.date)} />
              {po.status === "received" ? (
                <DateRow label="Received on" value={po.receivedAt ? date(po.receivedAt) : "—"} tone="text-positive" />
              ) : (
                <DateRow
                  label={po.status === "cancelled" ? "Was expected on" : "Expected on"}
                  value={date(po.expectedDate)}
                  extra={hint?.text}
                  tone={hint ? HINT_CLASS[hint.tone] : undefined}
                />
              )}
            </dl>
          </Section>

          {/* Items */}
          <Section
            title={`Items (${po.lines.length})`}
            aside={<span className="text-sm text-muted-foreground tabular">{qty} in all</span>}
            description={
              pending
                ? "The bar shows stock in all godowns after these goods arrive. Green means enough, amber means running low."
                : undefined
            }
          >
            <ul className="overflow-hidden rounded-xl border border-border">
              {po.lines.map((l) => {
                const item = itemById.get(l.itemId)
                if (!item) return null
                const have = onHand(stock, item.id)
                const after = have + l.qty
                return (
                  <li key={l.itemId} className="flex flex-col gap-2.5 border-b border-border px-4 py-3.5 last:border-b-0">
                    <div className="flex items-start gap-3">
                      <BinLabel category={item.category} size="md" />
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => openPanel({ type: "item", id: item.id })}
                          className="w-fit max-w-full truncate text-left text-[15px] font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:underline"
                        >
                          {item.name}
                        </button>
                        <span className="text-[13px] text-muted-foreground">Item code {item.sku}</span>
                        <span className="text-sm text-fg-secondary tabular">
                          {qtyText(l.qty, item.unit)} × {inr(l.rate)}
                        </span>
                      </div>
                      <span className="shrink-0 pt-0.5 text-[15px] font-semibold text-foreground tabular">{inr(l.qty * l.rate)}</span>
                    </div>
                    {pending ? (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg bg-raised/60 px-3 py-2 text-[13px] text-fg-secondary sm:ml-[52px]">
                        <span className="tabular">
                          In stock now <span className="font-medium text-foreground">{qtyText(have, item.unit)}</span>
                        </span>
                        <ArrowRightIcon className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
                        <span className="tabular">
                          after <span className="font-medium text-foreground">{qtyText(after, item.unit)}</span>
                        </span>
                        <StockMeter qty={after} min={item.minLevel} size="sm" className="ml-auto" />
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </Section>

          {/* Totals */}
          <Section title="Money">
            <div className="flex flex-col gap-2.5 rounded-xl border border-border px-4 py-3.5 text-[15px]">
              <div className="flex justify-between gap-4 text-fg-secondary">
                <span>Items total</span>
                <span className="tabular">{inr(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between gap-4 text-fg-secondary">
                <span className="inline-flex items-center gap-1.5">
                  GST 18%
                  <HelpTip label="What is GST?">{meaningOf("GST")}</HelpTip>
                </span>
                <span className="tabular">{inr(totals.tax)}</span>
              </div>
              <div className="mt-0.5 flex items-baseline justify-between gap-4 border-t border-border pt-3 text-foreground">
                <span className="font-semibold">Total to pay</span>
                <span className="text-lg font-semibold tabular">{inr(totals.total)}</span>
              </div>
            </div>
          </Section>

          {po.note ? (
            <Section title="Note">
              <p className="rounded-xl bg-raised/60 px-4 py-3 text-[15px] leading-relaxed text-fg-secondary">{po.note}</p>
            </Section>
          ) : null}

          {/* History */}
          <Section title="History">
            <ol className="flex flex-col">
              {history.map((h, i) => (
                <li key={i} className="relative flex gap-3 pb-5 last:pb-0">
                  {i < history.length - 1 ? (
                    <span aria-hidden className="absolute top-9 bottom-1 left-[17px] w-px bg-border" />
                  ) : null}
                  <span
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-full",
                      h.upcoming ? "border border-dashed border-border bg-card text-muted-foreground" : TONE_PILL[h.tone],
                    )}
                  >
                    <h.icon className="size-4" strokeWidth={1.75} />
                  </span>
                  <div className="flex min-w-0 flex-col gap-0.5 pt-1.5">
                    <p className="text-[15px] leading-snug font-medium text-foreground">{h.title}</p>
                    {h.detail ? (
                      <p className={cn("text-sm text-fg-secondary", h.upcoming && h.tone === "negative" && "text-negative")}>{h.detail}</p>
                    ) : null}
                    {h.when ? <p className="text-[13px] text-muted-foreground tabular">{h.when}</p> : null}
                  </div>
                </li>
              ))}
            </ol>
          </Section>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-6 py-4">
          {pending ? (
            <Button variant="ghost" onClick={() => actions.askCancel(po)} className="mr-auto text-negative hover:bg-negative-soft hover:text-negative">
              <BanIcon strokeWidth={1.75} />
              {ACTION.cancelPurchase}
            </Button>
          ) : (
            <span className="mr-auto text-sm text-muted-foreground">
              {po.status === "received" ? "Done. The goods are in stock." : "Cancelled. Stock did not change."}
            </span>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>

        {actions.dialog}
      </SheetContent>
    </Sheet>
  )
}

function Section({
  title,
  help,
  aside,
  description,
  children,
}: {
  title: string
  help?: React.ReactNode
  aside?: React.ReactNode
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <h3 className="inline-flex items-center gap-1.5 text-base font-semibold text-foreground">
            {title}
            {help}
          </h3>
          {aside}
        </div>
        {description ? <p className="text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

function InfoCard({ icon: IconComp, children }: { icon: Icon; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3.5">
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", TONE_PILL.neutral)}>
        <IconComp className="size-5" strokeWidth={1.75} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">{children}</div>
    </div>
  )
}

function DateRow({ label, value, extra, tone }: { label: string; value: string; extra?: string; tone?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="flex flex-col text-[15px] text-foreground">
        <span className={cn("tabular", !extra && tone)}>{value}</span>
        {extra ? <span className={cn("text-[13px]", tone)}>{extra}</span> : null}
      </dd>
    </div>
  )
}

