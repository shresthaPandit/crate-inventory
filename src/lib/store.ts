"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { onHand, orderTotals, shortages } from "./calc"
import { dateShort, inr, num } from "./format"
import { createSeed, type InventoryData } from "./seed"
import type {
  Activity,
  Item,
  LineItem,
  Movement,
  MovementType,
  PurchaseOrder,
  SalesOrder,
  StockMap,
  Transfer,
  TransferLine,
} from "./types"

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string }

export interface NewSaleInput {
  customerId: string
  godownId: string
  lines: LineItem[]
  note?: string
  /** "draft" keeps it editable, "confirmed" commits it, "shipped" deducts stock right away */
  status: "draft" | "confirmed" | "shipped"
}

export interface NewPurchaseInput {
  supplierId: string
  godownId: string
  lines: LineItem[]
  expectedDate: string
  note?: string
  /** true = goods already arrived, add to stock now */
  receiveNow?: boolean
}

export interface NewTransferInput {
  fromGodownId: string
  toGodownId: string
  lines: TransferLine[]
  note?: string
}

export interface AdjustInput {
  itemId: string
  godownId: string
  /** signed change */
  qty: number
  reason: string
}

interface Actions {
  createSale(input: NewSaleInput): Result<SalesOrder>
  confirmSale(id: string): Result<SalesOrder>
  shipSale(id: string): Result<SalesOrder>
  markSalePaid(id: string): Result<SalesOrder>
  cancelSale(id: string): Result<SalesOrder>
  createPurchase(input: NewPurchaseInput): Result<PurchaseOrder>
  receivePurchase(id: string): Result<PurchaseOrder>
  cancelPurchase(id: string): Result<PurchaseOrder>
  createTransfer(input: NewTransferInput): Result<Transfer>
  adjustStock(input: AdjustInput): Result<Movement>
  updateItem(id: string, patch: Partial<Pick<Item, "minLevel" | "price" | "cost">>): void
  resetDemo(): void
}

export type InventoryState = InventoryData & Actions

const fail = (error: string) => ({ ok: false as const, error })
const now = () => new Date().toISOString()

let idSeq = 0
const uid = (p: string) => `${p}_${Date.now().toString(36)}${(idSeq++).toString(36)}`

/** Apply stock changes and produce ledger rows. Pure: returns new stock map and movements. */
function applyMoves(
  stock: StockMap,
  moves: { itemId: string; godownId: string; qty: number; type: MovementType; ref: string; note?: string }[],
  at: string,
) {
  const next: StockMap = { ...stock }
  const rows: Movement[] = []
  for (const m of moves) {
    next[m.itemId] = { ...(next[m.itemId] ?? {}) }
    next[m.itemId][m.godownId] = (next[m.itemId][m.godownId] ?? 0) + m.qty
    rows.push({
      id: uid("mv"),
      date: at,
      itemId: m.itemId,
      godownId: m.godownId,
      qty: m.qty,
      type: m.type,
      ref: m.ref,
      note: m.note,
      balanceAfter: onHand(next, m.itemId),
    })
  }
  return { stock: next, rows: rows.reverse() }
}

function activity(a: Omit<Activity, "id" | "at">): Activity {
  return { id: uid("ac"), at: now(), ...a }
}

const units = (lines: { qty: number }[]) => lines.reduce((s, l) => s + l.qty, 0)

function validLines(lines: { itemId: string; qty: number }[]) {
  if (!lines.length) return "Add at least one item"
  if (lines.some((l) => !l.itemId)) return "Choose an item in every row, or remove the empty row"
  if (lines.some((l) => !Number.isFinite(l.qty) || l.qty <= 0)) return "Every quantity must be 1 or more"
  return null
}

