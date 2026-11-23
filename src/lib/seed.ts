import { onHand, orderTotals } from "./calc"
import { dateShort, inr, num } from "./format"
import type {
  Activity,
  Customer,
  Godown,
  Item,
  LineItem,
  Movement,
  MovementType,
  PurchaseOrder,
  SalesOrder,
  StockMap,
  Supplier,
  Transfer,
} from "./types"

/* ------------------------------------------------------------------ */
/* Master data — Deccan Electric Supply, an electrical distributor     */
/* in Pune with three godowns                                           */
/* ------------------------------------------------------------------ */

export const GODOWNS: Godown[] = [
  { id: "g-bho", code: "PUN-01", name: "Bhosari", city: "Pune", manager: "Sunil Jadhav", capacity: 9000 },
  { id: "g-cha", code: "PUN-02", name: "Chakan", city: "Pune", manager: "Prakash More", capacity: 4500 },
  { id: "g-bhi", code: "MUM-01", name: "Bhiwandi", city: "Thane", manager: "Imran Shaikh", capacity: 6000 },
]

export const SUPPLIERS: Supplier[] = [
  { id: "s-kir", name: "Kiran Cables Pvt Ltd", city: "Silvassa", contact: "Nikhil Shah", phone: "+91 98250 41177", leadTimeDays: 5, category: "Wires & cables" },
  { id: "s-sur", name: "Suryodaya Lighting Co.", city: "Noida", contact: "Ritu Agarwal", phone: "+91 98110 23904", leadTimeDays: 7, category: "Lighting" },
  { id: "s-dec", name: "Deccan Switchgear Works", city: "Nashik", contact: "Mahesh Kale", phone: "+91 98220 67315", leadTimeDays: 4, category: "Switchgear" },
  { id: "s-aer", name: "Aerowind Fans Ltd", city: "Hyderabad", contact: "Srinivas Rao", phone: "+91 99490 11852", leadTimeDays: 6, category: "Fans" },
  { id: "s-pol", name: "Polyline Conduits", city: "Ahmedabad", contact: "Jignesh Patel", phone: "+91 98795 30216", leadTimeDays: 5, category: "Conduits & fittings" },
  { id: "s-mod", name: "Modulo Electricals", city: "Vadodara", contact: "Kavita Desai", phone: "+91 97277 48810", leadTimeDays: 4, category: "Accessories" },
]

export const CUSTOMERS: Customer[] = [
  { id: "c-sge", name: "Shree Ganesh Electricals", city: "Pimpri", contact: "Ganesh Pawar", phone: "+91 98221 30418", gstin: "27AAJFS4821K1Z3", creditLimit: 400000 },
  { id: "c-pat", name: "Patil Constructions", city: "Hinjewadi", contact: "Rohit Patil", phone: "+91 98902 77143", gstin: "27AADFP9132M1ZQ", creditLimit: 1200000 },
  { id: "c-met", name: "Metro Hardware Mart", city: "Kothrud", contact: "Sameer Joshi", phone: "+91 98500 64921", gstin: "27ABCPM7741L1ZT", creditLimit: 300000 },
  { id: "c-sai", name: "Sai Electrical Contractors", city: "Wakad", contact: "Vinod Shinde", phone: "+91 97650 12886", gstin: "27AEHPS2290N1Z8", creditLimit: 600000 },
  { id: "c-kul", name: "Kulkarni Builders", city: "Baner", contact: "Aditi Kulkarni", phone: "+91 98230 55607", gstin: "27AAKFK6604B1ZD", creditLimit: 1500000 },
  { id: "c-oms", name: "Om Sai Lighting House", city: "Thane", contact: "Dinesh Gupta", phone: "+91 98201 48362", gstin: "27AAQPG3187C1ZK", creditLimit: 350000 },
  { id: "c-raj", name: "Raj Enterprises", city: "Navi Mumbai", contact: "Rajesh Nair", phone: "+91 99673 20591", gstin: "27AAMPN8815E1ZB", creditLimit: 500000 },
  { id: "c-sun", name: "Sunrise Homes LLP", city: "Kharadi", contact: "Neha Bhosale", phone: "+91 98811 92034", gstin: "27AAZFS1149H1ZP", creditLimit: 1000000 },
  { id: "c-des", name: "Deshmukh Infra Projects", city: "Nashik", contact: "Amol Deshmukh", phone: "+91 94220 81576", gstin: "27AAHFD5502J1Z1", creditLimit: 900000 },
  { id: "c-vig", name: "Vighnaharta Traders", city: "Chinchwad", contact: "Santosh Gaikwad", phone: "+91 98608 43725", gstin: "27ADLPG6638F1ZV", creditLimit: 250000 },
  { id: "c-coa", name: "Coastal Interiors", city: "Vashi", contact: "Farah Khan", phone: "+91 98196 70452", gstin: "27AAJFC2276Q1ZM", creditLimit: 450000 },
  { id: "c-mah", name: "Mahalaxmi Electric Stores", city: "Hadapsar", contact: "Prashant Kadam", phone: "+91 98903 15578", gstin: "27AEXPK4410D1ZR", creditLimit: 300000 },
]

