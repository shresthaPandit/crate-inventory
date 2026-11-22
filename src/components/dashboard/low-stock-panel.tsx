"use client"

import { AnimatePresence, motion } from "motion/react"
import { useMemo } from "react"
import { PackageCheckIcon } from "lucide-react"
import { BinLabel, EmptyState } from "@/components/kit/misc"
import { EASE } from "@/components/kit/page"
import { Panel } from "@/components/kit/panel"
import { StockMeter } from "@/components/kit/stock-meter"
import { Button } from "@/components/ui/button"
import { incomingQty, isPurchaseOverdue, lowStockItems, suggestedReorder } from "@/lib/calc"
import { dateShort, num } from "@/lib/format"
import { useInventory, useUI } from "@/lib/store"
import { cn } from "@/lib/utils"

export function LowStockPanel({ className }: { className?: string }) {
  const stock = useInventory((s) => s.stock)
  const items = useInventory((s) => s.items)
  const purchaseOrders = useInventory((s) => s.purchaseOrders)
  const openPanel = useUI((s) => s.openPanel)
  const openComposer = useUI((s) => s.openComposer)

  const rows = useMemo(
    () =>
      lowStockItems(stock, items).map(({ item, qty }) => {
        const incoming = incomingQty(purchaseOrders, item.id)
        const nextPO = purchaseOrders
          .filter((po) => po.status === "ordered" && po.lines.some((l) => l.itemId === item.id))
          .sort((a, b) => (a.expectedDate < b.expectedDate ? -1 : 1))[0]
        const nextDue = nextPO?.expectedDate
        const late = nextPO ? isPurchaseOverdue(nextPO) : false
        return { item, qty, incoming, nextDue, late }
      }),
    [stock, items, purchaseOrders],
  )

  return (
    <Panel
      className={className}
      title="Low stock"
      description="At or below min level"
      action={<span className="font-mono text-xs text-muted-foreground tabular">{rows.length}</span>}
      bodyClassName="px-3 pb-3"
    >
      {rows.length === 0 ? (
        <EmptyState icon={PackageCheckIcon} title="Every item is above its min level" description="New alerts show here the moment a sale takes an item to its reorder point" />
      ) : (
        <ul className="scroll-quiet flex max-h-[372px] flex-col gap-0.5 overflow-y-auto">
          <AnimatePresence initial={false}>
            {rows.map(({ item, qty, incoming, nextDue, late }) => (
              <motion.li
                key={item.id}
                layout="position"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 12, transition: { duration: 0.2, ease: EASE } }}
                transition={{ duration: 0.35, ease: EASE }}
                className="group relative flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-raised/60"
              >
                <button
                  type="button"
                  aria-label={`Open ${item.name}`}
                  onClick={() => openPanel({ type: "item", id: item.id })}
                  className="absolute inset-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                />
                <BinLabel category={item.category} />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">{item.name}</span>
                    <StockMeter qty={qty} min={item.minLevel} size="sm" />
                  </div>
                  <div className="flex min-h-6 items-center justify-between gap-2">
                    <span className={cn("font-mono text-xs tabular", qty <= 0 ? "text-negative" : "text-fg-secondary")}>
                      {num(qty)} / {num(item.minLevel)} {item.unit}
                    </span>
                    {incoming > 0 ? (
                      <span className="truncate text-xs text-muted-foreground">
                        <span className="font-mono tabular">+{num(incoming)}</span> on the way
                        {nextDue && !late ? ` · due ${dateShort(nextDue)}` : ""}
                        {late ? <span className="text-negative"> · late since {dateShort(nextDue!)}</span> : null}
                      </span>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        className="relative z-10"
                        onClick={() =>
                          openComposer({
                            type: "purchase",
                            defaults: {
                              supplierId: item.supplierId,
                              godownId: "g-bho",
                              lines: [{ itemId: item.id, qty: suggestedReorder(item, qty, incoming), rate: item.cost }],
                            },
                          })
                        }
                      >
                        Reorder
                      </Button>
                    )}
                  </div>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </Panel>
  )
}