export const useInventory = create<InventoryState>()(
  persist(
    (set, get) => {
      const nameOf = {
        customer: (id: string) => get().customers.find((c) => c.id === id)?.name ?? "customer",
        supplier: (id: string) => get().suppliers.find((s) => s.id === id)?.name ?? "supplier",
        godown: (id: string) => get().godowns.find((g) => g.id === id)?.name ?? "godown",
        item: (id: string) => get().items.find((i) => i.id === id)?.name ?? "item",
      }

      function doShip(so: SalesOrder): Result<SalesOrder> {
        const s = get()
        const short = shortages(s.stock, so.godownId, so.lines)
        if (short.length) {
          const first = short[0]
          return fail(
            `Not enough ${nameOf.item(first.itemId)} at ${nameOf.godown(so.godownId)}: you need ${num(first.need)}, only ${num(first.have)} in stock`,
          )
        }
        const at = now()
        const { stock, rows } = applyMoves(
          s.stock,
          so.lines.map((l) => ({ itemId: l.itemId, godownId: so.godownId, qty: -l.qty, type: "sale" as const, ref: so.number })),
          at,
        )
        const shipped: SalesOrder = { ...so, status: "shipped", shippedAt: at }
        const t = orderTotals(so.lines)
        set({
          stock,
          movements: [...rows, ...s.movements],
          salesOrders: upsert(s.salesOrders, shipped),
          activities: [
            activity({
              kind: "sale_shipped",
              title: `Shipped ${so.number} to ${nameOf.customer(so.customerId)}`,
              meta: `${num(t.units)} units · ${inr(t.total)}`,
              target: { type: "sale", id: so.id },
            }),
            ...s.activities,
          ],
        })
        return { ok: true, data: shipped }
      }

      function doReceive(po: PurchaseOrder): Result<PurchaseOrder> {
        const s = get()
        const at = now()
        const { stock, rows } = applyMoves(
          s.stock,
          po.lines.map((l) => ({ itemId: l.itemId, godownId: po.godownId, qty: l.qty, type: "purchase" as const, ref: po.number })),
          at,
        )
        const received: PurchaseOrder = { ...po, status: "received", receivedAt: at }
        set({
          stock,
          movements: [...rows, ...s.movements],
          purchaseOrders: upsert(s.purchaseOrders, received),
          activities: [
            activity({
              kind: "po_received",
              title: `Received ${po.number} at ${nameOf.godown(po.godownId)}`,
              meta: `${num(units(po.lines))} units from ${nameOf.supplier(po.supplierId)}`,
              target: { type: "purchase", id: po.id },
            }),
            ...s.activities,
          ],
        })
        return { ok: true, data: received }
      }

      return {
        // Seed only in the browser: the data is relative to "now" and the UI that
        // reads it renders after mount, so the server never needs it.
        ...(typeof window === "undefined" ? emptyData() : createSeed()),

        createSale(input) {
          const err = validLines(input.lines)
          if (err) return fail(err)
          if (!input.customerId) return fail("Choose a customer")
          if (!input.godownId) return fail("Choose the godown the items are coming from")
          if (input.status === "shipped") {
            const short = shortages(get().stock, input.godownId, input.lines)
            if (short.length) {
              const f = short[0]
              return fail(
                `Not enough ${nameOf.item(f.itemId)} at ${nameOf.godown(input.godownId)}: you need ${num(f.need)}, only ${num(f.have)} in stock`,
              )
            }
          }
          const s = get()
          const at = now()
          const so: SalesOrder = {
            id: uid("so"),
            number: `SO-${s.counters.so}`,
            customerId: input.customerId,
            godownId: input.godownId,
            date: at,
            dueDate: new Date(Date.now() + 30 * 86_400_000).toISOString(),
            lines: input.lines,
            status: input.status === "shipped" ? "confirmed" : input.status,
            payment: "unpaid",
            note: input.note,
          }
          set({
            counters: { ...s.counters, so: s.counters.so + 1 },
            salesOrders: [so, ...s.salesOrders],
            activities: [
              activity({
                kind: "sale_created",
                title: `New order ${so.number} from ${nameOf.customer(so.customerId)}`,
                meta: `${inr(orderTotals(so.lines).total)} · ${input.status === "shipped" ? "shipped" : so.status}`,
                target: { type: "sale", id: so.id },
              }),
              ...s.activities,
            ],
          })
          if (input.status === "shipped") return doShip(so)
          return { ok: true, data: so }
        },

        confirmSale(id) {
          const so = get().salesOrders.find((o) => o.id === id)
          if (!so) return fail("This order could not be found")
          if (so.status !== "draft") return fail(`${so.number} is already ${so.status}`)
          const next: SalesOrder = { ...so, status: "confirmed" }
          set((s) => ({ salesOrders: upsert(s.salesOrders, next) }))
          return { ok: true, data: next }
        },

        shipSale(id) {
          const so = get().salesOrders.find((o) => o.id === id)
          if (!so) return fail("This order could not be found")
          if (so.status === "shipped") return fail(`${so.number} has already shipped`)
          if (so.status === "cancelled") return fail(`${so.number} is cancelled`)
          return doShip(so)
        },

        markSalePaid(id) {
          const so = get().salesOrders.find((o) => o.id === id)
          if (!so) return fail("This order could not be found")
          if (so.payment === "paid") return fail(`${so.number} is already paid`)
          if (so.status === "cancelled") return fail(`${so.number} is cancelled`)
          const next: SalesOrder = { ...so, payment: "paid", paidAt: now() }
          set((s) => ({
            salesOrders: upsert(s.salesOrders, next),
            activities: [
              activity({
                kind: "payment",
                title: `${nameOf.customer(so.customerId)} paid ${so.number}`,
                meta: inr(orderTotals(so.lines).total),
                target: { type: "sale", id: so.id },
              }),
              ...s.activities,
            ],
          }))
          return { ok: true, data: next }
        },

        cancelSale(id) {
          const so = get().salesOrders.find((o) => o.id === id)
          if (!so) return fail("This order could not be found")
          if (so.status === "shipped") return fail("This order has already been shipped, so it cannot be cancelled")
          if (so.status === "cancelled") return fail(`${so.number} is already cancelled`)
          const next: SalesOrder = { ...so, status: "cancelled" }
          set((s) => ({
            salesOrders: upsert(s.salesOrders, next),
            activities: [
              activity({ kind: "cancelled", title: `Cancelled ${so.number}`, meta: nameOf.customer(so.customerId), target: { type: "sale", id: so.id } }),
              ...s.activities,
            ],
          }))
          return { ok: true, data: next }
        },

        createPurchase(input) {
          const err = validLines(input.lines)
          if (err) return fail(err)
          if (!input.supplierId) return fail("Choose a supplier")
          if (!input.godownId) return fail("Choose the godown the goods should go to")
          const s = get()
          const po: PurchaseOrder = {
            id: uid("po"),
            number: `PO-${s.counters.po}`,
            supplierId: input.supplierId,
            godownId: input.godownId,
            date: now(),
            expectedDate: input.expectedDate,
            lines: input.lines,
            status: "ordered",
            note: input.note,
          }
          set({
            counters: { ...s.counters, po: s.counters.po + 1 },
            purchaseOrders: [po, ...s.purchaseOrders],
            activities: [
              activity({
                kind: "po_created",
                title: `Ordered from ${nameOf.supplier(po.supplierId)} (${po.number})`,
                meta: `${num(units(po.lines))} units · due ${dateShort(po.expectedDate)}`,
                target: { type: "purchase", id: po.id },
              }),
              ...s.activities,
            ],
          })
          if (input.receiveNow) return doReceive(po)
          return { ok: true, data: po }
        },

        receivePurchase(id) {
          const po = get().purchaseOrders.find((p) => p.id === id)
          if (!po) return fail("This supplier order could not be found")
          if (po.status !== "ordered") return fail(`${po.number} is already ${po.status}`)
          return doReceive(po)
        },

        cancelPurchase(id) {
          const po = get().purchaseOrders.find((p) => p.id === id)
          if (!po) return fail("This supplier order could not be found")
          if (po.status !== "ordered") return fail(`${po.number} is already ${po.status}`)
          const next: PurchaseOrder = { ...po, status: "cancelled" }
          set((s) => ({
            purchaseOrders: upsert(s.purchaseOrders, next),
            activities: [
              activity({ kind: "cancelled", title: `Cancelled ${po.number}`, meta: nameOf.supplier(po.supplierId), target: { type: "purchase", id: po.id } }),
              ...s.activities,
            ],
          }))
          return { ok: true, data: next }
        },

        createTransfer(input) {
          const err = validLines(input.lines)
          if (err) return fail(err)
          if (input.fromGodownId === input.toGodownId) return fail("Pick two different godowns")
          const s = get()
          const short = shortages(
            s.stock,
            input.fromGodownId,
            input.lines.map((l) => ({ ...l, rate: 0 })),
          )
          if (short.length) {
            const f = short[0]
            return fail(`Only ${num(f.have)} of ${nameOf.item(f.itemId)} in ${nameOf.godown(input.fromGodownId)}`)
          }
          const at = now()
          const tr: Transfer = {
            id: uid("tr"),
            number: `TR-0${s.counters.tr}`,
            fromGodownId: input.fromGodownId,
            toGodownId: input.toGodownId,
            date: at,
            lines: input.lines,
            note: input.note,
          }
          const { stock, rows } = applyMoves(
            s.stock,
            input.lines.flatMap((l) => [
              { itemId: l.itemId, godownId: input.fromGodownId, qty: -l.qty, type: "transfer_out" as const, ref: tr.number },
              { itemId: l.itemId, godownId: input.toGodownId, qty: l.qty, type: "transfer_in" as const, ref: tr.number },
            ]),
            at,
          )
          set({
            stock,
            movements: [...rows, ...s.movements],
            transfers: [tr, ...s.transfers],
            counters: { ...s.counters, tr: s.counters.tr + 1 },
            activities: [
              activity({
                kind: "transfer",
                title: `Moved ${num(units(input.lines))} units from ${nameOf.godown(input.fromGodownId)} to ${nameOf.godown(input.toGodownId)}`,
                meta: `${tr.number} · ${input.lines.length} ${input.lines.length === 1 ? "item" : "items"}`,
                target: { type: "transfer", id: tr.id },
              }),
              ...s.activities,
            ],
          })
          return { ok: true, data: tr }
        },

        adjustStock(input) {
          if (!input.qty || !Number.isFinite(input.qty)) return fail("The count is the same as before, so there is nothing to correct")
          if (!input.reason.trim()) return fail("Choose a reason for the correction")
          const s = get()
          const have = onHand(s.stock, input.itemId, input.godownId)
          if (have + input.qty < 0) return fail(`Only ${num(have)} in stock at ${nameOf.godown(input.godownId)}`)
          const ref = `ADJ-0${s.counters.adj}`
          const { stock, rows } = applyMoves(
            s.stock,
            [{ itemId: input.itemId, godownId: input.godownId, qty: input.qty, type: "adjustment", ref, note: input.reason }],
            now(),
          )
          set({
            stock,
            movements: [...rows, ...s.movements],
            counters: { ...s.counters, adj: s.counters.adj + 1 },
            activities: [
              activity({
                kind: "adjustment",
                title: `Corrected the count of ${nameOf.item(input.itemId)}`,
                meta: `${input.qty > 0 ? "+" : "−"}${num(Math.abs(input.qty))} at ${nameOf.godown(input.godownId)} · ${input.reason}`,
                target: { type: "item", id: input.itemId },
              }),
              ...s.activities,
            ],
          })
          return { ok: true, data: rows[0] }
        },

        updateItem(id, patch) {
          set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }))
        },

        resetDemo() {
          set(createSeed())
        },
      }
    },
    {
      name: "crate-inventory",
      // v2: plain-language redesign. Older saved data starts fresh from the sample data.
      version: 2,
      migrate: () => createSeed(),
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        items: s.items,
        godowns: s.godowns,
        customers: s.customers,
        suppliers: s.suppliers,
        stock: s.stock,
        salesOrders: s.salesOrders,
        purchaseOrders: s.purchaseOrders,
        transfers: s.transfers,
        movements: s.movements,
        activities: s.activities.slice(0, 300),
        counters: s.counters,
      }),
    },
  ),
)

