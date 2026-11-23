"use client"

import { AnimatePresence, motion } from "motion/react"
import { useMemo } from "react"
import {
  ArrowRightLeftIcon,
  BanIcon,
  CheckIcon,
  CircleCheckIcon,
  IndianRupeeIcon,
  PhoneIcon,
  ShoppingBasketIcon,
  TruckIcon,
  XIcon,
} from "lucide-react"
import { ConfirmDialog } from "@/components/kit/confirm"
import { HelpTip, NextStep } from "@/components/kit/help"
import { BinLabel, EmptyState, Field, Mono } from "@/components/kit/misc"
import { EASE } from "@/components/kit/page"
import { StatusBadge } from "@/components/kit/status-badge"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { onHand, orderTotals, shortages } from "@/lib/calc"
import { date, dateTime, inr } from "@/lib/format"
import { useInventory, useUI } from "@/lib/store"
import type { LineItem, SalesOrder } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ACTION, GLOSSARY } from "@/lib/words"
import { itemsText, qtyUnit, unitsText } from "./sale-words"
import { useSaleConfirm } from "./use-sale-actions"

const meaning = (term: string) => GLOSSARY.find((g) => g.term === term)?.meaning

/** NextStep with the buttons under the text (for banners with a list or two buttons). */
const STACKED = "sm:flex-col sm:items-stretch sm:[&>div:last-child]:justify-start sm:[&>div:last-child]:pl-12"

