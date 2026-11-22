import type {
  Item,
  LineItem,
  PurchaseOrder,
  SalesOrder,
  StockMap,
  StockStatus,
} from "./types"

export const GST_RATE = 0.18

export function orderTotals(lines: LineItem[]) {
  const subtotal = lines.reduce((s, l) => s + l.qty * l.rate, 0)
  const tax = Math.round(subtotal * GST_RATE)
  return { subtotal, tax, total: subtotal + tax, units: lines.reduce((s, l) => s + l.qty, 0) }
}

export function onHand(stock: StockMap, itemId: string, godownId?: string) {
  const row = stock[itemId] ?? {}
  if (godownId) return row[godownId] ?? 0
  return Object.values(row).reduce((s, n) => s + n, 0)
}

export function stockStatus(qty: number, minLevel: number): StockStatus {
  if (qty <= 0) return "out"
  if (qty <= minLevel) return "low"
  return "ok"
}

export function itemStatus(stock: StockMap, item: Item): StockStatus {
  return stockStatus(onHand(stock, item.id), item.minLevel)
}

export function stockValue(stock: StockMap, items: Item[]) {
  return items.reduce((s, it) => s + onHand(stock, it.id) * it.cost, 0)
}

export function lowStockItems(stock: StockMap, items: Item[]) {
  return items
    .map((item) => ({ item, qty: onHand(stock, item.id) }))
    .filter(({ item, qty }) => qty <= item.minLevel)
    .sort((a, b) => a.qty / a.item.minLevel - b.qty / b.item.minLevel)
}

/** Units of an item already on open purchase orders (ordered, not yet received). */
export function incomingQty(purchaseOrders: PurchaseOrder[], itemId: string) {
  return purchaseOrders
    .filter((po) => po.status === "ordered")
    .reduce(
      (s, po) => s + po.lines.filter((l) => l.itemId === itemId).reduce((a, l) => a + l.qty, 0),
      0,
    )
}

/** Units of an item on open sales orders (draft or confirmed, not shipped). */
export function committedQty(salesOrders: SalesOrder[], itemId: string) {
  return salesOrders
    .filter((so) => so.status === "confirmed")
    .reduce(
      (s, so) => s + so.lines.filter((l) => l.itemId === itemId).reduce((a, l) => a + l.qty, 0),
      0,
    )
}

/** Suggested reorder quantity: bring the item back to 2.5× its min level. */
export function suggestedReorder(item: Item, qty: number, incoming = 0) {
  const target = Math.ceil(item.minLevel * 2.5)
  return Math.max(0, target - qty - incoming)
}

/** For a sale at a godown, list lines that cannot be fulfilled. */
export function shortages(stock: StockMap, godownId: string, lines: LineItem[]) {
  const need: Record<string, number> = {}
  for (const l of lines) need[l.itemId] = (need[l.itemId] ?? 0) + l.qty
  return Object.entries(need)
    .map(([itemId, qty]) => ({ itemId, need: qty, have: onHand(stock, itemId, godownId) }))
    .filter((s) => s.have < s.need)
}

export function isPurchaseOverdue(po: PurchaseOrder, now = Date.now()) {
  return po.status === "ordered" && new Date(po.expectedDate).getTime() < startOfDayMs(now)
}

export function startOfDayMs(ms: number) {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