const MUMBAI_SIDE = new Set(["Thane", "Navi Mumbai", "Vashi"])

export const ITEMS: Item[] = [
  // Lighting — Suryodaya
  { id: "i-pnl15", sku: "LT-PNL-15W", name: "LED panel 15W, round, cool white", category: "Lighting", unit: "pcs", cost: 210, price: 295, minLevel: 120, supplierId: "s-sur" },
  { id: "i-blb9", sku: "LT-BLB-9W", name: "LED bulb 9W, B22", category: "Lighting", unit: "pcs", cost: 48, price: 75, minLevel: 400, supplierId: "s-sur" },
  { id: "i-btn20", sku: "LT-BTN-20W", name: "LED batten 20W, 4 ft", category: "Lighting", unit: "pcs", cost: 165, price: 240, minLevel: 150, supplierId: "s-sur" },
  { id: "i-fld50", sku: "LT-FLD-50W", name: "Floodlight 50W, IP65", category: "Lighting", unit: "pcs", cost: 620, price: 890, minLevel: 40, supplierId: "s-sur" },
  { id: "i-str5", sku: "LT-STR-5M", name: "LED strip 5 m, warm white", category: "Lighting", unit: "pcs", cost: 260, price: 399, minLevel: 60, supplierId: "s-sur" },
  // Wires & cables — Kiran
  { id: "i-fr15", sku: "WC-FR15-RD", name: "FR wire 1.5 sq mm, red, 90 m", category: "Wires & cables", unit: "coil", cost: 1180, price: 1520, minLevel: 60, supplierId: "s-kir" },
  { id: "i-fr25", sku: "WC-FR25-BK", name: "FR wire 2.5 sq mm, black, 90 m", category: "Wires & cables", unit: "coil", cost: 1890, price: 2390, minLevel: 50, supplierId: "s-kir" },
  { id: "i-fr40", sku: "WC-FR40-RD", name: "FR wire 4 sq mm, red, 90 m", category: "Wires & cables", unit: "coil", cost: 2980, price: 3720, minLevel: 25, supplierId: "s-kir" },
  { id: "i-cat6", sku: "WC-CAT6-305", name: "Cat6 cable, 305 m box", category: "Wires & cables", unit: "box", cost: 5400, price: 6900, minLevel: 10, supplierId: "s-kir" },
  { id: "i-flx3c", sku: "WC-FLX3C-25", name: "3-core flexible cable 2.5 sq mm, 100 m", category: "Wires & cables", unit: "coil", cost: 4200, price: 5350, minLevel: 12, supplierId: "s-kir" },
  // Switchgear — Deccan
  { id: "i-mcb16", sku: "SG-MCB-SP16", name: "MCB single pole 16A, C curve", category: "Switchgear", unit: "pcs", cost: 118, price: 175, minLevel: 200, supplierId: "s-dec" },
  { id: "i-mcb32", sku: "SG-MCB-DP32", name: "MCB double pole 32A", category: "Switchgear", unit: "pcs", cost: 420, price: 590, minLevel: 80, supplierId: "s-dec" },
  { id: "i-rccb", sku: "SG-RCCB-40", name: "RCCB 40A 30mA, 4 pole", category: "Switchgear", unit: "pcs", cost: 1850, price: 2490, minLevel: 20, supplierId: "s-dec" },
  { id: "i-db8", sku: "SG-DB-8W", name: "Distribution board 8-way, double door", category: "Switchgear", unit: "pcs", cost: 980, price: 1390, minLevel: 25, supplierId: "s-dec" },
  // Fans — Aerowind
  { id: "i-fan12", sku: "FN-CLG-1200", name: "Ceiling fan 1200 mm, BLDC", category: "Fans", unit: "pcs", cost: 2150, price: 2950, minLevel: 30, supplierId: "s-aer" },
  { id: "i-exh15", sku: "FN-EXH-150", name: "Exhaust fan 150 mm", category: "Fans", unit: "pcs", cost: 640, price: 899, minLevel: 40, supplierId: "s-aer" },
  { id: "i-ped40", sku: "FN-PED-400", name: "Pedestal fan 400 mm", category: "Fans", unit: "pcs", cost: 1450, price: 1990, minLevel: 15, supplierId: "s-aer" },
  // Conduits & fittings — Polyline
  { id: "i-pvc20", sku: "CF-PVC20-3M", name: "PVC conduit 20 mm, 3 m", category: "Conduits & fittings", unit: "pcs", cost: 38, price: 58, minLevel: 600, supplierId: "s-pol" },
  { id: "i-pvc25", sku: "CF-PVC25-3M", name: "PVC conduit 25 mm, 3 m", category: "Conduits & fittings", unit: "pcs", cost: 52, price: 78, minLevel: 400, supplierId: "s-pol" },
  { id: "i-bnd20", sku: "CF-BND20-50", name: "Conduit bend 20 mm, box of 50", category: "Conduits & fittings", unit: "box", cost: 280, price: 420, minLevel: 40, supplierId: "s-pol" },
  { id: "i-jbx4", sku: "CF-JBX4-20", name: "Junction box 4-way, 20 mm", category: "Conduits & fittings", unit: "pcs", cost: 14, price: 24, minLevel: 500, supplierId: "s-pol" },
  // Accessories — Modulo
  { id: "i-sw6", sku: "AC-SW6A-1W", name: "Modular switch 6A, 1-way", category: "Accessories", unit: "pcs", cost: 42, price: 69, minLevel: 800, supplierId: "s-mod" },
  { id: "i-skt16", sku: "AC-SKT16A-6P", name: "Modular socket 16A, 6-pin", category: "Accessories", unit: "pcs", cost: 118, price: 179, minLevel: 300, supplierId: "s-mod" },
  { id: "i-ext4", sku: "AC-EXT4-2M", name: "Extension board, 4 sockets, 2 m", category: "Accessories", unit: "pcs", cost: 310, price: 449, minLevel: 60, supplierId: "s-mod" },
  { id: "i-plt8", sku: "AC-PLT8M-WH", name: "Modular plate 8-module, white", category: "Accessories", unit: "pcs", cost: 92, price: 139, minLevel: 250, supplierId: "s-mod" },
]

