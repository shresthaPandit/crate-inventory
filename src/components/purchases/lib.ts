import { differenceInCalendarDays } from "date-fns"
import { isPurchaseOverdue } from "@/lib/calc"
import { num } from "@/lib/format"
import type { BadgeStatus } from "@/components/kit/status-badge"
import type { Godown, Item, PurchaseOrder } from "@/lib/types"

export type HintTone = "muted" | "warning" | "negative"

/** "in 2 days" · "tomorrow" · "today" · "3 days late" for an open PO */
export function expectedHint(po: PurchaseOrder, now = new Date()): { text: string; tone: HintTone } | null {
  if (po.status !== "ordered") return null
  const d = differenceInCalendarDays(new Date(po.expectedDate), now)
  if (d < 0) return { text: `${-d} ${d === -1 ? "day" : "days"} late`, tone: "negative" }
  if (d === 0) return { text: "today", tone: "warning" }
  if (d === 1) return { text: "tomorrow", tone: "muted" }
  return { text: `in ${d} days`, tone: "muted" }
}

export const HINT_CLASS: Record<HintTone, string> = {
  muted: "text-muted-foreground",
  warning: "text-warning",
  negative: "text-negative",
}

export function poBadge(po: PurchaseOrder): BadgeStatus {
  if (isPurchaseOverdue(po)) return "late"
  return po.status
}

/** "+300 LED panel 15W at Bhosari" or "+360 units across 3 items at Bhosari" */
export function receiptSummary(po: PurchaseOrder, items: Item[], godowns: Godown[]) {
  const godown = godowns.find((g) => g.id === po.godownId)?.name ?? "the godown"
  if (po.lines.length <= 2) {
    const parts = po.lines.map((l) => `+${num(l.qty)} ${items.find((i) => i.id === l.itemId)?.name ?? "units"}`)
    return `${parts.join(", ")} at ${godown}`
  }
  const units = po.lines.reduce((s, l) => s + l.qty, 0)
  return `+${num(units)} units across ${po.lines.length} items at ${godown}`
}

export function unitsOf(lines: { qty: number }[]) {
  return lines.reduce((s, l) => s + l.qty, 0)
}

/** Current time for date-window maths (last 30 days etc.). Data is client-only, so render-time reads are fine. */
export function nowMs() {
  return new Date().getTime()
}
