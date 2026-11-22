"use client"

import { useMemo } from "react"
import { ArrowLeftRightIcon, ArrowRightIcon } from "lucide-react"
import { BinLabel, EmptyState, Field, Mono } from "@/components/kit/misc"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { onHand } from "@/lib/calc"
import { dateTime, num } from "@/lib/format"
import { useInventory, useUI } from "@/lib/store"

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
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[560px]">
          <div className="border-b border-border px-6 pt-5 pb-4">
            <SheetTitle>Transfer not found</SheetTitle>
            <SheetDescription>It may have been removed when the sample data was reset</SheetDescription>
          </div>
          <EmptyState icon={ArrowLeftRightIcon} title="Nothing to show" description="Pick another transfer from the list" />
        </SheetContent>
      </Sheet>
    )
  }

  const from = godowns.find((g) => g.id === tr.fromGodownId)
  const to = godowns.find((g) => g.id === tr.toGodownId)
  const units = tr.lines.reduce((s, l) => s + l.qty, 0)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[560px]">
        <div className="flex flex-col gap-2 border-b border-border px-6 pt-5 pb-4 pr-12">
          <Mono className="text-fg-secondary">{tr.number}</Mono>
          <SheetTitle className="flex items-center gap-2 text-lg">
            {from?.name}
            <ArrowRightIcon className="size-4 text-muted-foreground" strokeWidth={1.5} />
            {to?.name}
          </SheetTitle>
          <SheetDescription>
            {num(units)} units across {tr.lines.length} {tr.lines.length === 1 ? "item" : "items"} · {dateTime(tr.date)}
          </SheetDescription>
        </div>

        <div className="scroll-quiet flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <Field label="From">
              {from?.name} <Mono className="ml-1">{from?.code}</Mono>
            </Field>
            <Field label="To">
              {to?.name} <Mono className="ml-1">{to?.code}</Mono>
            </Field>
            <Field label="Moved">{dateTime(tr.date)}</Field>
            <Field label="Units">
              <span className="font-mono tabular">{num(units)}</span>
            </Field>
          </div>

          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Items</h3>
              <span className="text-xs text-muted-foreground">On hand now</span>
            </div>
            <div className="overflow-hidden rounded-xl border border-border">
              <div className="grid grid-cols-[minmax(0,1fr)_64px_128px] gap-3 border-b border-border px-4 py-2 text-xs text-muted-foreground">
                <span>Item</span>
                <span className="text-right">Moved</span>
                <span className="text-right">
                  {from?.name} · {to?.name}
                </span>
              </div>
              {tr.lines.map((l) => {
                const item = itemById.get(l.itemId)
                if (!item) return null
                return (
                  <div
                    key={l.itemId}
                    className="grid grid-cols-[minmax(0,1fr)_64px_128px] items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
                  >
                    <button
                      type="button"
                      onClick={() => openPanel({ type: "item", id: item.id })}
                      className="group flex min-w-0 items-center gap-2.5 text-left outline-none"
                    >
                      <BinLabel category={item.category} size="sm" />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-sm text-foreground underline-offset-4 group-hover:underline group-focus-visible:underline">
                          {item.name}
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground">{item.sku}</span>
                      </span>
                    </button>
                    <span className="text-right font-mono text-sm tabular">{num(l.qty)}</span>
                    <span className="text-right font-mono text-xs text-muted-foreground tabular">
                      {num(onHand(stock, item.id, tr.fromGodownId))} · {num(onHand(stock, item.id, tr.toGodownId))}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>

          {tr.note ? (
            <section className="flex flex-col gap-1">
              <h3 className="text-xs text-muted-foreground">Note</h3>
              <p className="text-sm text-fg-secondary">{tr.note}</p>
            </section>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          <Button
            variant="ghost"
            className="mr-auto text-fg-secondary"
            onClick={() =>
              openComposer({
                type: "transfer",
                defaults: { fromGodownId: tr.fromGodownId, toGodownId: tr.toGodownId, lines: tr.lines },
              })
            }
          >
            Repeat transfer
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