export const CATEGORIES = [
  "Lighting",
  "Wires & cables",
  "Switchgear",
  "Fans",
  "Conduits & fittings",
  "Accessories",
] as const

/* ------------------------------------------------------------------ */
/* Simulation                                                           */
/* ------------------------------------------------------------------ */

export interface Counters {
  so: number
  po: number
  tr: number
  adj: number
  id: number
}

export interface InventoryData {
  items: Item[]
  godowns: Godown[]
  customers: Customer[]
  suppliers: Supplier[]
  stock: StockMap
  salesOrders: SalesOrder[]
  purchaseOrders: PurchaseOrder[]
  transfers: Transfer[]
  movements: Movement[]
  activities: Activity[]
  counters: Counters
}

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const HOUR = 3_600_000
const DAY = 24 * HOUR
const MIN = 60_000

/** Items the story needs to end in a specific state. */
const SCENARIO = {
  /** low, PO on the way (arrives tomorrow) */
  panels: "i-pnl15",
  /** out of stock, nothing ordered, a draft sale waiting on it */
  cat6: "i-cat6",
  /** low, PO overdue */
  rccb: "i-rccb",
  /** low, nothing ordered */
  fr25: "i-fr25",
  /** low, nothing ordered */
  exh: "i-exh15",
}
const HELD = new Set(Object.values(SCENARIO))

