"use client"

import { AnimatePresence, motion } from "motion/react"
import { usePathname, useSearchParams } from "next/navigation"
import { Suspense, useMemo, useState } from "react"
import {
  ChevronRightIcon,
  CircleCheckIcon,
  IndianRupeeIcon,
  PackageIcon,
  PlusIcon,
  ShoppingCartIcon,
  TrendingUpIcon,
  TriangleAlertIcon,
  TruckIcon,
  WalletIcon,
  XIcon,
} from "lucide-react"
import { ConfirmDialog } from "@/components/kit/confirm"
import { EmptyState, Mono, SearchInput, Segmented } from "@/components/kit/misc"
import { EASE, Page, PageHeader, Stagger, StaggerItem } from "@/components/kit/page"
import { Panel } from "@/components/kit/panel"
import { StatCard } from "@/components/kit/stat-card"
import { StatusBadge, type Tone } from "@/components/kit/status-badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { orderTotals, shortages } from "@/lib/calc"
import { dateShort, inr, num, pct, plural } from "@/lib/format"
import { useInventory, useNow, useUI } from "@/lib/store"
import type { PaymentStatus, SaleStatus, SalesOrder } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ACTION } from "@/lib/words"
import { itemsText } from "./sale-words"
import { useSaleConfirm, type SaleStep } from "./use-sale-actions"

type StatusFilter = "all" | SaleStatus
type PaymentFilter = "any" | PaymentStatus

const STATUS_VALUES: StatusFilter[] = ["all", "draft", "confirmed", "shipped", "cancelled"]
const PAYMENT_VALUES: PaymentFilter[] = ["any", "unpaid", "overdue", "paid"]

const parseStatus = (v: string | null): StatusFilter =>
  v && (STATUS_VALUES as string[]).includes(v) ? (v as StatusFilter) : "all"
const parsePayment = (v: string | null): PaymentFilter =>
  v && (PAYMENT_VALUES as string[]).includes(v) ? (v as PaymentFilter) : "any"

const DAY = 86_400_000
const PAGE = 25

interface Row {
  order: SalesOrder
  total: number
  items: string
  customerName: string
  customerCity: string
  godownName: string
  /** open order that the godown cannot fully cover right now */
  short: boolean
}

export function SalesView() {
  // useSearchParams needs a Suspense boundary
  return (
    <Suspense fallback={null}>
      <SalesViewInner />
    </Suspense>
  )
}

