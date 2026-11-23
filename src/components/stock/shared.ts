import { formatDistanceStrict } from "date-fns"
import { useMemo } from "react"
import { suggestedReorder } from "@/lib/calc"
import { num } from "@/lib/format"
import { useInventory, useUI } from "@/lib/store"
import type { Item, MovementType, Unit } from "@/lib/types"
import { GLOSSARY } from "@/lib/words"

/**
 * Share of each item's min level that a godown is expected to hold.
 * Bhosari is the main godown; Chakan and Bhiwandi carry smaller buffers.
 */
export const GODOWN_SHARE: Record<string, number> = {
  "g-bho": 0.5,
  "g-cha": 0.2,
  "g-bhi": 0.3,
}

/** The main godown: new supplier orders go here unless you pick another. */
export const MAIN_GODOWN = "g-bho"

export function shareOf(godownId: string) {
  return GODOWN_SHARE[godownId] ?? 1 / 3
}

/** Min level a single godown should hold for an item. */
export function godownMin(minLevel: number, godownId: string) {
  return Math.max(1, Math.round(minLevel * shareOf(godownId)))
}

/** Stock history entry names, in plain words. */
export const MOVEMENT_LABEL: Record<MovementType, string> = {
  sale: "Sale",
  purchase: "Goods received",
  transfer_in: "Moved in",
  transfer_out: "Moved out",
  adjustment: "Stock correction",
}

/** Stock corrections have no document to open. */
export function isOpenableRef(ref: string) {
  return !ref.startsWith("ADJ")
}

/** Open the source document (sale, purchase or transfer) behind a ledger ref. */
export function openRef(ref: string) {
  const s = useInventory.getState()
  const { openPanel } = useUI.getState()
  if (ref.startsWith("SO-")) {
    const so = s.salesOrders.find((o) => o.number === ref)
    if (so) openPanel({ type: "sale", id: so.id })
  } else if (ref.startsWith("PO-")) {
    const po = s.purchaseOrders.find((o) => o.number === ref)
    if (po) openPanel({ type: "purchase", id: po.id })
  } else if (ref.startsWith("TR-")) {
    const tr = s.transfers.find((o) => o.number === ref)
    if (tr) openPanel({ type: "transfer", id: tr.id })
  }
}

/** Short bin code from a SKU: "LT-PNL-15W" → "PNL-15W" */
export function binCode(sku: string) {
  return sku.split("-").slice(1).join("-")
}

/* ------------------------------------------------------------------ */
/* Plain-word helpers                                                   */
/* ------------------------------------------------------------------ */

const UNIT_WORD: Record<Unit, readonly [one: string, many: string]> = {
  pcs: ["pc", "pcs"],
  coil: ["coil", "coils"],
  box: ["box", "boxes"],
}

/** "pcs" / "coil" / "boxes", matching the number. */
export function unitWord(n: number, unit: Unit) {
  const [one, many] = UNIT_WORD[unit] ?? [unit, unit]
  return Math.abs(n) === 1 ? one : many
}

/** "24 pcs", "1 coil", "3 boxes" */
export function qtyText(n: number, unit: Unit) {
  return `${num(n)} ${unitWord(n, unit)}`
}

/** The one-line meaning of a word from the shared glossary. */
export function meaning(term: string) {
  return GLOSSARY.find((g) => g.term === term)?.meaning ?? ""
}

/** How much to order: back to 2.5× the minimum level, rounded up to tens, at least 10. */
export function reorderQty(item: Item, total: number, incoming: number) {
  return Math.max(10, Math.ceil(suggestedReorder(item, total, incoming) / 10) * 10)
}

/** "just now", "12 minutes ago", "2 days ago". Pure: pass `now` from useNow(). */
export function timeAgo(iso: string, now: number) {
  const t = new Date(iso).getTime()
  if (now - t < 60_000) return "just now"
  return formatDistanceStrict(t, now, { addSuffix: true })
}

/**
 * Names behind a ledger ref: the customer of a sale, the supplier of a
 * purchase, the two godowns of a move. Used to write stock history as
 * plain sentences ("Sold 24 pcs to Patil Constructions").
 */
export function useRefNames() {
  const salesOrders = useInventory((s) => s.salesOrders)
  const purchaseOrders = useInventory((s) => s.purchaseOrders)
  const transfers = useInventory((s) => s.transfers)
  const customers = useInventory((s) => s.customers)
  const suppliers = useInventory((s) => s.suppliers)
  const godowns = useInventory((s) => s.godowns)

  return useMemo(() => {
    const customer = new Map(customers.map((c) => [c.id, c.name]))
    const supplier = new Map(suppliers.map((s) => [s.id, s.name]))
    const godown = new Map(godowns.map((g) => [g.id, g.name]))
    const sale = new Map(salesOrders.map((o) => [o.number, o.customerId]))
    const purchase = new Map(purchaseOrders.map((o) => [o.number, o.supplierId]))
    const move = new Map(transfers.map((t) => [t.number, t]))
    return {
      godown: (id: string) => godown.get(id) ?? "a godown",
      customerOf: (ref: string) => customer.get(sale.get(ref) ?? "") ?? "a customer",
      supplierOf: (ref: string) => supplier.get(purchase.get(ref) ?? "") ?? "a supplier",
      transferOf: (ref: string) => {
        const t = move.get(ref)
        return t ? { from: godown.get(t.fromGodownId) ?? "a godown", to: godown.get(t.toGodownId) ?? "a godown" } : null
      },
    }
  }, [salesOrders, purchaseOrders, transfers, customers, suppliers, godowns])
}

export type RefNames = ReturnType<typeof useRefNames>