export function createSeed(nowMs = Date.now()): InventoryData {
  const rand = mulberry32(20261123)
  const r = (a: number, b: number) => a + rand() * (b - a)
  const ri = (a: number, b: number) => Math.floor(r(a, b + 1))
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)]

  const today0 = (() => {
    const d = new Date(nowMs)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  })()

  const items = ITEMS.map((i) => ({ ...i }))
  const itemById = new Map(items.map((i) => [i.id, i]))
  const custById = new Map(CUSTOMERS.map((c) => [c.id, c]))
  const supById = new Map(SUPPLIERS.map((s) => [s.id, s]))
  const gdById = new Map(GODOWNS.map((g) => [g.id, g]))

  const stock: StockMap = {}
  for (const it of items) {
    stock[it.id] = {
      "g-bho": Math.round(it.minLevel * r(1.0, 1.35)),
      "g-cha": Math.round(it.minLevel * r(0.35, 0.55)),
      "g-bhi": Math.round(it.minLevel * r(0.4, 0.65)),
    }
  }

  const salesOrders: SalesOrder[] = []
  const purchaseOrders: PurchaseOrder[] = []
  const transfers: Transfer[] = []
  const movements: Movement[] = []
  const activities: Activity[] = []
  const counters: Counters = { so: 2201, po: 1101, tr: 301, adj: 41, id: 1 }
  const nid = (p: string) => `${p}_${(counters.id++).toString(36)}`
  const activityFrom = nowMs - 14 * DAY

  const iso = (ms: number) => new Date(ms).toISOString()
  const units = (lines: { qty: number }[]) => lines.reduce((s, l) => s + l.qty, 0)

  function move(
    at: number,
    itemId: string,
    godownId: string,
    qty: number,
    type: MovementType,
    ref: string,
    note?: string,
  ) {
    stock[itemId][godownId] = (stock[itemId][godownId] ?? 0) + qty
    movements.push({
      id: nid("mv"),
      date: iso(at),
      itemId,
      godownId,
      qty,
      type,
      ref,
      balanceAfter: onHand(stock, itemId),
      note,
    })
  }

  function log(at: number, a: Omit<Activity, "id" | "at">) {
    if (at >= activityFrom) activities.push({ id: nid("ac"), at: iso(at), ...a })
  }

  function paymentFor(dateMs: number): Pick<SalesOrder, "payment" | "paidAt"> {
    const age = (nowMs - dateMs) / DAY
    const paidAfter = r(6, 26) * DAY
    const paidAt = dateMs + paidAfter
    if (age > 34) return rand() < 0.93 ? { payment: "paid", paidAt: iso(paidAt) } : { payment: "overdue" }
    if (age > 30) return rand() < 0.6 ? { payment: "paid", paidAt: iso(paidAt) } : { payment: "overdue" }
    if (paidAt < nowMs && rand() < 0.55) return { payment: "paid", paidAt: iso(paidAt) }
    return { payment: "unpaid" }
  }

  function shipSale(
    at: number,
    customerId: string,
    godownId: string,
    wanted: LineItem[],
    opts: { allowPartial?: boolean } = {},
  ) {
    const lines: LineItem[] = []
    for (const l of wanted) {
      const have = onHand(stock, l.itemId, godownId)
      const qty = opts.allowPartial === false ? l.qty : Math.min(l.qty, have)
      if (qty > 0 && have >= qty) lines.push({ ...l, qty })
    }
    if (!lines.length) return null
    const number = `SO-${counters.so++}`
    const so: SalesOrder = {
      id: nid("so"),
      number,
      customerId,
      godownId,
      date: iso(at),
      dueDate: iso(at + 30 * DAY),
      lines,
      status: "shipped",
      shippedAt: iso(at + ri(4, 15) * MIN),
      ...paymentFor(at),
    }
    salesOrders.push(so)
    const shippedMs = new Date(so.shippedAt!).getTime()
    for (const l of lines) move(shippedMs, l.itemId, godownId, -l.qty, "sale", number)
    const t = orderTotals(lines)
    const cust = custById.get(customerId)!
    log(shippedMs, {
      kind: "sale_shipped",
      title: `Shipped ${number} to ${cust.name}`,
      meta: `${num(t.units)} units · ${inr(t.total)}`,
      target: { type: "sale", id: so.id },
    })
    if (so.paidAt) {
      log(new Date(so.paidAt).getTime(), {
        kind: "payment",
        title: `${cust.name} paid ${number}`,
        meta: inr(t.total),
        target: { type: "sale", id: so.id },
      })
    }
    return so
  }

  function raisePO(at: number, supplierId: string, godownId: string, lines: LineItem[], expectedMs: number) {
    const number = `PO-${counters.po++}`
    const po: PurchaseOrder = {
      id: nid("po"),
      number,
      supplierId,
      godownId,
      date: iso(at),
      expectedDate: iso(expectedMs),
      lines,
      status: "ordered",
    }
    purchaseOrders.push(po)
    log(at, {
      kind: "po_created",
      title: `Ordered from ${supById.get(supplierId)!.name} (${number})`,
      meta: `${num(units(lines))} units · due ${dateShort(expectedMs)}`,
      target: { type: "purchase", id: po.id },
    })
    return po
  }

  function receivePO(at: number, po: PurchaseOrder) {
    po.status = "received"
    po.receivedAt = iso(at)
    for (const l of po.lines) move(at, l.itemId, po.godownId, l.qty, "purchase", po.number)
    log(at, {
      kind: "po_received",
      title: `Received ${po.number} at ${gdById.get(po.godownId)!.name}`,
      meta: `${num(units(po.lines))} units from ${supById.get(po.supplierId)!.name}`,
      target: { type: "purchase", id: po.id },
    })
  }

  function transfer(at: number, from: string, to: string, lines: { itemId: string; qty: number }[], note?: string) {
    const number = `TR-0${counters.tr++}`
    const tr: Transfer = { id: nid("tr"), number, fromGodownId: from, toGodownId: to, date: iso(at), lines, note }
    transfers.push(tr)
    for (const l of lines) {
      move(at, l.itemId, from, -l.qty, "transfer_out", number)
      move(at, l.itemId, to, l.qty, "transfer_in", number)
    }
    log(at, {
      kind: "transfer",
      title: `Moved ${num(units(lines))} units from ${gdById.get(from)!.name} to ${gdById.get(to)!.name}`,
      meta: `${number} · ${lines.length} ${lines.length === 1 ? "item" : "items"}`,
      target: { type: "transfer", id: tr.id },
    })
  }

  function adjust(at: number, itemId: string, godownId: string, qty: number, reason: string) {
    const ref = `ADJ-0${counters.adj++}`
    move(at, itemId, godownId, qty, "adjustment", ref, reason)
    const it = itemById.get(itemId)!
    log(at, {
      kind: "adjustment",
      title: `Corrected the count of ${it.name}`,
      meta: `${qty > 0 ? "+" : "−"}${Math.abs(qty)} at ${gdById.get(godownId)!.name} · ${reason}`,
      target: { type: "item", id: itemId },
    })
  }

  function randomLines(n: number, scale = 1): LineItem[] {
    const chosen = new Set<string>()
    const lines: LineItem[] = []
    while (lines.length < n) {
      const it = pick(items)
      if (chosen.has(it.id)) continue
      chosen.add(it.id)
      const qty = Math.max(1, Math.round(it.minLevel * r(0.03, 0.11) * scale))
      const discount = rand() < 0.3 ? 0.97 : 1
      lines.push({ itemId: it.id, qty, rate: Math.round(it.price * discount) })
    }
    return lines
  }

  /* ---------------- days −75 … −1 ---------------- */
  const START = -75
  for (let d = START; d <= -1; d++) {
    const day0 = today0 + d * DAY
    const weekday = new Date(day0).getDay()
    let t = day0 + 9 * HOUR + ri(0, 20) * MIN
    const next = () => (t += ri(18, 55) * MIN)

    // receive due POs
    for (const po of purchaseOrders) {
      if (po.status !== "ordered") continue
      if (new Date(po.expectedDate).getTime() > day0 + 12 * HOUR) continue
      if (po.note === "hold") continue
      if (rand() < 0.15) continue // a day late
      receivePO(next(), po)
    }

    // weekly rebalancing transfer on Mondays
    if (weekday === 1) {
      for (const to of ["g-cha", "g-bhi"]) {
        const lines = items
          .filter((it) => !HELD.has(it.id) || d < -14)
          .filter((it) => onHand(stock, it.id, to) < it.minLevel * 0.25 && onHand(stock, it.id, "g-bho") > it.minLevel * 0.9)
          .slice(0, 5)
          .map((it) => ({ itemId: it.id, qty: Math.round(it.minLevel * 0.4) }))
        if (lines.length) transfer(next(), "g-bho", to, lines)
      }
    }

    // sales
    const n = weekday === 0 ? ri(0, 1) : ri(2, 5)
    for (let k = 0; k < n; k++) {
      const cust = pick(CUSTOMERS)
      const godownId = MUMBAI_SIDE.has(cust.city) ? "g-bhi" : rand() < 0.68 ? "g-bho" : "g-cha"
      const big = ["c-pat", "c-kul", "c-sun", "c-des"].includes(cust.id)
      shipSale(next(), cust.id, godownId, randomLines(ri(1, 4), big ? 1.6 : 1))
    }

    // reorder check
    const bySupplier = new Map<string, LineItem[]>()
    for (const it of items) {
      if (HELD.has(it.id) && d > -60) continue
      const incoming = purchaseOrders
        .filter((p) => p.status === "ordered")
        .reduce((s, p) => s + p.lines.filter((l) => l.itemId === it.id).reduce((a, l) => a + l.qty, 0), 0)
      const position = onHand(stock, it.id) + incoming
      if (position < it.minLevel * 1.8) {
        // order up to 2.6× min
        const qty = Math.max(10, Math.ceil((it.minLevel * 2.6 - position) / 10) * 10)
        const arr = bySupplier.get(it.supplierId) ?? []
        arr.push({ itemId: it.id, qty, rate: it.cost })
        bySupplier.set(it.supplierId, arr)
      }
    }
    for (const [supplierId, lines] of bySupplier) {
      const sup = supById.get(supplierId)!
      raisePO(next(), supplierId, rand() < 0.8 ? "g-bho" : "g-bhi", lines, day0 + sup.leadTimeDays * DAY + 12 * HOUR)
    }

    // the occasional count correction or damage
    if (rand() < 0.07) {
      const it = pick(items)
      const g = pick(GODOWNS).id
      if (onHand(stock, it.id, g) > 5) {
        if (rand() < 0.65) adjust(next(), it.id, g, -ri(1, 4), pick(["Damaged in handling", "Water damage", "Failed QC"]))
        else adjust(next(), it.id, g, ri(2, 6), "Cycle count correction")
      }
    }

    /* scenario beats: project orders that run a few items down */
    const drainTo = (itemId: string, keep: [number, number, number], buyers: [string, string, string]) => {
      const gs = ["g-bho", "g-cha", "g-bhi"]
      gs.forEach((g, i) => {
        const have = onHand(stock, itemId, g)
        if (have > keep[i]) {
          shipSale(next(), buyers[i], g, [{ itemId, qty: have - keep[i], rate: itemById.get(itemId)!.price }])
        }
      })
    }
    if (d === -6) {
      drainTo(SCENARIO.rccb, [3, 2, 2], ["c-kul", "c-sai", "c-raj"])
      drainTo(SCENARIO.fr25, [9, 6, 5], ["c-des", "c-sge", "c-oms"])
      const sup = supById.get("s-dec")!
      const rccbPO = raisePO(next(), "s-dec", "g-bho", [
        { itemId: SCENARIO.rccb, qty: 40, rate: 1850 },
        { itemId: "i-db8", qty: 20, rate: 980 },
      ], day0 + sup.leadTimeDays * DAY + 12 * HOUR)
      rccbPO.note = "hold" // supplier is late
    }
    if (d === -4) drainTo(SCENARIO.cat6, [0, 0, 0], ["c-sun", "c-sai", "c-coa"])
    if (d === -3) drainTo(SCENARIO.exh, [9, 4, 2], ["c-mah", "c-vig", "c-raj"])
    if (d === -2) {
      drainTo(SCENARIO.panels, [26, 12, 12], ["c-pat", "c-sge", "c-oms"])
      raisePO(next(), "s-sur", "g-bho", [
        { itemId: SCENARIO.panels, qty: 300, rate: 210 },
        { itemId: "i-str5", qty: 60, rate: 260 },
      ], today0 + DAY + 12 * HOUR)
    }
  }

  // drop the internal hold flag
  for (const po of purchaseOrders) if (po.note === "hold") po.note = "Supplier confirmed dispatch, truck delayed at Igatpuri"

  /* ---------------- today: a few events in the last hours ---------------- */
  const todayTimes = [3 * HOUR + 20 * MIN, 2 * HOUR + 5 * MIN, 48 * MIN, 14 * MIN].map((o) => nowMs - o)
  // receive the oldest open conduit/accessory PO if any, else skip
  const dueToday = purchaseOrders.find(
    (p) => p.status === "ordered" && !p.lines.some((l) => HELD.has(l.itemId)) && new Date(p.expectedDate).getTime() <= today0 + 12 * HOUR,
  )
  if (dueToday) receivePO(todayTimes[0], dueToday)
  shipSale(todayTimes[1], "c-met", "g-bho", [
    { itemId: "i-sw6", qty: 120, rate: 69 },
    { itemId: "i-skt16", qty: 40, rate: 179 },
    { itemId: "i-plt8", qty: 30, rate: 139 },
  ])
  shipSale(todayTimes[2], "c-sge", "g-cha", [
    { itemId: "i-mcb16", qty: 30, rate: 175 },
    { itemId: "i-fr15", qty: 4, rate: 1520 },
  ])

  /* ---------------- open sales orders (not shipped) ---------------- */
  const openSale = (
    at: number,
    customerId: string,
    godownId: string,
    lines: LineItem[],
    status: "draft" | "confirmed",
    note?: string,
  ) => {
    const number = `SO-${counters.so++}`
    const so: SalesOrder = {
      id: nid("so"),
      number,
      customerId,
      godownId,
      date: iso(at),
      dueDate: iso(at + 30 * DAY),
      lines,
      status,
      payment: "unpaid",
      note,
    }
    salesOrders.push(so)
    const cust = custById.get(customerId)!
    log(at, {
      kind: "sale_created",
      title: `New order ${number} from ${cust.name}`,
      meta: `${inr(orderTotals(lines).total)} · ${status}`,
      target: { type: "sale", id: so.id },
    })
    return so
  }
  openSale(today0 - DAY + 15 * HOUR + 10 * MIN, "c-coa", "g-bhi", [
    { itemId: "i-cat6", qty: 4, rate: 6900 },
    { itemId: "i-str5", qty: 12, rate: 399 },
  ], "draft", "Office fit-out at Vashi, waiting on Cat6 stock")
  openSale(today0 - DAY + 17 * HOUR + 40 * MIN, "c-des", "g-bho", [
    { itemId: "i-fr40", qty: 6, rate: 3720 },
    { itemId: "i-db8", qty: 4, rate: 1390 },
    { itemId: "i-mcb32", qty: 16, rate: 590 },
  ], "confirmed")
  openSale(todayTimes[3], "c-kul", "g-bho", [
    { itemId: "i-fan12", qty: 18, rate: 2950 },
    { itemId: "i-btn20", qty: 40, rate: 240 },
    { itemId: "i-sw6", qty: 160, rate: 69 },
  ], "confirmed", "Baner site, deliver before Friday")
  openSale(nowMs - 6 * MIN, "c-vig", "g-cha", [
    { itemId: "i-blb9", qty: 120, rate: 75 },
    { itemId: "i-ext4", qty: 10, rate: 449 },
  ], "draft")

  // an extra open conduit PO so the purchase list has a clear "on the way" row
  raisePO(today0 - DAY + 11 * HOUR, "s-pol", "g-cha", [
    { itemId: "i-pvc25", qty: 400, rate: 52 },
    { itemId: "i-bnd20", qty: 40, rate: 280 },
  ], today0 + 4 * DAY + 12 * HOUR)

  // newest first everywhere
  const byDateDesc = <T extends { date: string }>(a: T, b: T) => (a.date < b.date ? 1 : -1)
  salesOrders.sort(byDateDesc)
  purchaseOrders.sort(byDateDesc)
  transfers.sort(byDateDesc)
  movements.sort(byDateDesc)
  activities.sort((a, b) => (a.at < b.at ? 1 : -1))

  return {
    items,
    godowns: GODOWNS.map((g) => ({ ...g })),
    customers: CUSTOMERS.map((c) => ({ ...c })),
    suppliers: SUPPLIERS.map((s) => ({ ...s })),
    stock,
    salesOrders,
    purchaseOrders,
    transfers,
    movements,
    activities,
    counters,
  }
}