function SalesViewInner() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  // status and payment live in the URL, so Home can link straight to /sales?status=confirmed
  const status = parseStatus(searchParams.get("status"))
  const payment = parsePayment(searchParams.get("payment"))

  const salesOrders = useInventory((s) => s.salesOrders)
  const customers = useInventory((s) => s.customers)
  const godowns = useInventory((s) => s.godowns)
  const items = useInventory((s) => s.items)
  const stock = useInventory((s) => s.stock)
  const openComposer = useUI((s) => s.openComposer)
  const openPanel = useUI((s) => s.openPanel)
  const { ask, dialog } = useSaleConfirm()

  const [godown, setGodown] = useState("all")
  const [q, setQ] = useState("")
  const [limit, setLimit] = useState(PAGE)
  const now = useNow()

  const setFilters = (next: { status?: StatusFilter; payment?: PaymentFilter }) => {
    const params = new URLSearchParams(searchParams.toString())
    const s = next.status ?? status
    const p = next.payment ?? payment
    if (s === "all") params.delete("status")
    else params.set("status", s)
    if (p === "any") params.delete("payment")
    else params.set("payment", p)
    const qs = params.toString()
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname)
    setLimit(PAGE)
  }

  const clearFilters = () => {
    setFilters({ status: "all", payment: "any" })
    setGodown("all")
    setQ("")
  }

  const rows = useMemo<Row[]>(() => {
    const customerById = new Map(customers.map((c) => [c.id, c]))
    const godownById = new Map(godowns.map((g) => [g.id, g]))
    const itemById = new Map(items.map((i) => [i.id, i]))
    return salesOrders.map((order) => {
      const c = customerById.get(order.customerId)
      const open = order.status === "draft" || order.status === "confirmed"
      return {
        order,
        total: orderTotals(order.lines).total,
        items: itemsText(order.lines, itemById),
        customerName: c?.name ?? "Unknown customer",
        customerCity: c?.city ?? "",
        godownName: godownById.get(order.godownId)?.name ?? "",
        short: open && shortages(stock, order.godownId, order.lines).length > 0,
      }
    })
  }, [salesOrders, customers, godowns, items, stock])

  const stats = useMemo(() => {
    const shippedWithin = (from: number, to: number) =>
      rows
        .filter(({ order }) => order.status === "shipped" && order.shippedAt)
        .filter(({ order }) => {
          const t = new Date(order.shippedAt!).getTime()
          return t > from && t <= to
        })
        .reduce((s, r) => s + r.total, 0)
    const last30 = shippedWithin(now - 30 * DAY, now)
    const prev30 = shippedWithin(now - 60 * DAY, now - 30 * DAY)
    const confirmed = rows.filter((r) => r.order.status === "confirmed")
    const unpaid = rows.filter((r) => r.order.status === "shipped" && r.order.payment === "unpaid")
    const overdue = rows.filter((r) => r.order.status === "shipped" && r.order.payment === "overdue")
    return {
      last30,
      change: prev30 ? ((last30 - prev30) / prev30) * 100 : 0,
      ready: confirmed.length,
      readyValue: confirmed.reduce((s, r) => s + r.total, 0),
      unpaidValue: unpaid.reduce((s, r) => s + r.total, 0),
      unpaidCount: unpaid.length,
      overdueValue: overdue.reduce((s, r) => s + r.total, 0),
      overdueCount: overdue.length,
    }
  }, [rows, now])

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: salesOrders.length, draft: 0, confirmed: 0, shipped: 0, cancelled: 0 }
    for (const o of salesOrders) c[o.status]++
    return c
  }, [salesOrders])

  const needle = q.trim().toLowerCase()
  const filtered = rows.filter(({ order, customerName, customerCity }) => {
    if (status !== "all" && order.status !== status) return false
    if (payment !== "any" && order.payment !== payment) return false
    if (godown !== "all" && order.godownId !== godown) return false
    if (needle) {
      const hay = `${order.number} ${customerName} ${customerCity}`.toLowerCase()
      if (!hay.includes(needle)) return false
    }
    return true
  })

  const visible = filtered.slice(0, limit)
  const filtersOn = status !== "all" || payment !== "any" || godown !== "all" || q.trim() !== ""
  const open = (order: SalesOrder) => openPanel({ type: "sale", id: order.id })

  const summary: {
    key: string
    label: string
    value: number
    kind: "number" | "inr"
    suffix?: string
    footnote?: string
    delta?: { text: string; tone?: "positive" | "negative" | "neutral" }
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
    tone: Tone
    onClick?: () => void
  }[] = [
    {
      key: "ready",
      label: "Ready to ship",
      value: stats.ready,
      kind: "number",
      suffix: stats.ready === 1 ? "order" : "orders",
      footnote: `${inr(stats.readyValue)} worth`,
      icon: PackageIcon,
      tone: "info",
      onClick: () => setFilters({ status: "confirmed", payment: "any" }),
    },
    {
      key: "unpaid",
      label: "Not paid yet",
      value: stats.unpaidValue,
      kind: "inr",
      footnote: `${plural(stats.unpaidCount, "shipped order")} to collect`,
      icon: WalletIcon,
      tone: "warning",
      onClick: () => setFilters({ status: "shipped", payment: "unpaid" }),
    },
    {
      key: "late",
      label: "Payment late",
      value: stats.overdueValue,
      kind: "inr",
      delta: {
        text: stats.overdueCount ? `${plural(stats.overdueCount, "order")} past the due date` : "Nobody is late",
        tone: stats.overdueCount ? "negative" : "positive",
      },
      icon: TriangleAlertIcon,
      tone: stats.overdueCount ? "negative" : "muted",
      onClick: () => setFilters({ status: "shipped", payment: "overdue" }),
    },
    {
      key: "sold",
      label: "Sold in the last 30 days",
      value: stats.last30,
      kind: "inr",
      delta: {
        text: `${pct(stats.change)} compared with the 30 days before`,
        tone: stats.change > 0 ? "positive" : stats.change < 0 ? "negative" : "neutral",
      },
      icon: TrendingUpIcon,
      tone: "positive",
    },
  ]

  return (
    <Page>
      <PageHeader
        icon={ShoppingCartIcon}
        title="Sales"
        description="Orders from your customers. When you ship an order, the items are taken out of stock."
        actions={
          <Button size="lg" onClick={() => openComposer({ type: "sale" })} className="w-full sm:w-auto">
            <PlusIcon strokeWidth={2} />
            {ACTION.newSale}
          </Button>
        }
      />

      {/* Summary: cards on bigger screens, compact tiles on phones */}
      <Stagger className="hidden gap-4 sm:grid sm:grid-cols-2 xl:grid-cols-4">
        {summary.map((s) => (
          <StaggerItem key={s.key} className="flex">
            <StatCard
              label={s.label}
              value={s.value}
              kind={s.kind}
              suffix={s.suffix}
              footnote={s.footnote}
              delta={s.delta}
              icon={s.icon}
              tone={s.tone}
              onClick={s.onClick}
              actionLabel="Show these"
            />
          </StaggerItem>
        ))}
      </Stagger>
      <div className="grid grid-cols-2 gap-2 sm:hidden">
        {summary.map((s) => {
          const body = (
            <>
              <span className="text-[13px] leading-snug text-fg-secondary">{s.label}</span>
              <span className="text-lg leading-tight font-semibold text-foreground tabular">
                {s.kind === "inr" ? inr(s.value) : `${num(s.value)} ${s.suffix ?? ""}`}
              </span>
            </>
          )
          const cls = "flex min-h-[72px] min-w-0 flex-col items-start justify-between gap-1 rounded-xl border border-border bg-card p-3 text-left shadow-card"
          return s.onClick ? (
            <button key={s.key} type="button" onClick={s.onClick} className={cn(cls, "active:bg-raised")}>
              {body}
            </button>
          ) : (
            <div key={s.key} className={cls}>
              {body}
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <Segmented<StatusFilter>
          value={status}
          onValueChange={(v) => setFilters({ status: v })}
          items={[
            { value: "all", label: "All", count: counts.all },
            { value: "draft", label: "Draft", count: counts.draft },
            { value: "confirmed", label: "Ready to ship", count: counts.confirmed },
            { value: "shipped", label: "Shipped", count: counts.shipped },
            { value: "cancelled", label: "Cancelled", count: counts.cancelled },
          ]}
          className="self-start"
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <SearchInput
            value={q}
            onChange={(v) => {
              setQ(v)
              setLimit(PAGE)
            }}
            placeholder="Search by customer, city or sale number…"
            className="sm:w-80 lg:w-96"
          />
          <Select value={payment} onValueChange={(v) => setFilters({ payment: v as PaymentFilter })}>
            <SelectTrigger className="w-full sm:w-auto sm:min-w-48" aria-label="Payment">
              <span className="text-muted-foreground">Payment:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              <SelectItem value="unpaid">Not paid yet</SelectItem>
              <SelectItem value="overdue">Late</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={godown}
            onValueChange={(v) => {
              setGodown(v)
              setLimit(PAGE)
            }}
          >
            <SelectTrigger className="w-full sm:w-auto sm:min-w-48" aria-label="Godown">
              <span className="text-muted-foreground">Godown:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {godowns.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <p className="text-[15px] text-fg-secondary tabular">
            {filtersOn ? (
              <>
                Showing <span className="font-semibold text-foreground">{num(filtered.length)}</span> of {plural(salesOrders.length, "sale")}
              </>
            ) : (
              <>
                <span className="font-semibold text-foreground">{num(salesOrders.length)}</span> {salesOrders.length === 1 ? "sale" : "sales"}
              </>
            )}
          </p>
          {filtersOn ? (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-primary-ink hover:text-primary-ink">
              <XIcon strokeWidth={2} />
              Clear filters
            </Button>
          ) : null}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <Panel>
          {salesOrders.length === 0 ? (
            <EmptyState
              icon={ShoppingCartIcon}
              title="No sales yet"
              description="When a customer orders from you, create a sale here."
              action={
                <Button onClick={() => openComposer({ type: "sale" })}>
                  <PlusIcon strokeWidth={2} />
                  {ACTION.newSale}
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={ShoppingCartIcon}
              title="No sales match"
              description={`Nothing matches${q.trim() ? ` “${q.trim()}”` : ""} with these filters. Clear the filters to see all sales.`}
              action={
                <Button variant="outline" onClick={clearFilters}>
                  <XIcon strokeWidth={2} />
                  Clear filters
                </Button>
              }
            />
          )}
        </Panel>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Desktop and tablet: table */}
          <Panel flush className="hidden md:flex">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-5">Customer</TableHead>
                  <TableHead className="hidden xl:table-cell">Items</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden 2xl:table-cell">Payment</TableHead>
                  <TableHead className="pr-5 text-right">
                    <span className="sr-only">Next step</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence initial={false}>
                  {visible.map((row) => (
                    <SaleRow key={row.order.id} row={row} onOpen={() => open(row.order)} onAsk={(step) => ask(step, row.order)} />
                  ))}
                </AnimatePresence>
              </TableBody>
            </Table>
          </Panel>

          {/* Phones: cards */}
          <ul className="flex flex-col gap-3 md:hidden">
            <AnimatePresence initial={false}>
              {visible.map((row) => (
                <SaleCard key={row.order.id} row={row} onOpen={() => open(row.order)} onAsk={(step) => ask(step, row.order)} />
              ))}
            </AnimatePresence>
          </ul>

          {filtered.length > visible.length ? (
            <div className="flex flex-col items-center gap-2 py-2">
              <span className="text-sm text-muted-foreground tabular">
                {num(visible.length)} of {num(filtered.length)} shown
              </span>
              <Button variant="outline" onClick={() => setLimit((l) => l + PAGE)}>
                Show {Math.min(PAGE, filtered.length - visible.length)} more
              </Button>
            </div>
          ) : null}
        </div>
      )}

      <ConfirmDialog {...dialog} />
    </Page>
  )
}

/* ------------------------------------------------------------------ */
/* The one button per order that matches what needs doing next.        */
/* ------------------------------------------------------------------ */
function RowAction({
  row,
  onOpen,
  onAsk,
  className,
}: {
  row: Row
  onOpen: () => void
  onAsk: (step: SaleStep) => void
  className?: string
}) {
  const { order, short } = row
  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation()
    fn()
  }

  if (order.status === "draft") {
    return (
      <Button variant="outline" size="sm" className={className} onClick={stop(() => onAsk("confirm"))}>
        <CircleCheckIcon strokeWidth={1.75} />
        Confirm
      </Button>
    )
  }
  if (order.status === "confirmed" && short) {
    return (
      <Button
        variant="outline"
        size="sm"
        className={cn("border-warning/40 text-warning hover:bg-warning-soft hover:text-warning", className)}
        onClick={stop(onOpen)}
      >
        <TriangleAlertIcon strokeWidth={1.75} />
        Not enough stock
      </Button>
    )
  }
  if (order.status === "confirmed") {
    return (
      <Button size="sm" className={className} onClick={stop(() => onAsk("ship"))}>
        <TruckIcon strokeWidth={1.75} />
        {ACTION.shipSale}
      </Button>
    )
  }
  if (order.status === "shipped" && order.payment !== "paid") {
    return (
      <Button variant="outline" size="sm" className={className} onClick={stop(() => onAsk("markPaid"))}>
        <IndianRupeeIcon strokeWidth={1.75} />
        {ACTION.markPaid}
      </Button>
    )
  }
  return (
    <Button variant="ghost" size="sm" className={cn("text-fg-secondary", className)} onClick={stop(onOpen)}>
      {ACTION.view}
      <ChevronRightIcon strokeWidth={1.75} />
    </Button>
  )
}

function SaleRow({ row, onOpen, onAsk }: { row: Row; onOpen: () => void; onAsk: (step: SaleStep) => void }) {
  const { order } = row
  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ duration: 0.3, ease: EASE }}
      data-slot="table-row"
      tabIndex={0}
      aria-label={`Open sale ${order.number} for ${row.customerName}`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) onOpen()
      }}
      className="cursor-pointer border-b border-border transition-colors outline-none hover:bg-accent/60 focus-visible:bg-accent focus-visible:shadow-[inset_3px_0_0_var(--ring)]"
    >
      <TableCell className="max-w-[260px] pl-5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[15px] font-medium text-foreground">{row.customerName}</span>
          <Mono className="truncate">
            {order.number} · {dateShort(order.date)}
            <span className="xl:hidden"> · {row.items}</span>
          </Mono>
        </div>
      </TableCell>
      <TableCell className="hidden xl:table-cell">
        <div className="flex flex-col gap-0.5">
          <span className="text-[15px] text-foreground tabular">{row.items}</span>
          {row.godownName ? <Mono>From {row.godownName}</Mono> : null}
        </div>
      </TableCell>
      <TableCell className="text-right text-[15px] font-medium text-foreground tabular">{inr(row.total)}</TableCell>
      <TableCell>
        <div className="flex flex-col items-start gap-1.5">
          <BadgeSwap status={order.status} />
          {order.status !== "cancelled" ? (
            <span className="2xl:hidden">
              <BadgeSwap status={order.payment} />
            </span>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="hidden 2xl:table-cell">
        {order.status === "cancelled" ? <span className="text-sm text-muted-foreground">No payment</span> : <BadgeSwap status={order.payment} />}
      </TableCell>
      <TableCell className="pr-5 text-right">
        <RowAction row={row} onOpen={onOpen} onAsk={onAsk} />
      </TableCell>
    </motion.tr>
  )
}

