import { differenceInCalendarDays } from "date-fns"
import { isPurchaseOverdue } from "@/lib/calc"
import { num } from "@/lib/format"
import type { BadgeStatus } from "@/components/kit/status-badge"
import { GLOSSARY } from "@/lib/words"
import type { Godown, Item, PurchaseOrder, Unit } from "@/lib/types"

export type HintTone = "muted" | "warning" | "negative"

/**
 * When an open order should arrive, in plain words:
 * "Arrives today" · "Arrives tomorrow" · "Arrives in 2 days" · "3 days late".
 * Pass `now` from useNow() when calling during render.
 */
export function expectedHint(po: PurchaseOrder, now: Date | number = Date.now()): { text: string; tone: HintTone } | null {
  if (po.status !== "ordered") return null
  const d = differenceInCalendarDays(new Date(po.expectedDate), now)
  if (d < 0) return { text: `${-d} ${d === -1 ? "day" : "days"} late`, tone: "negative" }
  if (d === 0) return { text: "Arrives today", tone: "warning" }
  if (d === 1) return { text: "Arrives tomorrow", tone: "muted" }
  return { text: `Arrives in ${d} days`, tone: "muted" }
}

/** How many calendar days past the expected date an open order is (0 when not late). */
export function daysLate(po: PurchaseOrder, now: Date | number = Date.now()) {
  if (po.status !== "ordered") return 0
  return Math.max(0, -differenceInCalendarDays(new Date(po.expectedDate), now))
}

export const HINT_CLASS: Record<HintTone, string> = {
  muted: "text-muted-foreground",
  warning: "text-warning",
  negative: "text-negative",
}

/** Badge for an order: an open order past its expected date shows as "Late". */
export function poBadge(po: PurchaseOrder, now?: number): BadgeStatus {
  if (isPurchaseOverdue(po, now)) return "late"
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

/** Current time for date-window maths (last 30 days etc.). Prefer useNow() inside components. */
export function nowMs() {
  return new Date().getTime()
}

/* ------------------------------------------------------------------ */
/* Plain-word quantities, shared by purchases and move stock            */
/* ------------------------------------------------------------------ */

const UNIT_WORDS: Record<Unit, [string, string]> = {
  pcs: ["pc", "pcs"],
  coil: ["coil", "coils"],
  box: ["box", "boxes"],
}

/** "24 pcs" · "1 coil" · "6 boxes" */
export function qtyText(qty: number, unit?: Unit) {
  if (!unit) return `${num(qty)} ${qty === 1 ? "unit" : "units"}`
  const [one, many] = UNIT_WORDS[unit]
  return `${num(qty)} ${qty === 1 ? one : many}`
}

/** Signed version for "what will change" lists: "+300 pcs" · "−20 coils" */
export function signedQtyText(qty: number, unit?: Unit) {
  const sign = qty > 0 ? "+" : qty < 0 ? "−" : ""
  return `${sign}${qtyText(Math.abs(qty), unit)}`
}

/**
 * Total quantity across lines, with the unit when every line uses the same
 * one ("300 pcs"), otherwise "300 units".
 */
export function linesQtyText(lines: { itemId: string; qty: number }[], itemById: Map<string, Item>, signed = false) {
  const total = unitsOf(lines)
  const units = new Set(lines.map((l) => itemById.get(l.itemId)?.unit))
  const unit = units.size === 1 ? [...units][0] : undefined
  return signed ? signedQtyText(total, unit) : qtyText(total, unit)
}

/** "1 item" · "4 items" */
export function itemsText(n: number) {
  return `${num(n)} ${n === 1 ? "item" : "items"}`
}

/** "LED panel 15W" · "LED panel 15W and Copper wire" · "LED panel 15W and 3 more" */
export function itemNames(lines: { itemId: string }[], itemById: Map<string, Item>) {
  const names = lines.map((l) => itemById.get(l.itemId)?.name).filter((n): n is string => Boolean(n))
  if (names.length <= 1) return names[0] ?? ""
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names[0]} and ${names.length - 1} more`
}

/** The one-line meaning of a word, from the shared glossary. */
export function meaningOf(term: string) {
  return GLOSSARY.find((g) => g.term === term)?.meaning ?? ""
}