function emptyData(): InventoryData {
  return {
    items: [],
    godowns: [],
    customers: [],
    suppliers: [],
    stock: {},
    salesOrders: [],
    purchaseOrders: [],
    transfers: [],
    movements: [],
    activities: [],
    counters: { so: 0, po: 0, tr: 0, adj: 0, id: 0 },
  }
}

function upsert<T extends { id: string }>(list: T[], next: T) {
  return list.map((x) => (x.id === next.id ? next : x))
}

/* ------------------------------------------------------------------ */
/* UI store — which sheet / panel is open. Lets any screen open the     */
/* item drawer, an order, or a composer without prop drilling.          */
/* ------------------------------------------------------------------ */

export type Panel =
  | { type: "item"; id: string }
  | { type: "sale"; id: string }
  | { type: "purchase"; id: string }
  | { type: "transfer"; id: string }

export interface SaleDefaults {
  customerId?: string
  godownId?: string
  lines?: LineItem[]
}
export interface PurchaseDefaults {
  supplierId?: string
  godownId?: string
  lines?: LineItem[]
}
export interface TransferDefaults {
  fromGodownId?: string
  toGodownId?: string
  lines?: TransferLine[]
}
export interface AdjustDefaults {
  itemId?: string
  godownId?: string
}

export type Composer =
  | { type: "sale"; defaults?: SaleDefaults }
  | { type: "purchase"; defaults?: PurchaseDefaults }
  | { type: "transfer"; defaults?: TransferDefaults }
  | { type: "adjust"; defaults?: AdjustDefaults }