export function SaleSheet({ id, open, onOpenChange }: { id: string | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const order = useInventory((s) => (id ? s.salesOrders.find((o) => o.id === id) : undefined))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[580px]">
        {order ? (
          <SaleDetail order={order} onClose={() => onOpenChange(false)} />
        ) : (
          <>
            <SheetTitle className="sr-only">Sale</SheetTitle>
            <SheetDescription className="sr-only">This sale could not be found</SheetDescription>
            <EmptyState
              icon={ShoppingBasketIcon}
              title="Sale not found"
              description="It may have been removed when the sample data was reset. Close this and pick another sale."
              className="my-auto"
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function SaleDetail({ order, onClose }: { order: SalesOrder; onClose: () => void }) {
  const customers = useInventory((s) => s.customers)
  const godowns = useInventory((s) => s.godowns)
  const items = useInventory((s) => s.items)
  const suppliers = useInventory((s) => s.suppliers)
  const stock = useInventory((s) => s.stock)
  const cancelledAt = useInventory((s) =>
    order.status === "cancelled" ? s.activities.find((a) => a.kind === "cancelled" && a.target?.id === order.id)?.at : undefined,
  )
  const openPanel = useUI((s) => s.openPanel)
  const openComposer = useUI((s) => s.openComposer)
  const { ask, dialog } = useSaleConfirm()

  const customer = customers.find((c) => c.id === order.customerId)
  const godown = godowns.find((g) => g.id === order.godownId)
  const godownName = godown?.name ?? "the godown"
  const customerName = customer?.name ?? "The customer"
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const totals = orderTotals(order.lines)
  const qtyText = unitsText(order.lines, itemById)

  const isOpen = order.status === "draft" || order.status === "confirmed"
  const short = useMemo(
    () => (isOpen ? shortages(stock, order.godownId, order.lines) : []),
    [isOpen, stock, order.godownId, order.lines],
  )

  // "Order more": one prefilled supplier order per supplier of the short items
  const reorders = useMemo(() => {
    const bySupplier = new Map<string, LineItem[]>()
    for (const s of short) {
      const it = itemById.get(s.itemId)
      if (!it) continue
      const list = bySupplier.get(it.supplierId) ?? []
      list.push({ itemId: s.itemId, qty: Math.ceil((s.need - s.have) / 10) * 10, rate: it.cost })
      bySupplier.set(it.supplierId, list)
    }
    return [...bySupplier.entries()].map(([supplierId, lines]) => ({
      supplierId,
      lines,
      name: (suppliers.find((s) => s.id === supplierId)?.name ?? "supplier").split(" ").slice(0, 2).join(" "),
    }))
  }, [short, itemById, suppliers])

  // "Move stock here": the other godown that can cover the most of what is missing
  const moveFrom = useMemo(() => {
    let best: { godownId: string; name: string; lines: { itemId: string; qty: number }[]; covered: number } | null = null
    for (const g of godowns) {
      if (g.id === order.godownId) continue
      const lines = short
        .map((s) => ({ itemId: s.itemId, qty: Math.min(onHand(stock, s.itemId, g.id), s.need - s.have) }))
        .filter((l) => l.qty > 0)
      const covered = lines.reduce((sum, l) => sum + l.qty, 0)
      if (covered > 0 && (!best || covered > best.covered)) best = { godownId: g.id, name: g.name, lines, covered }
    }
    return best
  }, [godowns, short, stock, order.godownId])

  const orderMore = (r: (typeof reorders)[number]) =>
    openComposer({ type: "purchase", defaults: { supplierId: r.supplierId, godownId: order.godownId, lines: r.lines } })

  const shortageActions = (
    <>
      {reorders.map((r) => (
        <Button key={r.supplierId} onClick={() => orderMore(r)}>
          <TruckIcon strokeWidth={1.75} />
          {reorders.length > 1 ? `${ACTION.reorder} from ${r.name}` : ACTION.reorder}
        </Button>
      ))}
      {moveFrom ? (
        <Button
          variant="outline"
          onClick={() =>
            openComposer({
              type: "transfer",
              defaults: { fromGodownId: moveFrom.godownId, toGodownId: order.godownId, lines: moveFrom.lines },
            })
          }
        >
          <ArrowRightLeftIcon strokeWidth={1.75} />
          Move stock from {moveFrom.name}
        </Button>
      ) : null}
    </>
  )

  const shortageList = (
    <ul className="mt-1.5 flex flex-col gap-1">
      {short.map((s) => {
        const it = itemById.get(s.itemId)
        return (
          <li key={s.itemId} className="tabular">
            <span className="font-medium text-foreground">{it?.name ?? "Item"}</span>: you need {qtyUnit(s.need, it?.unit)}, only{" "}
            {qtyUnit(s.have, it?.unit)} in {godownName}.
          </li>
        )
      })}
    </ul>
  )

  /* ---------------- what happens next ---------------- */
  let next: React.ReactNode
  let nextKey: string
  if (order.status === "draft") {
    nextKey = "draft"
    next = (
      <NextStep
        tone="info"
        title="This sale is a draft"
        action={
          <Button onClick={() => ask("confirm", order)}>
            <CircleCheckIcon strokeWidth={1.75} />
            {ACTION.confirmSale}
          </Button>
        }
      >
        Confirm it when the customer agrees. Nothing leaves stock yet.
      </NextStep>
    )
  } else if (order.status === "confirmed" && short.length) {
    nextKey = "short"
    next = (
      <NextStep tone="warning" title={`Not enough stock in ${godownName} to ship`} action={shortageActions} className={STACKED}>
        {shortageList}
        <p className="mt-1.5">Order more from the supplier{moveFrom ? ", or move stock here from another godown" : ""}. You can ship once the stock is in.</p>
      </NextStep>
    )
  } else if (order.status === "confirmed") {
    nextKey = "ready"
    next = (
      <NextStep
        tone="info"
        title={`Ready to ship from ${godownName}`}
        action={
          <Button onClick={() => ask("ship", order)}>
            <TruckIcon strokeWidth={1.75} />
            {ACTION.shipSale}
          </Button>
        }
      >
        When the items leave, press Ship order. Stock will go down by {qtyText}.
      </NextStep>
    )
  } else if (order.status === "shipped" && order.payment !== "paid") {
    const late = order.payment === "overdue"
    nextKey = late ? "late" : "unpaid"
    next = (
      <NextStep
        tone={late ? "negative" : "info"}
        title={late ? "Payment is late" : "Shipped. Waiting for payment"}
        className={late && customer?.phone ? STACKED : undefined}
        action={
          <>
            <Button onClick={() => ask("markPaid", order)}>
              <IndianRupeeIcon strokeWidth={1.75} />
              {ACTION.markPaid}
            </Button>
            {late && customer?.phone ? (
              <Button variant="outline" asChild>
                <a href={`tel:${customer.phone.replace(/\s/g, "")}`}>
                  <PhoneIcon strokeWidth={1.75} />
                  Call customer
                </a>
              </Button>
            ) : null}
          </>
        }
      >
        {late
          ? `${customerName} had to pay ${inr(totals.total)} by ${date(order.dueDate)}. When the money comes in, press Mark as paid.`
          : `${customerName} has to pay ${inr(totals.total)} by ${date(order.dueDate)}. When the money comes in, press Mark as paid.`}
      </NextStep>
    )
  } else if (order.status === "shipped") {
    nextKey = "done"
    next = (
      <NextStep tone="positive" title="All done">
        This order was shipped{order.shippedAt ? ` on ${dateTime(order.shippedAt)}` : ""} and paid
        {order.paidAt ? ` on ${dateTime(order.paidAt)}` : ""}. Nothing more to do.
      </NextStep>
    )
  } else {
    nextKey = "cancelled"
    next = (
      <div className="flex gap-3 rounded-xl border border-border bg-raised/60 p-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-card text-muted-foreground ring-1 ring-border">
          <BanIcon className="size-[18px]" strokeWidth={2} />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5 pt-1">
          <p className="text-[15px] leading-snug font-semibold text-foreground">This order was cancelled</p>
          <p className="text-sm leading-relaxed text-fg-secondary">Nothing was shipped, so stock did not change. There is nothing more to do.</p>
        </div>
      </div>
    )
  }

  /* ---------------- history, in sentences ---------------- */
  type Step = { key: string; text: string; at?: string; state: "done" | "todo" | "bad" }
  const history: Step[] = [{ key: "created", text: "Sale created.", at: order.date, state: "done" }]
  if (order.status === "cancelled") {
    history.push({ key: "cancelled", text: "Order cancelled. Stock did not change.", at: cancelledAt, state: "bad" })
  } else {
    const confirmed = order.status === "confirmed" || order.status === "shipped"
    history.push({
      key: "confirmed",
      text: confirmed ? "Confirmed. The customer agreed to the order." : "Not confirmed yet.",
      state: confirmed ? "done" : "todo",
    })
    history.push(
      order.status === "shipped"
        ? { key: "shipped", text: `Shipped from ${godownName}. Stock went down by ${qtyText}.`, at: order.shippedAt, state: "done" }
        : { key: "shipped", text: "Not shipped yet. Stock goes down when it ships.", state: "todo" },
    )
    history.push(
      order.payment === "paid"
        ? { key: "paid", text: `Paid ${inr(totals.total)}.`, at: order.paidAt, state: "done" }
        : order.payment === "overdue"
          ? { key: "paid", text: `Payment is late. It was due on ${date(order.dueDate)}.`, state: "bad" }
          : { key: "paid", text: `Not paid yet. Due by ${date(order.dueDate)}.`, state: "todo" },
    )
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-col gap-2 border-b border-border px-6 pt-5 pb-4">
        <Mono className="pr-10">
          Sale {order.number} · {date(order.date)}
        </Mono>
        <SheetTitle className="text-xl leading-tight font-semibold">{customer?.name ?? "Unknown customer"}</SheetTitle>
        <SheetDescription className="text-[15px] text-fg-secondary tabular">
          {itemsText(order.lines, itemById)} · {inr(totals.total)} with GST
        </SheetDescription>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <BadgeSwap status={order.status} />
          {order.status !== "cancelled" ? <BadgeSwap status={order.payment} /> : null}
        </div>
      </div>

      {/* Body */}
      <div className="scroll-quiet flex flex-1 flex-col gap-7 overflow-y-auto px-6 py-5">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={nextKey}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.25, ease: EASE }}
          >
            {next}
          </motion.div>
        </AnimatePresence>

        {order.status === "draft" && short.length ? (
          <NextStep tone="warning" title={`Not enough stock in ${godownName} to ship this yet`} action={shortageActions} className={STACKED}>
            {shortageList}
            <p className="mt-1.5">You can still confirm the order now and ship it when the stock is in.</p>
          </NextStep>
        ) : null}

        {/* Customer */}
        <Section title="Customer">
          <div className="flex flex-col gap-4 rounded-xl border border-border p-4">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-base font-semibold text-foreground">{customer?.name ?? "Unknown customer"}</span>
              {customer?.city ? <span className="text-sm text-muted-foreground">{customer.city}</span> : null}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Contact person">{customer?.contact ?? "—"}</Field>
              <Field label="Phone">
                {customer?.phone ? (
                  <a href={`tel:${customer.phone.replace(/\s/g, "")}`} className="text-primary-ink tabular underline-offset-4 hover:underline">
                    {customer.phone}
                  </a>
                ) : (
                  "—"
                )}
              </Field>
              <Field label="GST number">
                <span className="tabular">{customer?.gstin ?? "—"}</span>
              </Field>
            </div>
          </div>
        </Section>

        {/* Items */}
        <Section
          title="Items"
          aside={
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              From {godownName} godown
              <HelpTip label="What is a godown?">{meaning("Godown")}</HelpTip>
            </span>
          }
        >
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="hidden grid-cols-[minmax(0,1fr)_84px_80px_96px] gap-3 border-b border-border bg-raised/70 px-4 py-2.5 text-[13px] font-medium text-fg-secondary sm:grid">
              <span>Item</span>
              <span className="text-right">Quantity</span>
              <span className="text-right">Price</span>
              <span className="text-right">Total</span>
            </div>
            {order.lines.map((l, i) => {
              const it = itemById.get(l.itemId)
              return (
                <div
                  key={`${l.itemId}-${i}`}
                  className={cn(
                    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_84px_80px_96px]",
                    i > 0 && "border-t border-border",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {it ? <BinLabel category={it.category} size="sm" /> : null}
                    <div className="flex min-w-0 flex-col">
                      <button
                        type="button"
                        onClick={() => openPanel({ type: "item", id: l.itemId })}
                        className="truncate text-left text-[15px] text-foreground underline-offset-4 transition-colors hover:text-primary-ink hover:underline focus-visible:underline focus-visible:outline-none"
                      >
                        {it?.name ?? "Unknown item"}
                      </button>
                      <span className="text-[13px] text-muted-foreground tabular sm:hidden">
                        {qtyUnit(l.qty, it?.unit)} × {inr(l.rate)}
                      </span>
                    </div>
                  </div>
                  <span className="hidden text-right text-[15px] text-foreground tabular sm:block">{qtyUnit(l.qty, it?.unit)}</span>
                  <span className="hidden text-right text-[15px] text-fg-secondary tabular sm:block">{inr(l.rate)}</span>
                  <span className="text-right text-[15px] font-medium text-foreground tabular">{inr(l.qty * l.rate)}</span>
                </div>
              )
            })}
          </div>
        </Section>

        {/* Totals */}
        <Section title="Bill amount">
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-raised/40 p-4">
            <div className="flex justify-between text-[15px] text-fg-secondary">
              <span>Subtotal (before GST)</span>
              <span className="tabular">{inr(totals.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-[15px] text-fg-secondary">
              <span className="inline-flex items-center gap-1">
                GST 18%
                <HelpTip label="What is GST?">{meaning("GST")}</HelpTip>
              </span>
              <span className="tabular">{inr(totals.tax)}</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between border-t border-border pt-3">
              <span className="text-base font-semibold text-foreground">Total</span>
              <span className="text-xl font-semibold text-foreground tabular">{inr(totals.total)}</span>
            </div>
          </div>
        </Section>

        {/* Payment */}
        <Section title="Payment">
          {order.status === "cancelled" ? (
            <p className="text-[15px] text-fg-secondary">No payment needed. This order was cancelled.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 rounded-xl border border-border p-4 sm:grid-cols-3">
              <Field label="Status">
                <BadgeSwap status={order.payment} />
              </Field>
              <Field label="Pay by">
                <span className={cn("tabular", order.payment === "overdue" && "font-medium text-negative")}>{date(order.dueDate)}</span>
              </Field>
              <Field label={order.payment === "paid" ? "Paid on" : "Amount to collect"}>
                <span className="tabular">{order.payment === "paid" && order.paidAt ? dateTime(order.paidAt) : inr(totals.total)}</span>
              </Field>
            </div>
          )}
        </Section>

        {order.note ? (
          <Section title="Note">
            <p className="rounded-xl border border-border bg-raised/40 px-4 py-3 text-[15px] text-fg-secondary">{order.note}</p>
          </Section>
        ) : null}

        {/* History */}
        <Section title="History">
          <ol className="flex flex-col">
            {history.map((s, i) => (
              <li key={s.key} className="relative flex gap-3 pb-5 last:pb-0">
                {i < history.length - 1 ? (
                  <span aria-hidden className="absolute top-7 bottom-1 left-[11px] w-0.5 rounded-full bg-border" />
                ) : null}
                <span
                  aria-hidden
                  className={cn(
                    "relative grid size-6 shrink-0 place-items-center rounded-full transition-colors duration-300",
                    s.state === "done" && "bg-positive-soft text-positive",
                    s.state === "bad" && "bg-negative-soft text-negative",
                    s.state === "todo" && "border-2 border-border bg-card",
                  )}
                >
                  {s.state === "done" ? <CheckIcon className="size-3.5" strokeWidth={2.5} /> : null}
                  {s.state === "bad" ? <XIcon className="size-3.5" strokeWidth={2.5} /> : null}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
                  <span className={cn("text-[15px] leading-snug", s.state === "todo" ? "text-muted-foreground" : "text-foreground")}>{s.text}</span>
                  {s.at ? <span className="text-[13px] text-muted-foreground tabular">{dateTime(s.at)}</span> : null}
                </div>
              </li>
            ))}
          </ol>
        </Section>
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border px-6 py-4">
        {isOpen ? (
          <Button variant="destructive" onClick={() => ask("cancel", order)}>
            <BanIcon strokeWidth={1.75} />
            {ACTION.cancelSale}
          </Button>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {order.status === "draft" ? (
            short.length ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0} className="inline-flex rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                    <Button variant="outline" disabled>
                      Ship now
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">Not enough stock in {godownName}</TooltipContent>
              </Tooltip>
            ) : (
              <Button variant="outline" onClick={() => ask("ship", order)}>
                <TruckIcon strokeWidth={1.75} />
                Ship now
              </Button>
            )
          ) : null}
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      <ConfirmDialog {...dialog} />
    </>
  )
}

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  )
}

/** Status badge that crossfades when the status changes in place. */
function BadgeSwap({ status }: { status: SalesOrder["status"] | SalesOrder["payment"] }) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={status}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.25, ease: EASE }}
        className="inline-flex"
      >
        <StatusBadge status={status} />
      </motion.span>
    </AnimatePresence>
  )
}
