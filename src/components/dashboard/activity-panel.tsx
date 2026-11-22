"use client"

import { AnimatePresence, motion } from "motion/react"
import { useState } from "react"
import {
  ArrowLeftRightIcon,
  ClipboardListIcon,
  IndianRupeeIcon,
  PackageMinusIcon,
  PackagePlusIcon,
  ReceiptTextIcon,
  SlidersHorizontalIcon,
  XIcon,
} from "lucide-react"
import { EASE } from "@/components/kit/page"
import { Panel } from "@/components/kit/panel"
import { Button } from "@/components/ui/button"
import { ago, dateTime } from "@/lib/format"
import { useInventory, useUI } from "@/lib/store"
import type { ActivityKind } from "@/lib/types"
import { useNow } from "./use-now"

const ICON: Record<ActivityKind, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  sale_shipped: PackageMinusIcon,
  po_received: PackagePlusIcon,
  payment: IndianRupeeIcon,
  transfer: ArrowLeftRightIcon,
  adjustment: SlidersHorizontalIcon,
  sale_created: ReceiptTextIcon,
  po_created: ClipboardListIcon,
  cancelled: XIcon,
}

export function ActivityPanel({ className }: { className?: string }) {
  const activities = useInventory((s) => s.activities)
  const openPanel = useUI((s) => s.openPanel)
  const [expanded, setExpanded] = useState(false)
  useNow(60_000)

  const shown = activities.slice(0, expanded ? 20 : 8)

  return (
    <Panel
      className={className}
      title="Recent activity"
      description="Every stock and order event, newest first"
      bodyClassName="px-3 pb-3"
    >
      <ul className="flex flex-col">
        <AnimatePresence initial={false}>
          {shown.map((a) => {
            const Icon = ICON[a.kind]
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
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors outline-none hover:bg-raised/60 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-default disabled:hover:bg-transparent"
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-md border border-border bg-raised text-muted-foreground">
                    <Icon className="size-3.5" strokeWidth={1.5} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm text-foreground">{a.title}</span>
                    {a.meta ? <span className="truncate font-mono text-xs text-muted-foreground tabular">{a.meta}</span> : null}
                  </span>
                  <span className="shrink-0 self-start pt-0.5 text-xs text-muted-foreground" title={dateTime(a.at)}>
                    {ago(a.at)}
                  </span>
                </button>
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ul>
      {activities.length > 8 ? (
        <div className="px-2 pt-2">
          <Button variant="ghost" size="sm" className="text-fg-secondary" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Show less" : "Show more"}
          </Button>
        </div>
      ) : null}
    </Panel>
  )
}