interface UIState {
  panel: Panel | null
  /** last id per panel type, kept so a drawer keeps its content while animating closed */
  lastPanel: Partial<Record<Panel["type"], string>>
  openPanel: (p: Panel) => void
  closePanel: () => void
  composer: Composer | null
  /** last composer per type, same reason */
  lastComposer: Partial<{ [K in Composer["type"]]: Extract<Composer, { type: K }> }>
  openComposer: (c: Composer) => void
  closeComposer: () => void
  commandOpen: boolean
  setCommandOpen: (v: boolean) => void
  mobileNavOpen: boolean
  setMobileNavOpen: (v: boolean) => void
}

export const useUI = create<UIState>()((set) => ({
  panel: null,
  lastPanel: {},
  openPanel: (panel) => set((s) => ({ panel, lastPanel: { ...s.lastPanel, [panel.type]: panel.id } })),
  closePanel: () => set({ panel: null }),
  composer: null,
  lastComposer: {},
  openComposer: (composer) => set((s) => ({ composer, lastComposer: { ...s.lastComposer, [composer.type]: composer } })),
  closeComposer: () => set({ composer: null }),
  commandOpen: false,
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  mobileNavOpen: false,
  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
}))

/* ------------------------------------------------------------------ */
/* Client-only gate. Data is seeded relative to "now" and persisted in  */
/* localStorage, so anything that reads the store renders after mount.  */
/* ------------------------------------------------------------------ */

/**
 * Current time for render. Ticks every `intervalMs` and refreshes whenever
 * the inventory changes, so "last 30 days" windows include an order shipped
 * a second ago.
 */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const t = setInterval(tick, intervalMs)
    const unsub = useInventory.subscribe(tick)
    return () => {
      clearInterval(t)
      unsub()
    }
  }, [intervalMs])
  return now
}

const subscribeNoop = () => () => {}
export function useMounted() {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  )
}
