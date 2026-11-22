"use client"

import { useMemo, useState } from "react"
import { PlusIcon, UsersIcon } from "lucide-react"
import { EmptyState, Field, Mono, SearchInput } from "@/components/kit/misc"
import { Page, PageHeader } from "@/components/kit/page"
import { Panel } from "@/components/kit/panel"
import { StatusBadge } from "@/components/kit/status-badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { orderTotals } from "@/lib/calc"
import { ago, dateShort, inr, num } from "@/lib/format"
import { useInventory, useNow, useUI } from "@/lib/store"
import type { Customer, SalesOrder } from "@/lib/types"
import { cn } from "@/lib/utils"

const DAY = 86_400_000
const PAGE = 25

interface CustomerRow {
  customer: Customer
  orders: SalesOrder[]
  orderCount: number
  billed90: number
  outstanding: number
  overdue: number
  creditUsed: number
  lastOrder?: string
}

export function CustomersView() {
  const customers = useInventory((s) => s.customers)
  const salesOrders = useInventory((s) => s.salesOrders)
  const openComposer = useUI((s) => s.openComposer)

  const [q, setQ] = useState("")
  const [city, setCity] = useState("all")
  const [limit, setLimit] = useState(PAGE)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const now = useNow()

  const rows = useMemo<CustomerRow[]>(() => {
    const byCustomer = new Map<string, SalesOrder[]>()
    for (const o of salesOrders) {
      const arr = byCustomer.get(o.customerId) ?? []
      arr.push(o)
      byCustomer.set(o.customerId, arr)
    }
    return customers
      .map((customer) => {
        const orders = (byCustomer.get(customer.id) ?? []).slice().sort((a, b) => (a.date < b.date ? 1 : -1))
        const live = orders.filter((o) => o.status !== "cancelled")
        let billed90 = 0
        let outstanding = 0
        let overdue = 0
        for (const o of live) {
          if (o.status !== "shipped") continue
          const total = orderTotals(o.lines).total
          if (o.shippedAt && new Date(o.shippedAt).getTime() > now - 90 * DAY) billed90 += total
          if (o.payment === "unpaid" || o.payment === "overdue") outstanding += total
          if (o.payment === "overdue") overdue += total
        }
        return {
          customer,
          orders,
          orderCount: live.length,
          billed90,
          outstanding,
          overdue,
          creditUsed: customer.creditLimit ? outstanding / customer.creditLimit : 0,
          lastOrder: orders[0]?.date,
        }
      })
      .sort((a, b) => b.billed90 - a.billed90)
  }, [customers, salesOrders, now])

  const cities = useMemo(() => Array.from(new Set(customers.map((c) => c.city))).sort(), [customers])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows.filter(({ customer: c }) => {
      if (city !== "all" && c.city !== city) return false
      if (needle && !`${c.name} ${c.city} ${c.contact} ${c.gstin}`.toLowerCase().includes(needle)) return false
      return true
    })
  }, [rows, q, city])

  const visible = filtered.slice(0, limit)
  const selected = rows.find((r) => r.customer.id === selectedId)

  const openCustomer = (id: string) => {
    setSelectedId(id)
    setSheetOpen(true)
  }

  return (
    <Page>
      <PageHeader
        title="Customers"
        description="Contractors, builders and retailers buying from Deccan Electric Supply"
        actions={
          <Button onClick={() => openComposer({ type: "sale" })} className="gap-1.5 pr-3 pl-2.5">
            <PlusIcon className="size-4" strokeWidth={1.75} />
            New order
          </Button>
        }
      />

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchInput
            value={q}
            onChange={(v) => {
              setQ(v)
              setLimit(PAGE)
            }}
          />
          <Select
            value={city}
            onValueChange={(v) => {
              setCity(v)
              setLimit(PAGE)
            }}
          >
            <SelectTrigger className="min-w-36" aria-label="City">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All cities</SelectItem>
              {cities.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground tabular sm:ml-auto">
            {num(filtered.length)} of {num(rows.length)} customers
          </span>
        </div>

        <Panel flush>
          {filtered.length === 0 ? (
            <EmptyState
              icon={UsersIcon}
              title="No customers match"
              description="Try another name, city or GSTIN"
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setQ("")
                    setCity("all")
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5">Customer</TableHead>
                    <TableHead className="hidden sm:table-cell">City</TableHead>
                    <TableHead className="hidden md:table-cell">Contact</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Orders</TableHead>
                    <TableHead className="hidden text-right md:table-cell">Billed, last 90 days</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="hidden lg:table-cell">Credit used</TableHead>
                    <TableHead className="hidden pr-5 text-right md:table-cell">Last order</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((r) => (
                    <TableRow
                      key={r.customer.id}
                      tabIndex={0}
                      onClick={() => openCustomer(r.customer.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") openCustomer(r.customer.id)
                      }}
                      className="cursor-pointer outline-none focus-visible:bg-raised focus-visible:shadow-[inset_2px_0_0_var(--ring)]"
                    >
                      <TableCell className="max-w-[260px] pl-5">
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-foreground">{r.customer.name}</span>
                          <Mono className="truncate text-[11px]">{r.customer.gstin}</Mono>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-fg-secondary sm:table-cell">{r.customer.city}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex flex-col">
                          <span className="text-fg-secondary">{r.customer.contact}</span>
                          <Mono className="text-[11px]">{r.customer.phone}</Mono>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-right font-mono text-fg-secondary tabular sm:table-cell">{num(r.orderCount)}</TableCell>
                      <TableCell className="hidden text-right font-mono text-foreground tabular md:table-cell">{inr(r.billed90)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-mono text-foreground tabular">{r.outstanding ? inr(r.outstanding) : "—"}</span>
                          {r.overdue ? <span className="font-mono text-[11px] text-negative tabular">{inr(r.overdue)} overdue</span> : null}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <CreditBar used={r.creditUsed} />
                      </TableCell>
                      <TableCell className="hidden pr-5 text-right text-xs text-muted-foreground md:table-cell">
                        {r.lastOrder ? ago(r.lastOrder) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filtered.length > visible.length ? (
                <div className="flex justify-center border-t border-border px-5 py-3">
                  <Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + PAGE)} className="text-fg-secondary">
                    Show {Math.min(PAGE, filtered.length - visible.length)} more
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </Panel>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[560px]">
          {selected ? (
            <CustomerDetail
              row={selected}
              onNewOrder={() => {
                setSheetOpen(false)
                openComposer({ type: "sale", defaults: { customerId: selected.customer.id } })
              }}
              onClose={() => setSheetOpen(false)}
            />
          ) : (
            <>
              <SheetTitle className="sr-only">Customer</SheetTitle>
              <SheetDescription className="sr-only">No customer selected</SheetDescription>
            </>
          )}
        </SheetContent>
      </Sheet>
    </Page>
  )
}

function CreditBar({ used }: { used: number }) {
  const pct = Math.min(1, used)
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-20 overflow-hidden rounded-full bg-foreground/10">
        <div
          className={cn("h-full rounded-full", used >= 0.85 ? "bg-warning" : "bg-fg-secondary")}
          style={{ width: `${Math.max(used > 0 ? 3 : 0, pct * 100)}%` }}
        />
      </div>
      <span className="font-mono text-xs text-muted-foreground tabular">{Math.round(used * 100)}%</span>
    </div>
  )
}

function CustomerDetail({ row, onNewOrder, onClose }: { row: CustomerRow; onNewOrder: () => void; onClose: () => void }) {
  const openPanel = useUI((s) => s.openPanel)
  const godowns = useInventory((s) => s.godowns)
  const { customer: c } = row
  const recent = row.orders.slice(0, 10)

  return (
    <>
      <div className="flex flex-col gap-1 border-b border-border px-6 pt-5 pb-4 pr-12">
        <Mono>{c.gstin}</Mono>
        <SheetTitle className="text-xl leading-tight font-medium">{c.name}</SheetTitle>
        <SheetDescription>
          {c.city} · {num(row.orderCount)} {row.orderCount === 1 ? "order" : "orders"}
        </SheetDescription>
      </div>

      <div className="scroll-quiet flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
        <section className="grid grid-cols-2 gap-x-4 gap-y-4">
          <Field label="Contact">{c.contact}</Field>
          <Field label="Phone">
            <span className="font-mono text-sm tabular">{c.phone}</span>
          </Field>
          <Field label="Billed, last 90 days">
            <span className="font-mono tabular">{inr(row.billed90)}</span>
          </Field>
          <Field label="Credit limit">
            <span className="font-mono tabular">{inr(c.creditLimit)}</span>
          </Field>
        </section>

        <section className="flex flex-col gap-3 rounded-xl border border-border p-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-fg-secondary">Outstanding</span>
            <span className="font-mono text-lg font-medium text-foreground tabular">{inr(row.outstanding)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
            <div
              className={cn("h-full rounded-full", row.creditUsed >= 0.85 ? "bg-warning" : "bg-fg-secondary")}
              style={{ width: `${Math.min(100, row.creditUsed * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground tabular">
            <span>{Math.round(row.creditUsed * 100)}% of credit limit</span>
            {row.overdue ? <span className="text-negative">{inr(row.overdue)} overdue</span> : <span>Nothing overdue</span>}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-xs text-muted-foreground">Recent orders</h3>
          {recent.length === 0 ? (
            <p className="rounded-xl border border-border px-4 py-6 text-center text-sm text-muted-foreground">No orders yet</p>
          ) : (
            <div className="flex flex-col rounded-xl border border-border">
              {recent.map((o, i) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    onClose()
                    openPanel({ type: "sale", id: o.id })
                  }}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 text-left transition-colors outline-none hover:bg-raised/60 focus-visible:bg-raised",
                    i > 0 && "border-t border-border",
                    i === 0 && "rounded-t-xl",
                    i === recent.length - 1 && "rounded-b-xl",
                  )}
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="font-mono text-xs text-fg-secondary tabular">{o.number}</span>
                    <span className="text-xs text-muted-foreground">
                      {dateShort(o.date)} · {godowns.find((g) => g.id === o.godownId)?.name}
                    </span>
                  </div>
                  <span className="font-mono text-sm text-foreground tabular">{inr(orderTotals(o.lines).total)}</span>
                  <StatusBadge status={o.status === "shipped" ? o.payment : o.status} className="w-[92px] justify-start" />
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
        <Button onClick={onNewOrder} className="gap-1.5 pr-3 pl-2.5">
          <PlusIcon className="size-4" strokeWidth={1.75} />
          New order
        </Button>
      </div>
    </>
  )
}
