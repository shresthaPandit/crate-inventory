"use client"

import { endOfDay } from "date-fns"
import { useMemo, useState } from "react"
import { ChevronRightIcon, ClockIcon, FactoryIcon, PhoneIcon, TriangleAlertIcon, TruckIcon } from "lucide-react"
import { HelpTip, NextStep } from "@/components/kit/help"
import { EmptyState, Field, ItemIcon, SearchInput, Segmented } from "@/components/kit/misc"
import { Page, PageHeader } from "@/components/kit/page"
import { Panel } from "@/components/kit/panel"
import { StatCard } from "@/components/kit/stat-card"
import { StatusBadge } from "@/components/kit/status-badge"
import { StockMeter } from "@/components/kit/stock-meter"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { incomingQty, isPurchaseOverdue, onHand, orderTotals, stockStatus, suggestedReorder } from "@/lib/calc"
import { dateShort, inr, num, plural } from "@/lib/format"
import { useInventory, useNow, useUI } from "@/lib/store"
import type { Category, PurchaseOrder, Supplier } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ACTION } from "@/lib/words"
import { poBadge } from "@/components/purchases/lib"
import { FigureBox, LINE_CLASS, PhoneLink, ResultsLine, SheetSection, phoneMatches, qtyUnit, telHref } from "./parts"

const DAY = 86_400_000

type Filter = "all" | "open" | "late"

const DELIVERY_HELP =
  "How many days this supplier usually takes to deliver after you send the order. Order early enough that stock arrives before you run out."

interface SupplierRow {
  supplier: Supplier
  /** newest first */
  orders: PurchaseOrder[]
  /** orders on the way */
  open: number
  openValue: number
  /** orders on the way and past the promised date */
  late: number
  purchased90: number
  totalSpent: number
  onTime: number | null
  onTimeCount: number
  received: number
}

const usually = (days: number) => `Usually ${plural(days, "day")}`

