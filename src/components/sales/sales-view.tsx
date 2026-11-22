"use client"

import { AnimatePresence, motion } from "motion/react"
import { useMemo, useState } from "react"
import { MoreHorizontalIcon, PlusIcon, ReceiptTextIcon } from "lucide-react"
import { EmptyState, Mono, SearchInput, Segmented } from "@/components/kit/misc"
import { EASE, Page, PageHeader, Stagger, StaggerItem } from "@/components/kit/page"
import { Panel } from "@/components/kit/panel"
import { StatCard } from "@/components/kit/stat-card"
import { StatusBadge } from "@/components/kit/status-badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { orderTotals } from "@/lib/calc"
import { dateShort, inr, num, pct, plural } from "@/lib/format"
import { useInventory, useNow, useUI } from "@/lib/store"
import type { PaymentStatus, SaleStatus, SalesOrder } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useSaleActions } from "./use-sale-actions"

type StatusFilter = "all" | SaleStatus
type PaymentFilter = "any" | PaymentStatus

const DAY = 86_400_000
const PAGE = 25

export function SalesView() {
  const salesOrders = useInventory((s) => s.salesOrders)
  const customers = useInventory((s) => s.customers)
  const godowns = useInventory((s) => s.godowns)
  const openComposer = useUI((s) => s.openComposer)
  const openPanel = useUI((s) => s.openPanel)
  const actions = useSaleActions()

  const [status, setStatus] = useState<StatusFilter>("all")
  const [payment, setPayment] = useState<PaymentFilter>("any")
  const [godown, setGodown] = useState("all")
  const [q, setQ] = useState("")
  const [limit, setLimit] = useState(PAGE)
  const now = useNow()

  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers])
  const godownById = useMemo(() => new Map(godowns.map((g) => [g.id, g])), [godowns])

  // totals are used by stats, table and search, so compute once
  const rows = useMemo(
    () => salesOrders.map((o) => ({ order: o, totals: orderTotals(o.lines) })),
    [salesOrders],
  )

  const stats = useMemo(() => {
    const shippedWithin = (from: number, to: number) =>
      rows
        .filter(({ order }) => order.status === "shipped" && order.shippedAt)
        .filter(({ order }) => {
          const t = new Date(order.shippedAt!).getTime()
          return t > from && t <= to
        })
        .reduce((s, r) => s + r.totals.total, 0)
    const last30 = shippedWithin(now - 30 * DAY, now)
    const prev30 = shippedWithin(now - 60 * DAY, now - 30 * DAY)
    const confirmed = rows.filter((r) => r.order.status === "confirmed")
    const unpaid = rows.filter((r) => r.order.status === "shipped" && r.order.payment === "unpaid")
    const overdue = rows.filter((r) => r.order.status === "shipped" && r.order.payment === "overdue")
    return {
      last30,
      change: prev30 ? ((last30 - prev30) / prev30) * 100 : 0,
      awaiting: confirmed.length,
      awaitingValue: confirmed.reduce((s, r) => s + r.totals.total, 0),
      unpaidValue: unpaid.reduce((s, r) => s + r.totals.total, 0),
      unpaidCount: unpaid.length,
      overdueValue: overdue.reduce((s, r) => s + r.totals.total, 0),
      overdueCount: overdue.length,
    }
  }, [rows, now])

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: salesOrders.length, draft: 0, confirmed: 0, shipped: 0, cancelled: 0 }
    for (const o of salesOrders) c[o.status]++
    return c
  }, [salesOrders])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows.filter(({ order }) => {
      if (status !== "all" && order.status !== status) return false
      if (payment !== "any" && order.payment !== payment) return false
      if (godown !== "all" && order.godownId !== godown) return false
      if (needle) {
        const c = customerById.get(order.customerId)
        const hay = `${order.number} ${c?.name ?? ""} ${c?.city ?? ""}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
  }, [rows, status, payment, godown, q, customerById])

  const visible = filtered.slice(0, limit)
  const filtersOn = status !== "all" || payment !== "any" || godown !== "all" || q.trim() !== ""

  const resetLimit = () => setLimit(PAGE)

  return (
    <Page>
      <PageHeader
        title="Sales"
        description="Orders and invoices. Shipping an order takes its stock out of the godown"
        actions={
          <Button onClick={() => openComposer({ type: "sale" })} className="gap-1.5 pr-3 pl-2.5">
            <PlusIcon className="size-4" strokeWidth={1.75} />
            New order
          </Button>
        }
      />

      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StaggerItem>
          <StatCard
            label="Shipped, last 30 days"
            value={stats.last30}
            kind="inr"
            emphasis
            delta={{
              text: `${pct(stats.change)} vs previous 30 days`,
              tone: stats.change > 0 ? "positive" : stats.change < 0 ? "negative" : "neutral",
            }}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label="Awaiting shipment"
            value={stats.awaiting}
            suffix={stats.awaiting === 1 ? "order" : "orders"}
            footnote={`${inr(stats.awaitingValue)} confirmed`}
            onClick={() => {
              setStatus("confirmed")
              resetLimit()
            }}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label="Unpaid invoices"
            value={stats.unpaidValue}
            kind="inr"
            footnote={plural(stats.unpaidCount, "invoice")}
            onClick={() => {
              setStatus("shipped")
              setPayment("unpaid")
              resetLimit()
            }}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label="Overdue"
            value={stats.overdueValue}
            kind="inr"
            delta={{ text: `${plural(stats.overdueCount, "invoice")} past due`, tone: stats.overdueCount ? "negative" : "neutral" }}
            onClick={() => {
              setStatus("shipped")
              setPayment("overdue")
              resetLimit()
            }}
          />
        </StaggerItem>
      </Stagger>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <Segmented<StatusFilter>
            value={status}
            onValueChange={(v) => {
              setStatus(v)
              resetLimit()
            }}
            items={[
              { value: "all", label: "All", count: counts.all },
              { value: "draft", label: "Draft", count: counts.draft },
              { value: "confirmed", label: "Confirmed", count: counts.confirmed },
              { value: "shipped", label: "Shipped", count: counts.shipped },
              { value: "cancelled", label: "Cancelled", count: counts.cancelled },
            ]}
          />
          <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
            <Select
              value={payment}
              onValueChange={(v) => {
                setPayment(v as PaymentFilter)
                resetLimit()
              }}
            >
              <SelectTrigger className="min-w-36" aria-label="Payment">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any payment</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={godown}
              onValueChange={(v) => {
                setGodown(v)
                resetLimit()
              }}
            >
              <SelectTrigger className="min-w-36" aria-label="Godown">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All godowns</SelectItem>
                {godowns.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <SearchInput
              value={q}
              onChange={(v) => {
                setQ(v)
                resetLimit()
              }}
              className="sm:w-60"
            />
          </div>
        </div>

        <Panel flush>
          {filtered.length === 0 ? (
            <EmptyState
              icon={ReceiptTextIcon}
              title="No orders match"
              description="Try another status, godown or search"
              action={
                filtersOn ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStatus("all")
                      setPayment("any")
                      setGodown("all")
                      setQ("")
                      resetLimit()
                    }}
                  >
                    Clear filters
                  </Button>
                ) : null
              }
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5">Order</TableHead>
                    <TableHead className="hidden md:table-cell">Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="hidden md:table-cell">Godown</TableHead>
                    <TableHead className="hidden text-right lg:table-cell">Units</TableHead>
                    <TableHead className="text-right">Amount incl GST</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Payment</TableHead>
                    <TableHead className="w-12 pr-3">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence initial={false}>
                    {visible.map(({ order, totals }) => (
                      <SaleRow
                        key={order.id}
                        order={order}
                        units={totals.units}
                        total={totals.total}
                        customerName={customerById.get(order.customerId)?.name ?? "Unknown customer"}
                        customerCity={customerById.get(order.customerId)?.city ?? ""}
                        godownName={godownById.get(order.godownId)?.name ?? ""}
                        onOpen={() => openPanel({ type: "sale", id: order.id })}
                        actions={actions}
                      />
                    ))}
                  </AnimatePresence>
                </TableBody>
              </Table>
              <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3 text-xs text-muted-foreground">
                <span className="tabular">
                  Showing {num(visible.length)} of {num(filtered.length)}
                </span>
                {filtered.length > visible.length ? (
                  <Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + PAGE)} className="text-fg-secondary">
                    Show {Math.min(PAGE, filtered.length - visible.length)} more
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </Panel>
      </div>
    </Page>
  )
}

function SaleRow({
  order,
  units,
  total,
  customerName,
  customerCity,
  godownName,
  onOpen,
  actions,
}: {
  order: SalesOrder
  units: number
  total: number
  customerName: string
  customerCity: string
  godownName: string
  onOpen: () => void
  actions: ReturnType<typeof useSaleActions>
}) {
  const open = order.status === "draft" || order.status === "confirmed"
  const canPay = order.status === "shipped" && order.payment !== "paid"

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ duration: 0.3, ease: EASE }}
      data-slot="table-row"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) onOpen()
      }}
      className="cursor-pointer border-b border-border transition-colors outline-none hover:bg-raised/60 focus-visible:bg-raised focus-visible:shadow-[inset_2px_0_0_var(--ring)]"
    >
      <TableCell className="pl-5">
        <Mono className="text-fg-secondary">{order.number}</Mono>
      </TableCell>
      <TableCell className="hidden text-fg-secondary tabular md:table-cell">{dateShort(order.date)}</TableCell>
      <TableCell className="max-w-[220px]">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-foreground">{customerName}</span>
          <span className="truncate text-xs text-muted-foreground">{customerCity}</span>
        </div>
      </TableCell>
      <TableCell className="hidden text-fg-secondary md:table-cell">{godownName}</TableCell>
      <TableCell className="hidden text-right font-mono text-fg-secondary tabular lg:table-cell">{num(units)}</TableCell>
      <TableCell className="text-right font-mono text-foreground tabular">{inr(total)}</TableCell>
      <TableCell>
        <BadgeSwap status={order.status} />
      </TableCell>
      <TableCell className="hidden md:table-cell">
        {order.status === "cancelled" ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <BadgeSwap status={order.payment} />
        )}
      </TableCell>
      <TableCell className="pr-3" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${order.number}`} className="text-muted-foreground hover:text-foreground">
              <MoreHorizontalIcon className="size-4" strokeWidth={1.5} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onSelect={onOpen}>Open</DropdownMenuItem>
            <DropdownMenuItem disabled={!open} onSelect={() => actions.ship(order.id)}>
              Ship order
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!canPay} onSelect={() => actions.markPaid(order.id)}>
              Mark paid
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" disabled={!open} onSelect={() => actions.cancel(order.id)}>
              Cancel order
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </motion.tr>
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
        className={cn("inline-flex")}
      >
        <StatusBadge status={status} />
      </motion.span>
    </AnimatePresence>
  )
}
