"use client"

import { useMemo, useState } from "react"
import { ChevronRightIcon, PhoneIcon, ShoppingCartIcon, TriangleAlertIcon, UsersIcon, WalletIcon } from "lucide-react"
import { HelpTip, NextStep } from "@/components/kit/help"
import { EmptyState, Field, SearchInput, Segmented } from "@/components/kit/misc"
import { Page, PageHeader } from "@/components/kit/page"
import { Panel } from "@/components/kit/panel"
import { StatCard } from "@/components/kit/stat-card"
import { StatusBadge } from "@/components/kit/status-badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { orderTotals } from "@/lib/calc"
import { ago, date, dateShort, inr, num, plural } from "@/lib/format"
import { useInventory, useNow, useUI } from "@/lib/store"
import type { Customer, SalesOrder } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ACTION, GLOSSARY } from "@/lib/words"
import { FigureBox, LINE_CLASS, PhoneLink, ResultsLine, SheetSection, phoneMatches, telHref } from "./parts"

const DAY = 86_400_000
const PAGE = 25

type Filter = "all" | "owes" | "late"

const GST_MEANING = GLOSSARY.find((g) => g.term === "GST")?.meaning

interface CustomerRow {
  customer: Customer
  /** newest first */
  orders: SalesOrder[]
  /** orders that are not cancelled */
  orderCount: number
  shippedCount: number
  /** all shipped orders, with GST */
  totalBought: number
  billed90: number
  /** shipped and not paid yet */
  outstanding: number
  /** part of outstanding past the due date */
  overdue: number
  unpaidOrders: number
  lateOrders: number
  creditUsed: number
  lastOrder?: string
}

