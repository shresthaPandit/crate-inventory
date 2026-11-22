export type Category =
  | "Lighting"
  | "Wires & cables"
  | "Switchgear"
  | "Fans"
  | "Conduits & fittings"
  | "Accessories"

export type Unit = "pcs" | "coil" | "box"

export interface Item {
  id: string
  sku: string
  name: string
  category: Category
  unit: Unit
  /** purchase cost per unit, INR */
  cost: number
  /** selling price per unit, INR (before GST) */
  price: number
  /** reorder point across all godowns */
  minLevel: number
  supplierId: string
}

export interface Godown {
  id: string
  code: string
  name: string
  city: string
  manager: string
  /** rough capacity in units, used for fill % */
  capacity: number
}

export interface Customer {
  id: string
  name: string
  city: string
  contact: string
  phone: string
  gstin: string
  creditLimit: number
}

export interface Supplier {
  id: string
  name: string
  city: string
  contact: string
  phone: string
  leadTimeDays: number
  category: Category
}

export interface LineItem {
  itemId: string
  qty: number
  /** unit rate in INR, before GST */
  rate: number
}

export type SaleStatus = "draft" | "confirmed" | "shipped" | "cancelled"
export type PaymentStatus = "unpaid" | "paid" | "overdue"

export interface SalesOrder {
  id: string
  /** e.g. SO-2398 */
  number: string
  customerId: string
  godownId: string
  /** ISO datetime the order was created */
  date: string
  /** ISO date payment is due */
  dueDate: string
  lines: LineItem[]
  status: SaleStatus
  payment: PaymentStatus
  shippedAt?: string
  paidAt?: string
  note?: string
}

export type PurchaseStatus = "ordered" | "received" | "cancelled"

export interface PurchaseOrder {
  id: string
  /** e.g. PO-1187 */
  number: string
  supplierId: string
  godownId: string
  date: string
  expectedDate: string
  lines: LineItem[]
  status: PurchaseStatus
  receivedAt?: string
  note?: string
}

export interface TransferLine {
  itemId: string
  qty: number
}

export interface Transfer {
  id: string
  /** e.g. TR-0412 */
  number: string
  fromGodownId: string
  toGodownId: string
  date: string
  lines: TransferLine[]
  note?: string
}

export type MovementType =
  | "purchase"
  | "sale"
  | "transfer_in"
  | "transfer_out"
  | "adjustment"

/** One row of the stock ledger. Every stock change writes one of these. */
export interface Movement {
  id: string
  date: string
  itemId: string
  godownId: string
  /** signed: + into stock, − out of stock */
  qty: number
  type: MovementType
  /** document number, e.g. SO-2398, PO-1187, TR-0412, ADJ-031 */
  ref: string
  /** total on hand for this item across all godowns after this movement */
  balanceAfter: number
  note?: string
}

export type ActivityKind =
  | "sale_created"
  | "sale_shipped"
  | "payment"
  | "po_created"
  | "po_received"
  | "transfer"
  | "adjustment"
  | "cancelled"

export interface Activity {
  id: string
  at: string
  kind: ActivityKind
  /** e.g. "Shipped SO-2398 to Patil Constructions" */
  title: string
  /** e.g. "18 units · ₹42,180" */
  meta?: string
  /** what to open when clicked */
  target?: { type: "sale" | "purchase" | "item" | "transfer"; id: string }
}

/** stock[itemId][godownId] = qty */
export type StockMap = Record<string, Record<string, number>>

export type StockStatus = "ok" | "low" | "out"
