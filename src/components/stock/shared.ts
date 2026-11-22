import { useInventory, useUI } from "@/lib/store"
import type { MovementType } from "@/lib/types"

/**
 * Share of each item's min level that a godown is expected to hold.
 * Bhosari is the main godown; Chakan and Bhiwandi carry smaller buffers.
 */
export const GODOWN_SHARE: Record<string, number> = {
  "g-bho": 0.5,
  "g-cha": 0.2,
  "g-bhi": 0.3,
}

export function shareOf(godownId: string) {
  return GODOWN_SHARE[godownId] ?? 1 / 3
}

/** Min level a single godown should hold for an item. */
export function godownMin(minLevel: number, godownId: string) {
  return Math.max(1, Math.round(minLevel * shareOf(godownId)))
}

export const MOVEMENT_LABEL: Record<MovementType, string> = {
  sale: "Sale",
  purchase: "Purchase",
  transfer_in: "Transfer in",
  transfer_out: "Transfer out",
  adjustment: "Adjustment",
}

/** Adjustments have no document to open. */
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
