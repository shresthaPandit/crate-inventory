"use client"

import { AnimatePresence, motion } from "motion/react"
import { useMemo } from "react"
import { TruckIcon } from "lucide-react"
import { toast } from "sonner"
import { EmptyState, Mono } from "@/components/kit/misc"
import { EASE } from "@/components/kit/page"
import { Panel } from "@/components/kit/panel"
import { StatusBadge } from "@/components/kit/status-badge"
import { Button } from "@/components/ui/button"
import { isPurchaseOverdue } from "@/lib/calc"
import { dateShort, num } from "@/lib/format"
import { useInventory, useUI } from "@/lib/store"
import type { PurchaseOrder } from "@/lib/types"
import { shortName } from "./use-now"

export function ArrivingPanel({ className }: { className?: string }) {
  const purchaseOrders = useInventory((s) => s.purchaseOrders)
  const suppliers = useInventory((s) => s.suppliers)
  const godowns = useInventory((s) => s.godowns)
  const items = useInventory((s) => s.items)
  const receivePurchase = useInventory((s) => s.receivePurchase)
  const openPanel = useUI((s) => s.openPanel)

  const open = useMemo(
    () =>
      purchaseOrders
        .filter((po) => po.status === "ordered")
        .sort((a, b) => (a.expectedDate < b.expectedDate ? -1 : 1)),
    [purchaseOrders],
  )

  const receive = (po: PurchaseOrder) => {
    const res = receivePurchase(po.id)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    const godown = godowns.find((g) => g.id === po.godownId)?.name ?? "godown"
    const desc =
      po.lines.length <= 2
        ? po.lines
            .map((l) => `+${num(l.qty)} ${shortName(items.find((i) => i.id === l.itemId)?.name ?? "item")}`)
            .join(", ") + ` at ${godown}`
        : `+${num(po.lines.reduce((s, l) => s + l.qty, 0))} units across ${po.lines.length} items at ${godown}`
    toast.success(`Received ${po.number}`, { description: desc })
  }

  return (
    <Panel
      className={className}
      title="Arriving"
      description="Open purchase orders by due date"
      action={<span className="font-mono text-xs text-muted-foreground tabular">{open.length}</span>}
      bodyClassName="px-3 pb-3"
    >
      {open.length === 0 ? (
        <EmptyState icon={TruckIcon} title="Nothing on order" description="Raise a purchase order from a low-stock item" />
      ) : (
        <ul className="scroll-quiet flex max-h-[456px] flex-col gap-0.5 overflow-y-auto">
          <AnimatePresence initial={false}>
            {open.map((po) => {
              const supplier = suppliers.find((s) => s.id === po.supplierId)?.name ?? "Supplier"
              const units = po.lines.reduce((s, l) => s + l.qty, 0)
              const late = isPurchaseOverdue(po)
              return (
                <motion.li
                  key={po.id}
                  layout="position"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 12, transition: { duration: 0.2, ease: EASE } }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className="relative flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-raised/60"
                >
                  <button
                    type="button"
                    aria-label={`Open ${po.number}`}
                    onClick={() => openPanel({ type: "purchase", id: po.id })}
                    className="absolute inset-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-sm text-foreground">{supplier}</span>
                    <span className="flex items-center gap-2">
                      <Mono>{po.number}</Mono>
                      <span className="font-mono text-xs text-muted-foreground tabular">{num(units)} units</span>
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {late ? (
                      <StatusBadge status="late" label={`Late · ${dateShort(po.expectedDate)}`} />
                    ) : (
                      <span className="text-xs text-muted-foreground">due {dateShort(po.expectedDate)}</span>
                    )}
                    <Button type="button" variant="outline" size="xs" className="relative z-10" onClick={() => receive(po)}>
                      Receive
                    </Button>
                  </div>
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ul>
      )}
    </Panel>
  )
}