export function SuppliersView() {
  const suppliers = useInventory((s) => s.suppliers)
  const purchaseOrders = useInventory((s) => s.purchaseOrders)
  const openComposer = useUI((s) => s.openComposer)
  const now = useNow()

  const [q, setQ] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [category, setCategory] = useState<"all" | Category>("all")
  const [selected, setSelected] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const rows = useMemo<SupplierRow[]>(() => {
    const since = now - 90 * DAY
    return suppliers.map((supplier) => {
      const orders = purchaseOrders
        .filter((p) => p.supplierId === supplier.id)
        .sort((a, b) => (a.date < b.date ? 1 : -1))
      const received = orders.filter((p) => p.status === "received" && p.receivedAt)
      const openOrders = orders.filter((p) => p.status === "ordered")
      const onTimeCount = received.filter((p) => new Date(p.receivedAt!).getTime() <= endOfDay(new Date(p.expectedDate)).getTime()).length
      return {
        supplier,
        orders,
        open: openOrders.length,
        openValue: openOrders.reduce((s, p) => s + orderTotals(p.lines).subtotal, 0),
        late: openOrders.filter((p) => isPurchaseOverdue(p, now)).length,
        purchased90: received
          .filter((p) => new Date(p.receivedAt!).getTime() >= since)
          .reduce((s, p) => s + orderTotals(p.lines).subtotal, 0),
        totalSpent: received.reduce((s, p) => s + orderTotals(p.lines).subtotal, 0),
        onTime: received.length ? Math.round((onTimeCount / received.length) * 100) : null,
        onTimeCount,
        received: received.length,
      }
    })
  }, [suppliers, purchaseOrders, now])

  const categories = useMemo(() => Array.from(new Set(suppliers.map((s) => s.category))).sort(), [suppliers])

  const summary = useMemo(
    () =>
      rows.reduce(
        (t, r) => ({ open: t.open + r.open, openValue: t.openValue + r.openValue, late: t.late + r.late }),
        { open: 0, openValue: 0, late: 0 },
      ),
    [rows],
  )

  const searched = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows.filter(({ supplier: s }) => {
      if (category !== "all" && s.category !== category) return false
      if (!needle) return true
      return [s.name, s.city, s.category, s.contact].some((v) => v.toLowerCase().includes(needle)) || phoneMatches(s.phone, needle)
    })
  }, [rows, q, category])

  const filtered = useMemo(
    () =>
      searched.filter((r) => {
        if (filter === "open") return r.open > 0
        if (filter === "late") return r.late > 0
        return true
      }),
    [searched, filter],
  )

  const isFiltered = q.trim() !== "" || category !== "all" || filter !== "all"
  const clearFilters = () => {
    setQ("")
    setCategory("all")
    setFilter("all")
  }

  const openSupplier = (id: string) => {
    setSelected(id)
    setSheetOpen(true)
  }

  const orderFrom = (supplierId?: string) =>
    openComposer(supplierId ? { type: "purchase", defaults: { supplierId } } : { type: "purchase" })

  const current = rows.find((r) => r.supplier.id === selected)

  return (
    <Page>
      <PageHeader
        icon={FactoryIcon}
        title="Suppliers"
        description="Companies you buy stock from, and orders that are on the way."
        actions={
          <Button size="lg" onClick={() => orderFrom()}>
            <TruckIcon strokeWidth={1.75} />
            {ACTION.newPurchase}
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard
          className="col-span-2 sm:col-span-1"
          label="Suppliers"
          value={rows.length}
          icon={FactoryIcon}
          tone="info"
          footnote={`Supplying ${plural(categories.length, "kind of item", "kinds of items")}`}
        />
        <StatCard
          label="Orders on the way"
          value={summary.open}
          icon={ClockIcon}
          tone="info"
          footnote={summary.open ? `${inr(summary.openValue)} worth` : "Nothing ordered right now"}
          onClick={summary.open ? () => setFilter("open") : undefined}
          actionLabel="Show them"
        />
        <StatCard
          label="Late orders"
          value={summary.late}
          icon={TriangleAlertIcon}
          tone={summary.late ? "negative" : "muted"}
          delta={summary.late ? { text: "Past the promised date", tone: "negative" } : { text: "Nothing late", tone: "positive" }}
          onClick={summary.late ? () => setFilter("late") : undefined}
          actionLabel="Show them"
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
          <SearchInput value={q} onChange={setQ} placeholder="Search by name, city or phone…" className="lg:w-80" />
          <Segmented<Filter>
            value={filter}
            onValueChange={setFilter}
            items={[
              { value: "all", label: "All", count: searched.length },
              { value: "open", label: "Orders on the way", count: searched.filter((r) => r.open > 0).length },
              { value: "late", label: "Late orders", count: searched.filter((r) => r.late > 0).length },
            ]}
          />
          <Select value={category} onValueChange={(v) => setCategory(v as "all" | Category)}>
            <SelectTrigger className="w-full sm:w-56" aria-label="Filter by what they supply">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All kinds of items</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <ResultsLine shown={filtered.length} total={rows.length} noun="suppliers" filtered={isFiltered} onClear={clearFilters} />

        {filtered.length === 0 ? (
          <Panel>
            <EmptyState
              icon={FactoryIcon}
              title="No suppliers match"
              description={
                filter === "late"
                  ? "No supplier here has a late order."
                  : filter === "open"
                    ? "No supplier here has an order on the way."
                    : "Try another name, city, phone number or kind of item."
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
            {/* Phones: one card per supplier */}
            <ul className="flex flex-col gap-3 md:hidden">
              {filtered.map((r) => {
                const s = r.supplier
                return (
                  <li key={s.id} className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
                    <button
                      type="button"
                      onClick={() => openSupplier(s.id)}
                      className="flex w-full flex-col gap-3 p-4 text-left outline-none focus-visible:bg-accent"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="text-base leading-snug font-semibold text-foreground">{s.name}</span>
                          <span className="text-[13px] text-muted-foreground">
                            {s.city} · {s.category}
                          </span>
                        </div>
                        <ChevronRightIcon className="mt-1 size-5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[13px] text-muted-foreground">Delivery time</span>
                          <span className="text-[15px] text-foreground">{usually(s.leadTimeDays)}</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[13px] text-muted-foreground">Total spent</span>
                          <span className="text-[15px] font-medium text-foreground tabular">{inr(r.totalSpent)}</span>
                        </div>
                      </div>
                      <OpenOrders row={r} />
                    </button>
                    <div className="flex gap-2 border-t border-border bg-raised/40 p-3">
                      <Button asChild variant="outline" className="flex-1">
                        <a href={telHref(s.phone)} aria-label={`Call ${s.contact} at ${s.name}`}>
                          <PhoneIcon strokeWidth={1.75} />
                          Call
                        </a>
                      </Button>
                      <Button variant="outline" className="flex-[2]" onClick={() => orderFrom(s.id)}>
                        <TruckIcon strokeWidth={1.75} />
                        {ACTION.newPurchase}
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>

            {/* Tablets and computers: a table */}
            <Panel flush className="hidden md:flex">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5">Supplier</TableHead>
                    <TableHead className="hidden xl:table-cell">Phone</TableHead>
                    <TableHead className="hidden xl:table-cell">
                      <span className="inline-flex items-center gap-1">
                        Delivery time
                        <HelpTip label="What is delivery time?">{DELIVERY_HELP}</HelpTip>
                      </span>
                    </TableHead>
                    <TableHead>Orders on the way</TableHead>
                    <TableHead className="text-right">
                      <span className="inline-flex items-center gap-1">
                        Total spent
                        <HelpTip label="What is total spent?">
                          What you paid this supplier for all goods that have arrived, before GST.
                        </HelpTip>
                      </span>
                    </TableHead>
                    <TableHead className="pr-5 text-right">
                      <span className="sr-only">Action</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const s = r.supplier
                    const open = () => openSupplier(s.id)
                    return (
                      <TableRow
                        key={s.id}
                        tabIndex={0}
                        onClick={open}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && e.target === e.currentTarget) open()
                        }}
                        className="cursor-pointer outline-none focus-visible:bg-accent"
                      >
                        <TableCell className="max-w-[260px] pl-5">
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="truncate font-medium text-foreground">{s.name}</span>
                            <span className="truncate text-[13px] text-muted-foreground">
                              {s.city} · {s.category}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden xl:table-cell">
                          <PhoneLink phone={s.phone} />
                        </TableCell>
                        <TableCell className="hidden text-fg-secondary xl:table-cell">{usually(s.leadTimeDays)}</TableCell>
                        <TableCell>
                          <OpenOrders row={r} />
                        </TableCell>
                        <TableCell className="text-right text-foreground tabular">{inr(r.totalSpent)}</TableCell>
                        <TableCell className="pr-5 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              orderFrom(s.id)
                            }}
                            onKeyDown={(e) => e.stopPropagation()}
                            aria-label={`Order from ${s.name}`}
                          >
                            <TruckIcon strokeWidth={1.75} />
                            {ACTION.newPurchase}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </Panel>
          </>
        )}
      </div>

      <SupplierSheet
        row={current}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onOrder={(supplierId, lines) => {
          setSheetOpen(false)
          openComposer({ type: "purchase", defaults: lines ? { supplierId, lines } : { supplierId } })
        }}
      />
    </Page>
  )
}

/** "2 on the way" pill, red when one of them is late; a quiet line when nothing is ordered. */
function OpenOrders({ row }: { row: SupplierRow }) {
  if (row.late > 0) {
    return (
      <span className="flex flex-wrap items-center gap-1.5">
        <StatusBadge status="late" label={`${num(row.late)} late`} />
        {row.open > row.late ? <StatusBadge status="ordered" label={`${num(row.open - row.late)} on the way`} /> : null}
      </span>
    )
  }
  if (row.open > 0) return <StatusBadge status="ordered" label={`${num(row.open)} on the way`} />
  return <span className="text-[13px] text-muted-foreground">Nothing on the way</span>
}

function SupplierSheet({
  row,
  open,
  onOpenChange,
  onOrder,
}: {
  row: SupplierRow | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
  onOrder: (supplierId: string, lines?: { itemId: string; qty: number; rate: number }[]) => void
}) {
  const items = useInventory((s) => s.items)
  const stock = useInventory((s) => s.stock)
  const purchaseOrders = useInventory((s) => s.purchaseOrders)
  const openPanel = useUI((s) => s.openPanel)

  const supplied = useMemo(() => (row ? items.filter((i) => i.supplierId === row.supplier.id) : []), [items, row])

  if (!row) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[560px]">
          <div className="border-b border-border px-6 pt-5 pb-4">
            <SheetTitle className="text-lg font-semibold">Supplier not found</SheetTitle>
            <SheetDescription className="text-[15px]">Close this and pick a supplier from the list.</SheetDescription>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  const s = row.supplier
  const recent = row.orders.slice(0, 6)
  const firstName = s.contact.split(" ")[0]

  const callButton = (
    <Button asChild variant="outline">
      <a href={telHref(s.phone)}>
        <PhoneIcon strokeWidth={1.75} />
        Call {firstName}
      </a>
    </Button>
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[560px]">
        <div className="flex flex-col gap-1 border-b border-border px-6 pt-5 pr-14 pb-4">
          <SheetTitle className="text-xl leading-tight font-semibold">{s.name}</SheetTitle>
          <SheetDescription className="text-[15px] text-fg-secondary">
            {s.city} · supplies {s.category.toLowerCase()}
          </SheetDescription>
        </div>

        <div className="scroll-quiet flex flex-1 flex-col gap-7 overflow-y-auto px-6 py-5">
          {row.late > 0 ? (
            <NextStep tone="negative" title={`${plural(row.late, "order")} late`} action={callButton}>
              {`These should have arrived already. Call ${firstName} to ask when the goods will come. When they arrive, open the order and press “${ACTION.receivePurchase}”.`}
            </NextStep>
          ) : row.open > 0 ? (
            <NextStep tone="info" title={`${plural(row.open, "order")} on the way`}>
              {`When the goods arrive, open the order below and press “${ACTION.receivePurchase}”. Stock will go up.`}
            </NextStep>
          ) : (
            <NextStep
              tone="info"
              title="Nothing on the way"
              action={
                <Button onClick={() => onOrder(s.id)}>
                  <TruckIcon strokeWidth={1.75} />
                  {ACTION.newPurchase}
                </Button>
              }
            >
              {`Order from ${s.name} when their items run low. Delivery usually takes ${plural(s.leadTimeDays, "day")}.`}
            </NextStep>
          )}

          <SheetSection title="Deliveries">
            <div className="grid grid-cols-2 gap-3">
              <FigureBox
                label={
                  <>
                    Delivery time
                    <HelpTip label="What is delivery time?">{DELIVERY_HELP}</HelpTip>
                  </>
                }
                value={usually(s.leadTimeDays)}
              />
              <FigureBox
                label={
                  <>
                    Arrived on time
                    <HelpTip label="What does on time mean?">
                      Goods that arrived on or before the date the supplier promised.
                    </HelpTip>
                  </>
                }
                value={row.onTime === null ? "No deliveries yet" : `${row.onTime}%`}
                note={row.onTime === null ? undefined : `${num(row.onTimeCount)} of ${plural(row.received, "delivery", "deliveries")}`}
                tone={row.onTime !== null && row.onTime < 75 ? "warning" : undefined}
              />
              <FigureBox
                label="On the way"
                value={plural(row.open, "order")}
                note={row.open ? `${inr(row.openValue)} worth` : undefined}
                tone={row.late ? "negative" : undefined}
              />
              <FigureBox label="Spent in the last 90 days" value={inr(row.purchased90)} note={`${inr(row.totalSpent)} in total`} />
            </div>
          </SheetSection>

          <SheetSection title="Contact">
            <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
              <Field label="Contact person">{s.contact}</Field>
              <Field label="Phone">
                <PhoneLink phone={s.phone} />
              </Field>
              <Field label="City">{s.city}</Field>
              <Field label="What they supply">{s.category}</Field>
            </div>
          </SheetSection>

          <SheetSection title="Items from this supplier" hint="In stock, all godowns together">
            {supplied.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-[15px] text-muted-foreground">
                No items are linked to this supplier.
              </p>
            ) : (
              <ul className="overflow-hidden rounded-xl border border-border">
                {supplied.map((it) => {
                  const qty = onHand(stock, it.id)
                  const status = stockStatus(qty, it.minLevel)
                  const toOrder = status === "ok" ? 0 : suggestedReorder(it, qty, incomingQty(purchaseOrders, it.id))
                  return (
                    <li key={it.id} className="flex items-center border-b border-border last:border-b-0">
                      <button
                        type="button"
                        onClick={() => {
                          onOpenChange(false)
                          openPanel({ type: "item", id: it.id })
                        }}
                        className={cn(LINE_CLASS, "min-w-0 flex-1")}
                      >
                        <ItemIcon category={it.category} size="sm" />
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="truncate text-[15px] text-foreground">{it.name}</span>
                          <span className="truncate text-[13px] text-muted-foreground tabular">
                            {qtyUnit(qty, it.unit)} in stock · keep at least {num(it.minLevel)}
                          </span>
                        </span>
                        {status === "ok" ? (
                          <StockMeter qty={qty} min={it.minLevel} size="sm" className="hidden sm:block" />
                        ) : (
                          <StatusBadge status={status} />
                        )}
                      </button>
                      {toOrder > 0 ? (
                        <div className="shrink-0 pr-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onOrder(s.id, [{ itemId: it.id, qty: toOrder, rate: it.cost }])}
                            aria-label={`${ACTION.reorder}: ${it.name}`}
                          >
                            {ACTION.reorder}
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </SheetSection>

          <SheetSection title="Recent orders" hint={recent.length ? "Tap an order to open it" : undefined}>
            {recent.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-[15px] text-muted-foreground">
                No orders yet from this supplier.
              </p>
            ) : (
              <ul className="overflow-hidden rounded-xl border border-border">
                {recent.map((po) => (
                  <li key={po.id} className="border-b border-border last:border-b-0">
                    <button
                      type="button"
                      onClick={() => {
                        onOpenChange(false)
                        openPanel({ type: "purchase", id: po.id })
                      }}
                      className={LINE_CLASS}
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-[15px] text-foreground">
                          Ordered {dateShort(po.date)} · {plural(po.lines.length, "item")}
                        </span>
                        <span className="truncate text-[13px] text-muted-foreground tabular">
                          Order {po.number}
                          {po.status === "received" && po.receivedAt
                            ? ` · arrived ${dateShort(po.receivedAt)}`
                            : po.status === "ordered"
                              ? ` · due ${dateShort(po.expectedDate)}`
                              : ""}
                        </span>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-[15px] font-medium text-foreground tabular">{inr(orderTotals(po.lines).subtotal)}</span>
                        <StatusBadge status={poBadge(po)} />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </SheetSection>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="mr-auto">
            Close
          </Button>
          <Button onClick={() => onOrder(s.id)}>
            <TruckIcon strokeWidth={1.75} />
            {ACTION.newPurchase}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
