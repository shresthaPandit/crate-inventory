import type { Item, LineItem, Unit } from "@/lib/types"
import { num } from "@/lib/format"

/** "24 pcs", "1 coil", "3 boxes" */
export function qtyUnit(qty: number, unit?: Unit) {
  if (!unit) return num(qty)
  if (unit === "pcs") return `${num(qty)} ${qty === 1 ? "pc" : "pcs"}`
  if (unit === "box") return `${num(qty)} ${qty === 1 ? "box" : "boxes"}`
  return `${num(qty)} ${qty === 1 ? "coil" : "coils"}`
}

/** Total quantity grouped by unit: "48 pcs", or "40 pcs and 3 coils" when units are mixed. */
export function unitsText(lines: { itemId: string; qty: number }[], itemById: Map<string, Item>) {
  const byUnit = new Map<Unit | undefined, number>()
  for (const l of lines) {
    const u = itemById.get(l.itemId)?.unit
    byUnit.set(u, (byUnit.get(u) ?? 0) + l.qty)
  }
  const parts = [...byUnit.entries()].map(([u, q]) => qtyUnit(q, u))
  if (parts.length <= 1) return parts[0] ?? "0"
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`
}

/** "3 items · 48 pcs" */
export function itemsText(lines: LineItem[], itemById: Map<string, Item>) {
  const count = new Set(lines.map((l) => l.itemId)).size
  return `${count} ${count === 1 ? "item" : "items"} · ${unitsText(lines, itemById)}`
}
