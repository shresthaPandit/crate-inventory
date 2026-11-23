"use client"

import { AnimatePresence, motion } from "motion/react"
import { useMemo, useState } from "react"
import {
  ArrowLeftRightIcon,
  BanIcon,
  ChevronRightIcon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  IndianRupeeIcon,
  PackageMinusIcon,
  PackagePlusIcon,
  ReceiptTextIcon,
} from "lucide-react"
import { EASE } from "@/components/kit/page"
import { Panel } from "@/components/kit/panel"
import { Button } from "@/components/ui/button"
import { orderTotals } from "@/lib/calc"
import { dateShort, dateTime, inr } from "@/lib/format"
import { useInventory, useNow, useUI } from "@/lib/store"
import type { Activity, ActivityKind, Item, LineItem, TransferLine } from "@/lib/types"
import { cn } from "@/lib/utils"
import { count, qty, since } from "./plain"
import { shortName } from "./use-now"

type Icon = React.ComponentType<{ className?: string; strokeWidth?: number }>

/** Green = stock came in, blue = stock went out, grey = everything else. */
const LOOK: Record<ActivityKind, { icon: Icon; chip: string }> = {
  sale_shipped: { icon: PackageMinusIcon, chip: "bg-info-soft text-info" },
  po_received: { icon: PackagePlusIcon, chip: "bg-positive-soft text-positive" },
  payment: { icon: IndianRupeeIcon, chip: "bg-positive-soft text-positive" },
  transfer: { icon: ArrowLeftRightIcon, chip: "bg-raised text-fg-secondary" },
  adjustment: { icon: ClipboardCheckIcon, chip: "bg-raised text-fg-secondary" },
  sale_created: { icon: ReceiptTextIcon, chip: "bg-raised text-fg-secondary" },
  po_created: { icon: ClipboardListIcon, chip: "bg-raised text-fg-secondary" },
  cancelled: { icon: BanIcon, chip: "bg-raised text-muted-foreground" },
}

interface Sentence {
  text: string
  detail?: string
}

/** "Sold 24 pcs of LED bulb 9W to Metro Hardware Mart" · "Sold 3 items to …" */
function whatOf(lines: (LineItem | TransferLine)[], itemById: Map<string, Item>) {
  const first = itemById.get(lines[0]?.itemId ?? "")
  if (lines.length === 1 && first) return `${qty(lines[0].qty, first.unit)} of ${shortName(first.name)}`
  return count(lines.length, "item")
}