export function CustomersView() {
  const customers = useInventory((s) => s.customers)
  const salesOrders = useInventory((s) => s.salesOrders)
  const openComposer = useUI((s) => s.openComposer)

  const [q, setQ] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
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
        let totalBought = 0
        let billed90 = 0
        let outstanding = 0
        let overdue = 0
        let shippedCount = 0
        let unpaidOrders = 0
        let lateOrders = 0
        for (const o of live) {
          if (o.status !== "shipped") continue
          const total = orderTotals(o.lines).total
          shippedCount += 1
          totalBought += total
          if (o.shippedAt && new Date(o.shippedAt).getTime() > now - 90 * DAY) billed90 += total
          if (o.payment === "unpaid" || o.payment === "overdue") {
            outstanding += total
            unpaidOrders += 1
          }
          if (o.payment === "overdue") {
            overdue += total
            lateOrders += 1
          }
        }
        return {
          customer,
          orders,
          orderCount: live.length,
          shippedCount,
          totalBought,
          billed90,
          outstanding,
          overdue,
          unpaidOrders,
          lateOrders,
          creditUsed: customer.creditLimit ? outstanding / customer.creditLimit : 0,
          lastOrder: orders[0]?.date,
        }
      })
      .sort((a, b) => b.totalBought - a.totalBought)
  }, [customers, salesOrders, now])

  const cities = useMemo(() => Array.from(new Set(customers.map((c) => c.city))).sort(), [customers])

  const summary = useMemo(() => {
    let toCollect = 0
    let owing = 0
    let late = 0
    let lateAmount = 0
    for (const r of rows) {
      toCollect += r.outstanding
      if (r.outstanding > 0) owing += 1
      if (r.overdue > 0) {
        late += 1
        lateAmount += r.overdue
      }
    }
    return { toCollect, owing, late, lateAmount }
  }, [rows])

  // Search and city first, so the tab counts match what the tabs would show.
  const searched = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows.filter(({ customer: c }) => {
      if (city !== "all" && c.city !== city) return false
      if (!needle) return true
      return `${c.name} ${c.city} ${c.contact} ${c.gstin}`.toLowerCase().includes(needle) || phoneMatches(c.phone, needle)
    })
  }, [rows, q, city])

  const filtered = useMemo(
    () =>
      searched.filter((r) => {
        if (filter === "owes") return r.outstanding > 0
        if (filter === "late") return r.overdue > 0
        return true
      }),
    [searched, filter],
  )

  const visible = filtered.slice(0, limit)
  const selected = rows.find((r) => r.customer.id === selectedId)
  const isFiltered = q.trim() !== "" || city !== "all" || filter !== "all"

  const clearFilters = () => {
    setQ("")
    setCity("all")
    setFilter("all")
    setLimit(PAGE)
  }

  const openCustomer = (id: string) => {
    setSelectedId(id)
    setSheetOpen(true)
  }

  const newSaleFor = (customerId?: string) =>
    openComposer(customerId ? { type: "sale", defaults: { customerId } } : { type: "sale" })

  return (
    <Page>
      <PageHeader
        icon={UsersIcon}
        title="Customers"
        description="Shops and contractors who buy from you, what they bought and what they still owe."
        actions={
          <Button size="lg" onClick={() => newSaleFor()}>
            <ShoppingCartIcon strokeWidth={1.75} />
            {ACTION.newSale}
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard label="Customers" value={rows.length} icon={UsersIcon} tone="info" footnote={`In ${plural(cities.length, "place")}`} />
        <StatCard
          className="order-first col-span-2 sm:order-none sm:col-span-1"
          label="Money to collect"
          value={summary.toCollect}
          kind="inr"
          icon={WalletIcon}
          tone="warning"
          footnote={
            <span className="inline-flex items-center gap-1">
              From {plural(summary.owing, "customer")}
              <HelpTip label="What is money to collect?">
                Bills for orders you have shipped but the customer has not paid yet. Open the sale and press “{ACTION.markPaid}” when the money comes in.
              </HelpTip>
            </span>
          }
        />
        <StatCard
          label="Payments late"
          value={summary.late}
          suffix={summary.late === 1 ? "customer" : "customers"}
          icon={TriangleAlertIcon}
          tone={summary.late ? "negative" : "muted"}
          delta={summary.late ? { text: `${inr(summary.lateAmount)} is late`, tone: "negative" } : { text: "No late payments", tone: "positive" }}
          onClick={summary.late ? () => setFilter("late") : undefined}
          actionLabel="Show them"
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
          <SearchInput
            value={q}
            onChange={(v) => {
              setQ(v)
              setLimit(PAGE)
            }}
            placeholder="Search by name, city or phone…"
            className="lg:w-80"
          />
          <Segmented<Filter>
            value={filter}
            onValueChange={(v) => {
              setFilter(v)
              setLimit(PAGE)
            }}
            items={[
              { value: "all", label: "All", count: searched.length },
              { value: "owes", label: "Owes money", count: searched.filter((r) => r.outstanding > 0).length },
              { value: "late", label: "Payment late", count: searched.filter((r) => r.overdue > 0).length },
            ]}
          />
          <Select
            value={city}
            onValueChange={(v) => {
              setCity(v)
              setLimit(PAGE)
            }}
          >
            <SelectTrigger className="w-full sm:w-48" aria-label="Filter by city">
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
        </div>

        <ResultsLine shown={filtered.length} total={rows.length} noun="customers" filtered={isFiltered} onClear={clearFilters} />

        {filtered.length === 0 ? (
          <Panel>
            <EmptyState
              icon={UsersIcon}
              title="No customers match"
              description={
                filter === "late"
                  ? "Nobody here has a late payment."
                  : filter === "owes"
                    ? "Nobody here owes you money right now."
                    : "Try another name, city or phone number."
              }
              action={
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          </Panel>
        ) : (
          <>
            {/* Phones: one card per customer */}
            <ul className="flex flex-col gap-3 md:hidden">
              {visible.map((r) => (
                <li key={r.customer.id} className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
                  <button
                    type="button"
                    onClick={() => openCustomer(r.customer.id)}
                    className="flex w-full flex-col gap-3 p-4 text-left outline-none focus-visible:bg-accent"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-base leading-snug font-semibold text-foreground">{r.customer.name}</span>
                        <span className="text-[13px] text-muted-foreground">
                          {r.customer.city} · {plural(r.orderCount, "order")}
                        </span>
                      </div>
                      <ChevronRightIcon className="mt-1 size-5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[13px] text-muted-foreground">Total bought</span>
                        <span className="text-[15px] font-medium text-foreground tabular">{inr(r.totalBought)}</span>
                      </div>
                      <div className="flex flex-col items-start gap-1">
                        <span className="text-[13px] text-muted-foreground">Still to pay</span>
                        <span className={cn("text-[15px] font-medium tabular", r.overdue ? "text-negative" : "text-foreground")}>
                          {r.outstanding ? inr(r.outstanding) : "Nothing"}
                        </span>
                        <PayBadge row={r} />
                      </div>
                    </div>
                  </button>
                  <div className="flex gap-2 border-t border-border bg-raised/40 p-3">
                    <Button asChild variant="outline" className="flex-1">
                      <a href={telHref(r.customer.phone)} aria-label={`Call ${r.customer.contact}`}>
                        <PhoneIcon strokeWidth={1.75} />
                        Call
                      </a>
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={() => newSaleFor(r.customer.id)}>
                      <ShoppingCartIcon strokeWidth={1.75} />
                      {ACTION.newSale}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            {/* Tablets and computers: a table */}
            <Panel flush className="hidden md:flex">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5">Customer</TableHead>
                    <TableHead className="hidden xl:table-cell">Phone</TableHead>
                    <TableHead className="hidden text-right xl:table-cell">Orders</TableHead>
                    <TableHead className="text-right">Total bought</TableHead>
                    <TableHead className="text-right">Still to pay</TableHead>
                    <TableHead className="pr-5 text-right">
                      <span className="sr-only">Action</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((r) => (
                    <TableRow
                      key={r.customer.id}
                      tabIndex={0}
                      onClick={() => openCustomer(r.customer.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && e.target === e.currentTarget) openCustomer(r.customer.id)
                      }}
                      className="cursor-pointer outline-none focus-visible:bg-accent"
                    >
                      <TableCell className="max-w-[280px] pl-5">
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate font-medium text-foreground">{r.customer.name}</span>
                          <span className="truncate text-[13px] text-muted-foreground">
                            {r.customer.city} · {r.customer.contact}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        <PhoneLink phone={r.customer.phone} />
                      </TableCell>
                      <TableCell className="hidden text-right text-fg-secondary tabular xl:table-cell">{num(r.orderCount)}</TableCell>
                      <TableCell className="text-right text-foreground tabular">{inr(r.totalBought)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className={cn("font-medium tabular", r.overdue ? "text-negative" : "text-foreground")}>
                            {r.outstanding ? inr(r.outstanding) : "—"}
                          </span>
                          <PayBadge row={r} />
                        </div>
                      </TableCell>
                      <TableCell className="pr-5 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            newSaleFor(r.customer.id)
                          }}
                          onKeyDown={(e) => e.stopPropagation()}
                          aria-label={`New sale for ${r.customer.name}`}
                        >
                          <ShoppingCartIcon strokeWidth={1.75} />
                          {ACTION.newSale}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Panel>

            {filtered.length > visible.length ? (
              <div className="flex justify-center">
                <Button variant="outline" onClick={() => setLimit((l) => l + PAGE)}>
                  Show {Math.min(PAGE, filtered.length - visible.length)} more customers
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[560px]">
          {selected ? (
            <CustomerDetail
              row={selected}
              onNewSale={() => {
                setSheetOpen(false)
                newSaleFor(selected.customer.id)
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

/** What the customer still owes, as a status pill. */
function PayBadge({ row }: { row: CustomerRow }) {
  if (row.overdue > 0) return <StatusBadge status="overdue" />
  if (row.outstanding > 0) return <StatusBadge status="unpaid" />
  if (row.shippedCount > 0) return <StatusBadge status="paid" label="All paid" />
  return <span className="text-[13px] text-muted-foreground">Nothing due</span>
}

function CustomerDetail({ row, onNewSale, onClose }: { row: CustomerRow; onNewSale: () => void; onClose: () => void }) {
  const openPanel = useUI((s) => s.openPanel)
  const godowns = useInventory((s) => s.godowns)
  const { customer: c } = row
  const recent = row.orders.slice(0, 10)
  const firstName = c.contact.split(" ")[0]
  const creditPct = Math.round(row.creditUsed * 100)

  const callButton = (
    <Button asChild variant="outline">
      <a href={telHref(c.phone)}>
        <PhoneIcon strokeWidth={1.75} />
        Call {firstName}
      </a>
    </Button>
  )

  return (
    <>
      <div className="flex flex-col gap-1 border-b border-border px-6 pt-5 pr-14 pb-4">
        <SheetTitle className="text-xl leading-tight font-semibold">{c.name}</SheetTitle>
        <SheetDescription className="text-[15px] text-fg-secondary">
          {c.city} · {plural(row.orderCount, "order")}
          {row.lastOrder ? ` · last order ${ago(row.lastOrder)}` : ""}
        </SheetDescription>
      </div>

      <div className="scroll-quiet flex flex-1 flex-col gap-7 overflow-y-auto px-6 py-5">
        {row.overdue > 0 ? (
          <NextStep tone="negative" title={`${inr(row.overdue)} payment is late`} action={callButton}>
            {`${plural(row.lateOrders, "sale")} past the payment date. Call ${firstName} to collect. When the money comes in, open the sale below and press “${ACTION.markPaid}”.`}
          </NextStep>
        ) : row.outstanding > 0 ? (
          <NextStep tone="info" title={`${inr(row.outstanding)} still to collect`} action={callButton}>
            {`For ${plural(row.unpaidOrders, "shipped sale")} not paid yet. When the money comes in, open the sale below and press “${ACTION.markPaid}”.`}
          </NextStep>
        ) : row.orderCount === 0 ? (
          <NextStep
            tone="info"
            title="No sales yet"
            action={
              <Button onClick={onNewSale}>
                <ShoppingCartIcon strokeWidth={1.75} />
                {ACTION.newSale}
              </Button>
            }
          >
            Create the first sale for this customer.
          </NextStep>
        ) : (
          <NextStep tone="positive" title="All paid">
            Nothing to collect from this customer right now.
          </NextStep>
        )}

        <SheetSection title="Money">
          <div className="grid grid-cols-2 gap-3">
            <FigureBox
              label="Still to pay"
              value={inr(row.outstanding)}
              note={row.unpaidOrders ? plural(row.unpaidOrders, "sale") : "Nothing due"}
              tone={row.overdue ? "negative" : undefined}
            />
            <FigureBox
              label="Payment late"
              value={row.overdue ? inr(row.overdue) : "None"}
              note={row.lateOrders ? plural(row.lateOrders, "sale") : "All on time"}
              tone={row.overdue ? "negative" : undefined}
            />
            <FigureBox label="Bought in the last 90 days" value={inr(row.billed90)} />
            <FigureBox label="Total bought" value={inr(row.totalBought)} note={plural(row.shippedCount, "shipped sale")} />
          </div>
          <div className="flex flex-col gap-2 rounded-xl border border-border px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="flex items-center gap-1 text-[15px] text-fg-secondary">
                Credit limit
                <HelpTip label="What is a credit limit?">
                  The most this customer may owe you at one time. When “Still to pay” gets close to it, collect before you ship more.
                </HelpTip>
              </span>
              <span className="text-[15px] font-semibold text-foreground tabular">{inr(c.creditLimit)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-raised">
              <div
                className={cn(
                  "h-full rounded-full",
                  row.creditUsed >= 1 ? "bg-negative" : row.creditUsed >= 0.85 ? "bg-warning" : "bg-primary",
                )}
                style={{ width: `${Math.min(100, Math.max(row.creditUsed > 0 ? 2 : 0, creditPct))}%` }}
              />
            </div>
            <span className={cn("text-[13px] tabular", row.creditUsed >= 0.85 ? "text-warning" : "text-muted-foreground")}>
              {creditPct}% used by unpaid bills
            </span>
          </div>
        </SheetSection>

        <SheetSection title="Contact">
          <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
            <Field label="Contact person">{c.contact}</Field>
            <Field label="Phone">
              <PhoneLink phone={c.phone} />
            </Field>
            <Field label="City">{c.city}</Field>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="flex items-center gap-1 text-[13px] text-muted-foreground">
                GST number
                <HelpTip label="What is GST?">
                  {GST_MEANING} This number goes on every bill for this customer.
                </HelpTip>
              </span>
              <span className="text-[15px] break-all text-foreground tabular">{c.gstin}</span>
            </div>
          </div>
        </SheetSection>

        <SheetSection title="Recent sales" hint={recent.length ? "Tap a sale to open it" : undefined}>
          {recent.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-[15px] text-muted-foreground">
              No sales yet for this customer.
            </p>
          ) : (
            <ul className="overflow-hidden rounded-xl border border-border">
              {recent.map((o) => {
                const t = orderTotals(o.lines)
                const godown = godowns.find((g) => g.id === o.godownId)?.name
                return (
                  <li key={o.id} className="border-b border-border last:border-b-0">
                    <button
                      type="button"
                      onClick={() => {
                        onClose()
                        openPanel({ type: "sale", id: o.id })
                      }}
                      className={LINE_CLASS}
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-[15px] text-foreground">
                          {date(o.date)} · {plural(o.lines.length, "item")}
                        </span>
                        <span className="truncate text-[13px] text-muted-foreground tabular">
                          Sale {o.number}
                          {godown ? ` · from ${godown}` : ""}
                          {o.status === "shipped" && o.payment !== "paid" ? ` · pay by ${dateShort(o.dueDate)}` : ""}
                        </span>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-[15px] font-medium text-foreground tabular">{inr(t.total)}</span>
                        <StatusBadge status={o.status === "shipped" ? o.payment : o.status} />
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </SheetSection>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
        <Button variant="outline" onClick={onClose} className="mr-auto">
          Close
        </Button>
        <Button onClick={onNewSale}>
          <ShoppingCartIcon strokeWidth={1.75} />
          {ACTION.newSale}
        </Button>
      </div>
    </>
  )
}
