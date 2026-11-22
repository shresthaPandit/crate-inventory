"use client"

import { addDays, startOfDay } from "date-fns"
import { useMemo } from "react"
import { isPurchaseOverdue, lowStockItems, onHand, orderTotals, stockStatus } from "@/lib/calc"
import { dateShort } from "@/lib/format"
import { useInventory } from "@/lib/store"
import type { Category, Customer, Item, PurchaseOrder, StockStatus, Supplier } from "@/lib/types"
import { DAY_MS, inPrev, inRange, rangeDays, type Range } from "./range"

const ms = (iso: string) => new Date(iso).getTime()

/* ------------------------------------------------------------------ */
/* Stock                                                                */
/* ------------------------------------------------------------------ */

export interface StockRow {
  item: Item
  opening: number
  in: number
  out: number
  /** transfers and adjustments, net */
  other: number
  closing: number
  value: number
  status: StockStatus
}

export interface StockReport {
  rows: StockRow[]
  totals: { opening: number; in: number; out: number; other: number; closing: number; value: number }
  closingValue: number
  openingValue: number
  unitsIn: number
  unitsOut: number
  prevUnitsIn: number
  prevUnitsOut: number
  receipts: number
  shipments: number
  lowCount: number
  series: { t: number; value: number }[]
  byCategory: { category: Category; value: number; units: number }[]
}

export function useStockReport(range: Range): StockReport {
  const items = useInventory((s) => s.items)
  const stock = useInventory((s) => s.stock)
  const movements = useInventory((s) => s.movements)

  return useMemo(() => {
    const byId = new Map(items.map((i) => [i.id, i]))
    const mv = movements
      .map((m) => ({ ...m, ms: ms(m.date) }))
      .filter((m) => byId.has(m.itemId))
      .sort((a, b) => b.ms - a.ms)

    const agg = new Map<string, { in: number; out: number; other: number; net: number }>()
    let unitsIn = 0
    let unitsOut = 0
    let prevUnitsIn = 0
    let prevUnitsOut = 0
    const receiptRefs = new Set<string>()
    const shipmentRefs = new Set<string>()

    for (const m of mv) {
      if (inRange(m.ms, range.from, range.to)) {
        const a = agg.get(m.itemId) ?? { in: 0, out: 0, other: 0, net: 0 }
        a.net += m.qty
        if (m.type === "purchase") {
          a.in += m.qty
          unitsIn += m.qty
          receiptRefs.add(m.ref)
        } else if (m.type === "sale") {
          a.out += -m.qty
          unitsOut += -m.qty
          shipmentRefs.add(m.ref)
        } else {
          a.other += m.qty
        }
        agg.set(m.itemId, a)
      } else if (inPrev(m.ms, range)) {
        if (m.type === "purchase") prevUnitsIn += m.qty
        else if (m.type === "sale") prevUnitsOut += -m.qty
      }
    }

    const rows: StockRow[] = items.map((item) => {
      const a = agg.get(item.id) ?? { in: 0, out: 0, other: 0, net: 0 }
      const closing = onHand(stock, item.id)
      return {
        item,
        opening: closing - a.net,
        in: a.in,
        out: a.out,
        other: a.other,
        closing,
        value: closing * item.cost,
        status: stockStatus(closing, item.minLevel),
      }
    })

    const totals = rows.reduce(
      (t, r) => ({
        opening: t.opening + r.opening,
        in: t.in + r.in,
        out: t.out + r.out,
        other: t.other + r.other,
        closing: t.closing + r.closing,
        value: t.value + r.value,
      }),
      { opening: 0, in: 0, out: 0, other: 0, closing: 0, value: 0 },
    )

    // Daily closing value, walking back from today's stock.
    const closingValue = totals.value
    const days = rangeDays(range)
    const series: { t: number; value: number }[] = []
    let running = closingValue
    let idx = 0
    for (let d = days.length - 1; d >= 0; d--) {
      const end = days[d] + DAY_MS
      while (idx < mv.length && mv[idx].ms >= end) {
        running -= mv[idx].qty * byId.get(mv[idx].itemId)!.cost
        idx++
      }
      series.push({ t: days[d], value: running })
    }
    series.reverse()
    while (idx < mv.length && mv[idx].ms >= range.from) {
      running -= mv[idx].qty * byId.get(mv[idx].itemId)!.cost
      idx++
    }
    const openingValue = running

    const cat = new Map<Category, { value: number; units: number }>()
    for (const r of rows) {
      const c = cat.get(r.item.category) ?? { value: 0, units: 0 }
      c.value += r.value
      c.units += r.closing
      cat.set(r.item.category, c)
    }
    const byCategory = [...cat.entries()]
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => b.value - a.value)

    return {
      rows,
      totals,
      closingValue,
      openingValue,
      unitsIn,
      unitsOut,
      prevUnitsIn,
      prevUnitsOut,
      receipts: receiptRefs.size,
      shipments: shipmentRefs.size,
      lowCount: lowStockItems(stock, items).length,
      series,
      byCategory,
    }
  }, [items, stock, movements, range])
}