export function ActivityPanel({ className }: { className?: string }) {
  const activities = useInventory((s) => s.activities)
  const salesOrders = useInventory((s) => s.salesOrders)
  const purchaseOrders = useInventory((s) => s.purchaseOrders)
  const transfers = useInventory((s) => s.transfers)
  const items = useInventory((s) => s.items)
  const customers = useInventory((s) => s.customers)
  const suppliers = useInventory((s) => s.suppliers)
  const godowns = useInventory((s) => s.godowns)
  const openPanel = useUI((s) => s.openPanel)
  const now = useNow(60_000)
  const [expanded, setExpanded] = useState(false)

  const shown = useMemo(() => activities.slice(0, expanded ? 20 : 8), [activities, expanded])

  /** Rewrites each saved event as an everyday sentence, using the order it points to. */
  const sentences = useMemo(() => {
    const itemById = new Map(items.map((i) => [i.id, i]))
    const customer = (id: string) => customers.find((c) => c.id === id)?.name ?? "a customer"
    const supplier = (id: string) => suppliers.find((s) => s.id === id)?.name ?? "a supplier"
    const godown = (id: string) => godowns.find((g) => g.id === id)?.name ?? "a godown"

    const say = (a: Activity): Sentence => {
      const id = a.target?.id
      const so = a.target?.type === "sale" ? salesOrders.find((o) => o.id === id) : undefined
      const po = a.target?.type === "purchase" ? purchaseOrders.find((o) => o.id === id) : undefined

      switch (a.kind) {
        case "sale_shipped":
          if (!so) break
          return { text: `Sold ${whatOf(so.lines, itemById)} to ${customer(so.customerId)}`, detail: `Sent from ${godown(so.godownId)} · ${inr(orderTotals(so.lines).total)}` }
        case "sale_created":
          if (!so) break
          return { text: `New order from ${customer(so.customerId)}`, detail: `${whatOf(so.lines, itemById)} · ${inr(orderTotals(so.lines).total)}` }
        case "payment":
          if (!so) break
          return { text: `${customer(so.customerId)} paid ${inr(orderTotals(so.lines).total)}`, detail: `For order ${so.number}` }
        case "po_created":
          if (!po) break
          return { text: `Ordered ${whatOf(po.lines, itemById)} from ${supplier(po.supplierId)}`, detail: `Expected ${dateShort(po.expectedDate)} at ${godown(po.godownId)}` }
        case "po_received":
          if (!po) break
          return { text: `Received ${whatOf(po.lines, itemById)} from ${supplier(po.supplierId)}`, detail: `Into ${godown(po.godownId)} godown` }
        case "transfer": {
          const tr = transfers.find((t) => t.id === id)
          if (!tr) break
          return { text: `Moved ${whatOf(tr.lines, itemById)} from ${godown(tr.fromGodownId)} to ${godown(tr.toGodownId)}`, detail: tr.note }
        }
        case "adjustment": {
          const it = a.target?.type === "item" ? itemById.get(a.target.id) : undefined
          if (!it) break
          return { text: `Corrected the stock count of ${shortName(it.name)}`, detail: a.meta }
        }
        case "cancelled":
          if (so) return { text: `Cancelled the order from ${customer(so.customerId)}`, detail: so.number }
          if (po) return { text: `Cancelled the order to ${supplier(po.supplierId)}`, detail: po.number }
          break
      }
      // anything we cannot look up any more: show what was saved
      return { text: a.title, detail: a.meta }
    }

    return new Map(shown.map((a) => [a.id, say(a)]))
  }, [shown, salesOrders, purchaseOrders, transfers, items, customers, suppliers, godowns])

  return (
    <Panel
      className={className}
      title="Recent activity"
      description="Everything that happened, newest first. Press a line to see it."
      flush
    >
      {activities.length === 0 ? (
        <p className="border-t border-border px-5 py-6 text-[15px] text-muted-foreground">Nothing has happened yet. Your sales, orders and stock changes will show here.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border border-t border-border">
          <AnimatePresence initial={false}>
            {shown.map((a) => {
              const { icon: Icon, chip } = LOOK[a.kind]
              const s = sentences.get(a.id) ?? { text: a.title, detail: a.meta }
              const target = a.target
              return (
                <motion.li
                  key={a.id}
                  layout="position"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35, ease: EASE }}
                >
                  <button
                    type="button"
                    disabled={!target}
                    onClick={() => target && openPanel(target)}
                    className="group flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors outline-none hover:bg-raised/60 focus-visible:bg-raised/60 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset disabled:cursor-default disabled:hover:bg-transparent"
                  >
                    <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", chip)}>
                      <Icon className="size-[18px]" strokeWidth={1.75} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-[15px] leading-snug text-foreground">{s.text}</span>
                      <span className="flex flex-wrap gap-x-2 text-[13px] text-muted-foreground">
                        <span title={dateTime(a.at)}>{since(a.at, now)}</span>
                        {s.detail ? <span className="tabular">· {s.detail}</span> : null}
                      </span>
                    </span>
                    {target ? (
                      <ChevronRightIcon
                        aria-hidden
                        className="mt-2 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary-ink"
                        strokeWidth={2}
                      />
                    ) : null}
                  </button>
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ul>
      )}
      {activities.length > 8 ? (
        <div className="border-t border-border px-5 py-2">
          <Button variant="ghost" className="w-full text-primary-ink sm:w-auto" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Show less" : "Show more"}
          </Button>
        </div>
      ) : null}
    </Panel>
  )
}