function SaleCard({ row, onOpen, onAsk }: { row: Row; onOpen: () => void; onAsk: (step: SaleStep) => void }) {
  const { order } = row
  return (
    <motion.li
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ duration: 0.3, ease: EASE }}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label={`Open sale ${order.number} for ${row.customerName}`}
        onClick={onOpen}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
            e.preventDefault()
            onOpen()
          }
        }}
        className="flex cursor-pointer flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card transition-colors outline-none active:bg-raised/60 focus-visible:ring-3 focus-visible:ring-ring/40"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-base font-semibold text-foreground">{row.customerName}</span>
            <Mono>
              {order.number} · {dateShort(order.date)}
            </Mono>
          </div>
          <span className="shrink-0 text-base font-semibold text-foreground tabular">{inr(row.total)}</span>
        </div>
        <p className="text-sm text-fg-secondary tabular">
          {row.items}
          {row.godownName ? ` · from ${row.godownName}` : ""}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <BadgeSwap status={order.status} />
          {order.status !== "cancelled" ? <BadgeSwap status={order.payment} /> : null}
        </div>
        <RowAction row={row} onOpen={onOpen} onAsk={onAsk} className="h-10 w-full text-[15px]" />
      </div>
    </motion.li>
  )
}

/** Status badge that crossfades when the status changes in place. */
function BadgeSwap({ status }: { status: SaleStatus | PaymentStatus }) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={status}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.25, ease: EASE }}
        className="inline-flex"
      >
        <StatusBadge status={status} />
      </motion.span>
    </AnimatePresence>
  )
}