/* ------------------------------------------------------------------ */
/* Sales                                                                */
/* ------------------------------------------------------------------ */

export interface SalesItemRow {
  item: Item
  units: number
  revenue: number
  margin: number
}

export interface SalesReport {
  revenue: number
  prevRevenue: number
  orders: number
  prevOrders: number
  avgOrder: number
  prevAvgOrder: number
  revenueExGst: number
  margin: number
  marginPct: number
  series: { t: number; label: string; tooltip: string; revenue: number; orders: number }[]
  topCustomers: { customer: Customer; revenue: number; orders: number }[]
  byItem: SalesItemRow[]
  totals: { units: number; revenue: number; margin: number }
}

export function useSalesReport(range: Range): SalesReport {
  const salesOrders = useInventory((s) => s.salesOrders)
  const items = useInventory((s) => s.items)
  const customers = useInventory((s) => s.customers)

  return useMemo(() => {
    const itemById = new Map(items.map((i) => [i.id, i]))
    const custById = new Map(customers.map((c) => [c.id, c]))
    const shipped = salesOrders
      .filter((o) => o.status === "shipped" && o.shippedAt)
      .map((o) => ({ o, ms: ms(o.shippedAt!), t: orderTotals(o.lines) }))
    const cur = shipped.filter((s) => inRange(s.ms, range.from, range.to))
    const prev = shipped.filter((s) => inPrev(s.ms, range))

    const revenue = cur.reduce((s, x) => s + x.t.total, 0)
    const prevRevenue = prev.reduce((s, x) => s + x.t.total, 0)
    const orders = cur.length
    const prevOrders = prev.length

    // buckets
    const days = rangeDays(range)
    const starts =
      range.bucket === "day"
        ? days
        : Array.from({ length: Math.ceil(range.days / 7) }, (_, k) => addDays(range.from, k * 7).getTime())
    const series = starts.map((t, i) => {
      const end = i < starts.length - 1 ? starts[i + 1] : startOfDay(range.to).getTime() + DAY_MS
      const inBucket = cur.filter((x) => x.ms >= t && x.ms < end)
      return {
        t,
        label: dateShort(t),
        tooltip: range.bucket === "day" ? dateShort(t) : `Week of ${dateShort(t)}`,
        revenue: inBucket.reduce((s, x) => s + x.t.total, 0),
        orders: inBucket.length,
      }
    })

    const custAgg = new Map<string, { revenue: number; orders: number }>()
    const itemAgg = new Map<string, { units: number; revenue: number; margin: number }>()
    for (const { o, t } of cur) {
      const c = custAgg.get(o.customerId) ?? { revenue: 0, orders: 0 }
      c.revenue += t.total
      c.orders += 1
      custAgg.set(o.customerId, c)
      for (const l of o.lines) {
        const it = itemById.get(l.itemId)
        if (!it) continue
        const a = itemAgg.get(l.itemId) ?? { units: 0, revenue: 0, margin: 0 }
        a.units += l.qty
        a.revenue += l.qty * l.rate
        a.margin += l.qty * (l.rate - it.cost)
        itemAgg.set(l.itemId, a)
      }
    }

    const topCustomers = [...custAgg.entries()]
      .filter(([id]) => custById.has(id))
      .map(([id, v]) => ({ customer: custById.get(id)!, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6)

    const byItem = [...itemAgg.entries()]
      .map(([id, v]) => ({ item: itemById.get(id)!, ...v }))
      .sort((a, b) => b.revenue - a.revenue)

    const totals = byItem.reduce(
      (t, r) => ({ units: t.units + r.units, revenue: t.revenue + r.revenue, margin: t.margin + r.margin }),
      { units: 0, revenue: 0, margin: 0 },
    )

    return {
      revenue,
      prevRevenue,
      orders,
      prevOrders,
      avgOrder: orders ? revenue / orders : 0,
      prevAvgOrder: prevOrders ? prevRevenue / prevOrders : 0,
      revenueExGst: totals.revenue,
      margin: totals.margin,
      marginPct: totals.revenue ? (totals.margin / totals.revenue) * 100 : 0,
      series,
      topCustomers,
      byItem,
      totals,
    }
  }, [salesOrders, items, customers, range])
}

/* ------------------------------------------------------------------ */
/* Purchases                                                            */
/* ------------------------------------------------------------------ */

export type PurchaseRowState = "received" | "ordered" | "late" | "cancelled"

export interface PurchaseRow {
  po: PurchaseOrder
  supplier: Supplier | undefined
  units: number
  amount: number
  state: PurchaseRowState
  daysLate: number
}

export interface SupplierPerf {
  supplier: Supplier
  spend: number
  received: number
  onTime: number
  /** average days late across received POs, 0 when always on time */
  avgLate: number
  open: number
}

export interface PurchaseReport {
  spend: number
  prevSpend: number
  receivedCount: number
  prevReceivedCount: number
  onTimeRate: number | null
  lateCount: number
  pendingValue: number
  pendingCount: number
  overdueCount: number
  suppliers: SupplierPerf[]
  rows: PurchaseRow[]
  totals: { units: number; amount: number }
}

function daysLateOf(po: PurchaseOrder) {
  if (!po.receivedAt) return 0
  const diff = Math.round((startOfDay(ms(po.receivedAt)).getTime() - startOfDay(ms(po.expectedDate)).getTime()) / DAY_MS)
  return Math.max(0, diff)
}

export function usePurchaseReport(range: Range): PurchaseReport {
  const purchaseOrders = useInventory((s) => s.purchaseOrders)
  const suppliers = useInventory((s) => s.suppliers)

  return useMemo(() => {
    const supById = new Map(suppliers.map((s) => [s.id, s]))
    const received = purchaseOrders.filter((p) => p.status === "received" && p.receivedAt)
    const cur = received.filter((p) => inRange(ms(p.receivedAt!), range.from, range.to))
    const prev = received.filter((p) => inPrev(ms(p.receivedAt!), range))
    const spendOf = (p: PurchaseOrder) => orderTotals(p.lines).subtotal

    const spend = cur.reduce((s, p) => s + spendOf(p), 0)
    const prevSpend = prev.reduce((s, p) => s + spendOf(p), 0)
    const lateCount = cur.filter((p) => daysLateOf(p) > 0).length
    const open = purchaseOrders.filter((p) => p.status === "ordered")

    const perf: SupplierPerf[] = suppliers
      .map((supplier) => {
        const mine = cur.filter((p) => p.supplierId === supplier.id)
        const late = mine.map(daysLateOf)
        return {
          supplier,
          spend: mine.reduce((s, p) => s + spendOf(p), 0),
          received: mine.length,
          onTime: late.filter((d) => d === 0).length,
          avgLate: mine.length ? late.reduce((s, d) => s + d, 0) / mine.length : 0,
          open: open.filter((p) => p.supplierId === supplier.id).length,
        }
      })
      .sort((a, b) => b.spend - a.spend)

    const rows: PurchaseRow[] = purchaseOrders
      .filter(
        (p) =>
          p.status === "ordered" ||
          inRange(ms(p.date), range.from, range.to) ||
          (p.receivedAt ? inRange(ms(p.receivedAt), range.from, range.to) : false),
      )
      .map((po) => {
        const t = orderTotals(po.lines)
        const state: PurchaseRowState =
          po.status === "received" ? "received" : po.status === "cancelled" ? "cancelled" : isPurchaseOverdue(po) ? "late" : "ordered"
        return { po, supplier: supById.get(po.supplierId), units: t.units, amount: t.subtotal, state, daysLate: daysLateOf(po) }
      })
      .sort((a, b) => (a.po.date < b.po.date ? 1 : -1))

    const totals = rows
      .filter((r) => r.state !== "cancelled")
      .reduce((t, r) => ({ units: t.units + r.units, amount: t.amount + r.amount }), { units: 0, amount: 0 })

    return {
      spend,
      prevSpend,
      receivedCount: cur.length,
      prevReceivedCount: prev.length,
      onTimeRate: cur.length ? ((cur.length - lateCount) / cur.length) * 100 : null,
      lateCount,
      pendingValue: open.reduce((s, p) => s + spendOf(p), 0),
      pendingCount: open.length,
      overdueCount: open.filter((p) => isPurchaseOverdue(p)).length,
      suppliers: perf,
      rows,
      totals,
    }
  }, [purchaseOrders, suppliers, range])
}
