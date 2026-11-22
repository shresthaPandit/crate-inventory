"use client"

import { AnimatePresence, motion } from "motion/react"
import { useMemo } from "react"
import { ArrowRightIcon, PhoneIcon, TruckIcon } from "lucide-react"
import { toast } from "sonner"
import { BinLabel, EmptyState, Field, Mono } from "@/components/kit/misc"
import { EASE } from "@/components/kit/page"
import { StatusBadge } from "@/components/kit/status-badge"
import { StockMeter } from "@/components/kit/stock-meter"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { onHand, orderTotals } from "@/lib/calc"
import { date, dateTime, inr, num } from "@/lib/format"
import { useInventory, useUI } from "@/lib/store"
import { cn } from "@/lib/utils"
import { expectedHint, HINT_CLASS, poBadge, receiptSummary } from "./lib"

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
  const receivePurchase = useInventory((s) => s.receivePurchase)
  const cancelPurchase = useInventory((s) => s.cancelPurchase)
  const openPanel = useUI((s) => s.openPanel)

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const supplier = po ? suppliers.find((s) => s.id === po.supplierId) : undefined
  const godown = po ? godowns.find((g) => g.id === po.godownId) : undefined

  if (!po) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[560px]">
          <div className="border-b border-border px-6 pt-5 pb-4">
            <SheetTitle>Purchase order not found</SheetTitle>
            <SheetDescription>It may have been removed when the sample data was reset</SheetDescription>
          </div>
          <EmptyState icon={TruckIcon} title="Nothing to show" description="Pick another order from the purchases list" />
        </SheetContent>
      </Sheet>
    )
  }

  const totals = orderTotals(po.lines)
  const hint = expectedHint(po)
  const pending = po.status === "ordered"
  const badge = poBadge(po)

  const receive = () => {
    const res = receivePurchase(po.id)
    if (!res.ok) return toast.error(res.error)
    toast.success(`Received ${po.number}`, { description: receiptSummary(po, items, godowns) })
  }
  const cancel = () => {
    const res = cancelPurchase(po.id)
    if (!res.ok) return toast.error(res.error)
    toast(`Cancelled ${po.number}`, { description: `${supplier?.name ?? "Supplier"} order withdrawn, stock unchanged` })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[560px]">
        {/* Header */}
        <div className="flex flex-col gap-2 border-b border-border px-6 pt-5 pb-4 pr-12">
          <div className="flex items-center gap-2">
            <Mono className="text-fg-secondary">{po.number}</Mono>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={badge}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25, ease: EASE }}
                className="inline-flex"
              >
                <StatusBadge status={badge} />
              </motion.span>
            </AnimatePresence>
          </div>
          <SheetTitle className="text-lg">{supplier?.name ?? "Supplier"}</SheetTitle>
          <SheetDescription>
            {num(totals.units)} units into {godown?.name ?? "godown"} · ordered {date(po.date)}
          </SheetDescription>
        </div>

        {/* Body */}
        <div className="scroll-quiet flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <Field label="Ordered">{date(po.date)}</Field>
            <Field label="Expected">
              <span className="tabular">{date(po.expectedDate)}</span>
              {hint ? <span className={cn("ml-2 text-xs", HINT_CLASS[hint.tone])}>{hint.text}</span> : null}
            </Field>
            <Field label="Receive into">
              {godown?.name} <Mono className="ml-1">{godown?.code}</Mono>
            </Field>
            <Field label="Received">
              {po.receivedAt ? dateTime(po.receivedAt) : <span className="text-muted-foreground">{po.status === "cancelled" ? "Cancelled" : "Not yet"}</span>}
            </Field>
          </div>

          {supplier ? (
            <div className="flex items-center gap-4 rounded-xl border border-border bg-raised/40 px-4 py-3">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm text-foreground">{supplier.contact}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {supplier.city} · {supplier.leadTimeDays} day lead time
                </span>
              </div>
              <a
                href={`tel:${supplier.phone.replace(/\s/g, "")}`}
                className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 font-mono text-xs text-fg-secondary transition-colors hover:bg-raised hover:text-foreground"
              >
                <PhoneIcon className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                {supplier.phone}
              </a>
            </div>
          ) : null}

          {/* Lines */}
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Items</h3>
              <span className="text-xs text-muted-foreground">{pending ? "On hand now and after receiving, all godowns" : `${po.lines.length} ${po.lines.length === 1 ? "line" : "lines"}`}</span>
            </div>
            <div className="overflow-hidden rounded-xl border border-border">
              <div className="grid grid-cols-[minmax(0,1fr)_56px_72px_88px] gap-3 border-b border-border px-4 py-2 text-xs text-muted-foreground">
                <span>Item</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Rate</span>
                <span className="text-right">Amount</span>
              </div>
              {po.lines.map((l) => {
                const item = itemById.get(l.itemId)
                if (!item) return null
                const now = onHand(stock, item.id)
                const after = now + l.qty
                return (
                  <div key={l.itemId} className="flex flex-col gap-2 border-b border-border px-4 py-3 last:border-b-0">
                    <div className="grid grid-cols-[minmax(0,1fr)_56px_72px_88px] items-center gap-3">
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
                      <span className="text-right font-mono text-sm text-fg-secondary tabular">{inr(l.rate)}</span>
                      <span className="text-right font-mono text-sm tabular">{inr(l.qty * l.rate)}</span>
                    </div>
                    <AnimatePresence initial={false}>
                      {pending ? (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2, ease: EASE }}
                          className="flex items-center gap-2 pl-[34px] text-xs"
                        >
                          <span className="font-mono text-muted-foreground tabular">{num(now)}</span>
                          <ArrowRightIcon className="size-3 text-muted-foreground" strokeWidth={1.5} />
                          <span className="font-mono text-foreground tabular">{num(after)}</span>
                          <span className="text-muted-foreground">
                            {item.unit} · min {num(item.minLevel)}
                          </span>
                          <StockMeter qty={after} min={item.minLevel} size="sm" className="ml-auto" />
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Totals */}
          <section className="flex flex-col gap-2 rounded-xl border border-border px-4 py-3 text-sm">
            <div className="flex justify-between text-fg-secondary">
              <span>Subtotal</span>
              <span className="font-mono tabular">{inr(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-fg-secondary">
              <span>GST 18%, input credit</span>
              <span className="font-mono tabular">{inr(totals.tax)}</span>
            </div>
            <div className="mt-1 flex justify-between border-t border-border pt-2 text-foreground">
              <span>Total</span>
              <span className="font-mono font-medium tabular">{inr(totals.total)}</span>
            </div>
          </section>

          {po.note ? (
            <section className="flex flex-col gap-1">
              <h3 className="text-xs text-muted-foreground">Note</h3>
              <p className="text-sm text-fg-secondary">{po.note}</p>
            </section>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          {pending ? (
            <>
              <Button variant="ghost" onClick={cancel} className="mr-auto text-fg-secondary">
                Cancel order
              </Button>
              <Button onClick={receive}>Mark received</Button>
            </>
          ) : (
            <>
              <span className="mr-auto text-xs text-muted-foreground">
                {po.receivedAt ? `Received ${dateTime(po.receivedAt)}` : "Cancelled, stock unchanged"}
              </span>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
