"use client"

import { AnimatePresence, motion } from "motion/react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { ArrowRightIcon, PackageCheckIcon, TruckIcon } from "lucide-react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/kit/confirm"
import { EmptyState } from "@/components/kit/misc"
import { EASE } from "@/components/kit/page"
import { Panel } from "@/components/kit/panel"
import { StatusBadge } from "@/components/kit/status-badge"
import { Button } from "@/components/ui/button"
import { isPurchaseOverdue } from "@/lib/calc"
import { useInventory, useNow, useUI } from "@/lib/store"
import type { Item, PurchaseOrder } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ACTION } from "@/lib/words"
import { arrivalText, count, qty } from "./plain"
import { shortName } from "./use-now"

/** How many open supplier orders to list here; the rest are on the Purchases page. */
const MAX_SHOWN = 5

/** "200 pcs of LED bulb 9W" · "LED bulb 9W and 2 more items" */
function whatsComing(po: PurchaseOrder, itemById: Map<string, Item>) {
  const first = itemById.get(po.lines[0]?.itemId ?? "")
  if (!first) return count(po.lines.length, "item")
  if (po.lines.length === 1) return `${qty(po.lines[0].qty, first.unit)} of ${shortName(first.name)}`
  return `${shortName(first.name)} and ${count(po.lines.length - 1, "more item")}`
}

/** Supplier orders on the way, earliest first, with "Goods received" right on the row. */
export function ArrivingPanel({ className }: { className?: string }) {
  const purchaseOrders = useInventory((s) => s.purchaseOrders)
  const suppliers = useInventory((s) => s.suppliers)
  const godowns = useInventory((s) => s.godowns)
  const items = useInventory((s) => s.items)
  const receivePurchase = useInventory((s) => s.receivePurchase)
  const openPanel = useUI((s) => s.openPanel)
  const openComposer = useUI((s) => s.openComposer)
  const now = useNow(60_000)
  // the order being confirmed stays set while the dialog animates closed
  const [confirming, setConfirming] = useState<PurchaseOrder | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const open = useMemo(
    () => purchaseOrders.filter((po) => po.status === "ordered").sort((a, b) => (a.expectedDate < b.expectedDate ? -1 : 1)),
    [purchaseOrders],
  )
  const shown = open.slice(0, MAX_SHOWN)

  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? "Supplier"
  const godownName = (id: string) => godowns.find((g) => g.id === id)?.name ?? "your"

  const receive = (po: PurchaseOrder) => {
    const res = receivePurchase(po.id)
    if (!res.ok) {
      toast.error("Could not mark the goods received", { description: res.error })
      return
    }
    const godown = godownName(po.godownId)
    const first = itemById.get(po.lines[0]?.itemId ?? "")
    const description =
      po.lines.length === 1 && first
        ? `Stock went up by ${qty(po.lines[0].qty, first.unit)} of ${shortName(first.name)} in ${godown} godown.`
        : `Stock went up for ${count(po.lines.length, "item")} in ${godown} godown.`
    toast.success("Goods received", { description })
  }

  return (
    <Panel
      className={className}
      title="Arriving soon"
      description="Orders you sent to suppliers that are on the way, earliest first."
      flush
    >
      {open.length === 0 ? (
        <EmptyState
          icon={TruckIcon}
          title="Nothing on the way"
          description="When you order from a supplier, the order waits here until the goods arrive."
          action={
            <Button variant="outline" onClick={() => openComposer({ type: "purchase" })}>
              <TruckIcon />
              {ACTION.newPurchase}
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border border-t border-border">
          <AnimatePresence initial={false}>
            {shown.map((po) => {
              const late = isPurchaseOverdue(po, now)
              const when = arrivalText(po.expectedDate, now)
              return (
                <motion.li
                  key={po.id}
                  layout="position"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 12, transition: { duration: 0.2, ease: EASE } }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className="flex flex-col gap-3 px-5 py-4"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="text-[15px] leading-snug font-semibold text-foreground">{supplierName(po.supplierId)}</p>
                      <StatusBadge status={late ? "late" : "ordered"} />
                    </div>
                    <p className="text-sm leading-relaxed text-fg-secondary">
                      {whatsComing(po, itemById)} for {godownName(po.godownId)} godown
                    </p>
                    <p className={cn("text-sm font-medium", late ? "text-negative" : "text-fg-secondary")}>{when.text}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:flex">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setConfirming(po)
                        setConfirmOpen(true)
                      }}
                    >
                      <PackageCheckIcon />
                      {ACTION.receivePurchase}
                    </Button>
                    <Button variant="ghost" className="text-primary-ink" onClick={() => openPanel({ type: "purchase", id: po.id })}>
                      {ACTION.view}
                    </Button>
                  </div>
                </motion.li>
              )
            })}
          </AnimatePresence>
          {open.length > MAX_SHOWN ? (
            <li className="px-5 py-3">
              <Link href="/purchases" className="inline-flex h-10 items-center gap-1.5 text-[15px] font-medium text-primary-ink hover:underline">
                {count(open.length - MAX_SHOWN, "more order")} on the Purchases page
                <ArrowRightIcon className="size-4" />
              </Link>
            </li>
          ) : null}
        </ul>
      )}

      <ConfirmDialog
        open={confirmOpen && confirming !== null}
        onOpenChange={setConfirmOpen}
        title={confirming ? `Goods received from ${supplierName(confirming.supplierId)}?` : "Goods received?"}
        description={
          confirming
            ? `Only press this when the goods are in ${godownName(confirming.godownId)} godown. Stock goes up by these amounts.`
            : undefined
        }
        changes={
          confirming
            ? confirming.lines.map((l) => {
                const it = itemById.get(l.itemId)
                return {
                  label: it ? shortName(it.name) : "Item",
                  value: `+${it ? qty(l.qty, it.unit) : l.qty}`,
                  direction: "up" as const,
                }
              })
            : []
        }
        confirmLabel="Yes, goods received"
        onConfirm={() => {
          if (confirming) receive(confirming)
        }}
      />
    </Panel>
  )
}
