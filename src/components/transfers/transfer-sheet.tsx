"use client"

import { useMemo } from "react"
import { ArrowDownIcon, ArrowRightIcon, ArrowRightLeftIcon, ArrowUpIcon, RotateCcwIcon, WarehouseIcon } from "lucide-react"
import { HelpTip, NextStep } from "@/components/kit/help"
import { BinLabel, EmptyState, Mono } from "@/components/kit/misc"
import { TONE_PILL } from "@/components/kit/status-badge"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { onHand } from "@/lib/calc"
import { date, dateTime, time } from "@/lib/format"
import { useInventory, useUI } from "@/lib/store"
import { cn } from "@/lib/utils"
import { itemsText, linesQtyText, meaningOf, qtyText } from "@/components/purchases/lib"

export function TransferSheet({
  id,
  open,
  onOpenChange,
}: {
  id: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const tr = useInventory((s) => (id ? s.transfers.find((t) => t.id === id) : undefined))
  const godowns = useInventory((s) => s.godowns)
  const items = useInventory((s) => s.items)
  const stock = useInventory((s) => s.stock)
  const openPanel = useUI((s) => s.openPanel)
  const openComposer = useUI((s) => s.openComposer)

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])

  if (!tr) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[600px]">
          <div className="border-b border-border px-6 pt-5 pb-4 pr-12">
            <SheetTitle className="text-xl">This stock move could not be found</SheetTitle>
            <SheetDescription className="text-[15px]">It may have been removed when the sample data was reset.</SheetDescription>
          </div>
          <EmptyState
            icon={ArrowRightLeftIcon}
            title="Nothing to show"
            description="Close this and pick another move from the Move stock list."
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

  const from = godowns.find((g) => g.id === tr.fromGodownId)
  const to = godowns.find((g) => g.id === tr.toGodownId)
  const fromName = from?.name ?? "the first godown"
  const toName = to?.name ?? "the other godown"
  const qty = linesQtyText(tr.lines, itemById)

  const repeat = () =>
    openComposer({
      type: "transfer",
      defaults: { fromGodownId: tr.fromGodownId, toGodownId: tr.toGodownId, lines: tr.lines },
    })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[600px]">
        {/* Header */}
        <div className="flex flex-col gap-2 border-b border-border px-6 pt-5 pb-4 pr-12">
          <Mono>Stock move {tr.number}</Mono>
          <SheetTitle className="flex flex-wrap items-center gap-x-2 text-xl leading-snug font-semibold">
            {fromName}
            <ArrowRightIcon aria-label="to" className="size-5 text-muted-foreground" strokeWidth={2} />
            {toName}
          </SheetTitle>
          <SheetDescription className="text-[15px] text-fg-secondary">
            {itemsText(tr.lines.length)} · {qty} · {dateTime(tr.date)}
          </SheetDescription>
        </div>

        {/* Body */}
        <div className="scroll-quiet flex flex-1 flex-col gap-7 overflow-y-auto px-6 py-5">
          <NextStep
            tone="positive"
            title={`Done. ${qty} moved to ${toName}`}
            action={
              <Button variant="outline" onClick={repeat}>
                <RotateCcwIcon strokeWidth={1.75} />
                Move the same again
              </Button>
            }
          >
            The items left {fromName} and were added to {toName} on {date(tr.date)} at {time(tr.date)}. The total stock stayed the
            same; it just changed place.
          </NextStep>

          {/* From and to */}
          <Section title="From and to" help={<HelpTip label="What is a godown?">{meaningOf("Godown")}</HelpTip>}>
            <div className="grid items-stretch gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
              <GodownCard label="From" name={fromName} place={from ? `${from.city} · ${from.code}` : undefined} direction="down" />
              <span className="hidden place-items-center text-muted-foreground sm:grid" aria-hidden>
                <ArrowRightIcon className="size-5" strokeWidth={2} />
              </span>
              <GodownCard label="To" name={toName} place={to ? `${to.city} · ${to.code}` : undefined} direction="up" />
            </div>
          </Section>

          {/* Items */}
          <Section
            title={`Items moved (${tr.lines.length})`}
            aside={<span className="text-sm text-muted-foreground tabular">{qty} in all</span>}
          >
            <ul className="overflow-hidden rounded-xl border border-border">
              {tr.lines.map((l) => {
                const item = itemById.get(l.itemId)
                if (!item) return null
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
                      </div>
                      <span className="shrink-0 pt-0.5 text-[15px] font-semibold text-foreground tabular">{qtyText(l.qty, item.unit)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-raised/60 px-3 py-2 text-[13px] text-fg-secondary sm:ml-[52px]">
                      <span className="text-muted-foreground">In stock now:</span>
                      <span className="tabular">
                        {fromName} <span className="font-medium text-foreground">{qtyText(onHand(stock, item.id, tr.fromGodownId), item.unit)}</span>
                      </span>
                      <span className="tabular">
                        {toName} <span className="font-medium text-foreground">{qtyText(onHand(stock, item.id, tr.toGodownId), item.unit)}</span>
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </Section>

          {tr.note ? (
            <Section title="Note">
              <p className="rounded-xl bg-raised/60 px-4 py-3 text-[15px] leading-relaxed text-fg-secondary">{tr.note}</p>
            </Section>
          ) : null}

          {/* History */}
          <Section title="History">
            <ol className="flex flex-col">
              <li className="flex gap-3">
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", TONE_PILL.positive)}>
                  <ArrowRightLeftIcon className="size-4" strokeWidth={1.75} />
                </span>
                <div className="flex min-w-0 flex-col gap-0.5 pt-1.5">
                  <p className="text-[15px] leading-snug font-medium text-foreground">
                    Stock moved from {fromName} to {toName}
                  </p>
                  <p className="text-sm text-fg-secondary">
                    {qty} left {fromName} and reached {toName}. Total stock did not change.
                  </p>
                  <p className="text-[13px] text-muted-foreground tabular">{dateTime(tr.date)}</p>
                </div>
              </li>
            </ol>
          </Section>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-6 py-4">
          <span className="mr-auto text-sm text-muted-foreground">Done. Nothing more to do.</span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Section({
  title,
  help,
  aside,
  children,
}: {
  title: string
  help?: React.ReactNode
  aside?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="inline-flex items-center gap-1.5 text-base font-semibold text-foreground">
          {title}
          {help}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  )
}

function GodownCard({
  label,
  name,
  place,
  direction,
}: {
  label: string
  name: string
  place?: string
  direction: "up" | "down"
}) {
  const Arrow = direction === "up" ? ArrowUpIcon : ArrowDownIcon
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3.5">
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", TONE_PILL.neutral)}>
        <WarehouseIcon className="size-5" strokeWidth={1.75} />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[13px] text-muted-foreground">{label}</span>
        <span className="truncate text-[15px] font-medium text-foreground">{name} godown</span>
        {place ? <span className="truncate text-[13px] text-muted-foreground">{place}</span> : null}
        <span className={cn("mt-1 inline-flex items-center gap-1 text-[13px] font-medium", direction === "up" ? "text-positive" : "text-negative")}>
          <Arrow className="size-3.5" strokeWidth={2.25} />
          {direction === "up" ? "Stock went up here" : "Stock went down here"}
        </span>
      </div>
    </div>
  )
}
