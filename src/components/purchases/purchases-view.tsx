"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { Suspense, useMemo, useState } from "react"
import { ArrowRightIcon, CalendarClockIcon, ClockIcon, PackageCheckIcon, PlusIcon, TriangleAlertIcon, TruckIcon, XIcon } from "lucide-react"
import { EmptyState, Mono, SearchInput, Segmented } from "@/components/kit/misc"
import { Page, PageHeader, Stagger, StaggerItem } from "@/components/kit/page"
import { Panel } from "@/components/kit/panel"
import { StatCard } from "@/components/kit/stat-card"
import { StatusBadge, TONE_PILL } from "@/components/kit/status-badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { isPurchaseOverdue, orderTotals, startOfDayMs } from "@/lib/calc"
import { date, dateShort, inr, num, plural } from "@/lib/format"
import { useInventory, useNow, useUI } from "@/lib/store"
import type { PurchaseOrder } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ACTION } from "@/lib/words"
import { expectedHint, HINT_CLASS, itemsText, linesQtyText, poBadge } from "./lib"
import { usePurchaseActions } from "./purchase-actions"

type StatusFilter = "all" | "ordered" | "late" | "received" | "cancelled"

const STATUS_VALUES: StatusFilter[] = ["all", "ordered", "late", "received", "cancelled"]

function parseStatus(v: string | null): StatusFilter {
  return v && (STATUS_VALUES as string[]).includes(v) ? (v as StatusFilter) : "all"
}

const DAY = 86_400_000
const PAGE = 25

export function PurchasesView() {
  // the status filter lives in the URL, so Home can link straight to late or on-the-way orders
  return (
    <Suspense fallback={null}>
      <PurchasesViewInner />
    </Suspense>
  )
}

function PurchasesViewInner() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const status = parseStatus(searchParams.get("status"))

  const purchaseOrders = useInventory((s) => s.purchaseOrders)
  const suppliers = useInventory((s) => s.suppliers)
  const godowns = useInventory((s) => s.godowns)
  const items = useInventory((s) => s.items)
  const openPanel = useUI((s) => s.openPanel)
  const openComposer = useUI((s) => s.openComposer)
  const actions = usePurchaseActions()
  const now = useNow()

  const [supplierId, setSupplierId] = useState("all")
  const [godownId, setGodownId] = useState("all")
  const [q, setQ] = useState("")
  const [limit, setLimit] = useState(PAGE)

  const setStatus = (v: StatusFilter) => {
    const params = new URLSearchParams(searchParams.toString())
    if (v === "all") params.delete("status")
    else params.set("status", v)
    const qs = params.toString()
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname)
    setLimit(PAGE)
  }

  const supplierById = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers])
  const godownById = useMemo(() => new Map(godowns.map((g) => [g.id, g])), [godowns])
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])

  const stats = useMemo(() => {
    const pending = purchaseOrders.filter((p) => p.status === "ordered")
    const late = pending.filter((p) => isPurchaseOverdue(p, now))
    const received30 = purchaseOrders.filter(
      (p) => p.status === "received" && p.receivedAt && new Date(p.receivedAt).getTime() >= now - 30 * DAY,
    )
    const today0 = startOfDayMs(now)
    const next = pending
      .filter((p) => new Date(p.expectedDate).getTime() >= today0)
      .sort((a, b) => (a.expectedDate < b.expectedDate ? -1 : 1))[0]
    return {
      pending: pending.length,
      pendingValue: pending.reduce((s, p) => s + orderTotals(p.lines).subtotal, 0),
      late: late.length,
      received30: received30.reduce((s, p) => s + orderTotals(p.lines).subtotal, 0),
      received30Count: received30.length,
      next,
    }
  }, [purchaseOrders, now])

  const counts = useMemo(
    () => ({
      all: purchaseOrders.length,
      ordered: purchaseOrders.filter((p) => p.status === "ordered").length,
      late: purchaseOrders.filter((p) => isPurchaseOverdue(p, now)).length,
      received: purchaseOrders.filter((p) => p.status === "received").length,
      cancelled: purchaseOrders.filter((p) => p.status === "cancelled").length,
    }),
    [purchaseOrders, now],
  )

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const rows = purchaseOrders.filter((p) => {
      if (status === "late" && !isPurchaseOverdue(p, now)) return false
      if (status !== "all" && status !== "late" && p.status !== status) return false
      if (supplierId !== "all" && p.supplierId !== supplierId) return false
      if (godownId !== "all" && p.godownId !== godownId) return false
      if (!needle) return true
      const sup = supplierById.get(p.supplierId)?.name.toLowerCase() ?? ""
      if (p.number.toLowerCase().includes(needle) || sup.includes(needle)) return true
      return p.lines.some((l) => {
        const it = itemById.get(l.itemId)
        return it ? it.name.toLowerCase().includes(needle) || it.sku.toLowerCase().includes(needle) : false
      })
    })
    // orders still on the way: the one due first comes first
    if (status === "ordered" || status === "late") rows.sort((a, b) => (a.expectedDate < b.expectedDate ? -1 : 1))
    return rows
  }, [purchaseOrders, status, supplierId, godownId, q, supplierById, itemById, now])

  const visible = filtered.slice(0, limit)
  const filtersActive = status !== "all" || supplierId !== "all" || godownId !== "all" || q !== ""

  const clearFilters = () => {
    setStatus("all")
    setSupplierId("all")
    setGodownId("all")
    setQ("")
  }

  const newOrder = () => openComposer({ type: "purchase" })
  const open = (po: PurchaseOrder) => openPanel({ type: "purchase", id: po.id })

  const nextSupplier = stats.next ? supplierById.get(stats.next.supplierId)?.name : undefined
  const nextHint = stats.next ? expectedHint(stats.next, now) : null

  const rowData = (po: PurchaseOrder) => {
    const badge = poBadge(po, now)
    const hint = expectedHint(po, now)
    // table: a date with one line of plain words under it
    const when =
      po.status === "received"
        ? { date: po.receivedAt ? dateShort(po.receivedAt) : "—", text: "Received", tone: "text-positive" }
        : po.status === "cancelled"
          ? { date: dateShort(po.expectedDate), text: "Cancelled", tone: "text-muted-foreground" }
          : { date: dateShort(po.expectedDate), text: hint?.text ?? "", tone: hint ? HINT_CLASS[hint.tone] : "" }
    // cards: the same as one sentence
    const whenLine =
      po.status === "received"
        ? { text: po.receivedAt ? `Received on ${dateShort(po.receivedAt)}` : "Received", tone: "text-positive" }
        : po.status === "cancelled"
          ? { text: "Cancelled. Stock did not change.", tone: "text-muted-foreground" }
          : {
              text: hint?.tone === "negative" ? `${hint.text} · was due ${when.date}` : `${hint?.text ?? "Expected"} · ${when.date}`,
              tone: when.tone,
            }
    return {
      badge,
      when,
      whenLine,
      supplier: supplierById.get(po.supplierId)?.name ?? "Supplier",
      godown: godownById.get(po.godownId)?.name ?? "godown",
      amount: inr(orderTotals(po.lines).subtotal),
      qty: `${itemsText(po.lines.length)} · ${linesQtyText(po.lines, itemById)}`,
      pending: po.status === "ordered",
    }
  }

  return (
    <Page>
      <PageHeader
        icon={TruckIcon}
        title="Purchases"
        description="Orders you send to your suppliers. When the goods arrive, press Goods received and the stock goes up."
        actions={
          <Button size="lg" onClick={newOrder}>
            <PlusIcon strokeWidth={2} />
            {ACTION.newPurchase}
          </Button>
        }
      />

      <Stagger className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StaggerItem className="h-full">
          <StatCard
            className="h-full"
            label="On the way"
            value={stats.pending}
            suffix={stats.pending === 1 ? "order" : "orders"}
            footnote={`${inr(stats.pendingValue)} of goods`}
            icon={ClockIcon}
            tone="info"
            onClick={() => setStatus("ordered")}
            actionLabel="Show them"
          />
        </StaggerItem>
        <StaggerItem className="h-full">
          <StatCard
            className="h-full"
            label="Late"
            value={stats.late}
            suffix={stats.late === 1 ? "order" : "orders"}
            delta={stats.late > 0 ? { text: "Past the expected date", tone: "negative" } : { text: "All on time", tone: "positive" }}
            icon={TriangleAlertIcon}
            tone={stats.late > 0 ? "negative" : "muted"}
            onClick={stats.late > 0 ? () => setStatus("late") : undefined}
            actionLabel="Show them"
          />
        </StaggerItem>
        <StaggerItem className="h-full">
          <StatCard
            className="h-full"
            label="Received in the last 30 days"
            value={stats.received30}
            kind="inr"
            footnote={plural(stats.received30Count, "order")}
            icon={PackageCheckIcon}
            tone="positive"
            onClick={() => setStatus("received")}
            actionLabel="Show them"
          />
        </StaggerItem>
        <StaggerItem className="h-full">
          <NextDeliveryCard
            po={stats.next}
            supplier={nextSupplier}
            hint={nextHint?.text}
            onOpen={() => stats.next && open(stats.next)}
          />
        </StaggerItem>
      </Stagger>

      <div className="flex flex-col gap-3">
        <Segmented<StatusFilter>
          value={status}
          onValueChange={setStatus}
          items={[
            { value: "all", label: "All", count: counts.all },
            { value: "ordered", label: "On the way", count: counts.ordered },
            { value: "late", label: "Late", count: counts.late },
            { value: "received", label: "Received", count: counts.received },
            { value: "cancelled", label: "Cancelled", count: counts.cancelled },
          ]}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <SearchInput
            value={q}
            onChange={(v) => {
              setQ(v)
              setLimit(PAGE)
            }}
            placeholder="Search by supplier, order number or item…"
            className="sm:w-96"
          />
          <Select
            value={supplierId}
            onValueChange={(v) => {
              setSupplierId(v)
              setLimit(PAGE)
            }}
          >
            <SelectTrigger className="w-full sm:w-56" aria-label="Show orders from this supplier">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="start">
              <SelectItem value="all">All suppliers</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={godownId}
            onValueChange={(v) => {
              setGodownId(v)
              setLimit(PAGE)
            }}
          >
            <SelectTrigger className="w-full sm:w-48" aria-label="Show orders going to this godown">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="start">
              <SelectItem value="all">All godowns</SelectItem>
              {godowns.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  To {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="-mb-2 flex min-h-10 flex-wrap items-center justify-between gap-2">
        <p className="text-[15px] text-fg-secondary tabular">
          {filtersActive
            ? `Showing ${num(filtered.length)} of ${plural(counts.all, "order")}`
            : plural(counts.all, "order")}
        </p>
        {filtersActive ? (
          <Button variant="ghost" onClick={clearFilters} className="text-fg-secondary">
            <XIcon strokeWidth={1.75} />
            Clear filters
          </Button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <Panel>
          <EmptyState
            icon={TruckIcon}
            title={filtersActive ? "No orders match" : "No supplier orders yet"}
            description={
              filtersActive
                ? "Nothing fits this status, supplier, godown or search. Clear the filters to see every order."
                : "Order from a supplier to bring stock into a godown. When the goods arrive, press Goods received."
            }
            action={
              filtersActive ? (
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : (
                <Button onClick={newOrder}>
                  <PlusIcon strokeWidth={2} />
                  {ACTION.newPurchase}
                </Button>
              )
            }
          />
        </Panel>
      ) : (
        <>
          {/* Phones and tablets: one card per order */}
          <ul className="grid gap-3 md:grid-cols-2 xl:hidden">
            {visible.map((po) => {
              const r = rowData(po)
              return (
                <li
                  key={po.id}
                  className="relative flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-float"
                >
                  <button
                    type="button"
                    onClick={() => open(po)}
                    aria-label={`Open order ${po.number} from ${r.supplier}`}
                    className="absolute inset-0 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
                  />
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-base font-semibold text-foreground">{r.supplier}</span>
                      <Mono>
                        {po.number} · ordered {dateShort(po.date)}
                      </Mono>
                    </div>
                    <StatusBadge status={r.badge} />
                  </div>
                  <div className="flex items-end justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[15px] text-foreground tabular">{r.qty}</span>
                      <span className="truncate text-[13px] text-muted-foreground">To {r.godown}</span>
                    </div>
                    <span className="shrink-0 text-[15px] font-semibold text-foreground tabular">{r.amount}</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                    <span className={cn("text-sm tabular", r.whenLine.tone)}>{r.whenLine.text}</span>
                    {r.pending ? (
                      <Button className="relative z-10 w-full sm:w-auto" onClick={() => actions.askReceive(po)}>
                        <PackageCheckIcon strokeWidth={2} />
                        {ACTION.receivePurchase}
                      </Button>
                    ) : (
                      <Button variant="outline" className="relative z-10" onClick={() => open(po)}>
                        {ACTION.view}
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>

          {/* Wide screens: table */}
          <Panel flush className="hidden xl:flex">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-5">Supplier</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Expected</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-5 text-right">
                    <span className="sr-only">What to do</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((po) => {
                  const r = rowData(po)
                  return (
                    <TableRow
                      key={po.id}
                      tabIndex={0}
                      onClick={() => open(po)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") open(po)
                      }}
                      className="cursor-pointer outline-none focus-visible:bg-raised"
                    >
                      <TableCell className="max-w-[240px] pl-5">
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate font-medium text-foreground">{r.supplier}</span>
                          <Mono className="truncate">
                            {po.number} · ordered {dateShort(po.date)}
                          </Mono>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[220px]">
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate text-foreground tabular">{r.qty}</span>
                          <span className="truncate text-[13px] text-muted-foreground">
                            To {r.godown}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-foreground tabular">{r.when.date}</span>
                          {r.when.text ? <span className={cn("text-[13px]", r.when.tone)}>{r.when.text}</span> : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium text-foreground tabular">{r.amount}</TableCell>
                      <TableCell>
                        <StatusBadge status={r.badge} />
                      </TableCell>
                      <TableCell className="pr-5 text-right">
                        {r.pending ? (
                          <Button
                            variant="outline"
                            className="border-primary/30 text-primary-ink hover:bg-accent hover:text-primary-ink"
                            onClick={(e) => {
                              e.stopPropagation()
                              actions.askReceive(po)
                            }}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            <PackageCheckIcon strokeWidth={2} />
                            {ACTION.receivePurchase}
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            className="text-fg-secondary"
                            onClick={(e) => {
                              e.stopPropagation()
                              open(po)
                            }}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            {ACTION.view}
                            <ArrowRightIcon strokeWidth={1.75} />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Panel>

          {filtered.length > limit ? (
            <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
              <span className="text-sm text-muted-foreground tabular">
                Showing the first {num(visible.length)} of {num(filtered.length)}
              </span>
              <Button variant="outline" onClick={() => setLimit((l) => l + PAGE)}>
                Show {Math.min(PAGE, filtered.length - limit)} more
              </Button>
            </div>
          ) : null}
        </>
      )}

      {actions.dialog}
    </Page>
  )
}

/** "Next delivery" card: the open order due soonest. Same look as a StatCard. */
function NextDeliveryCard({
  po,
  supplier,
  hint,
  onOpen,
}: {
  po?: PurchaseOrder
  supplier?: string
  hint?: string
  onOpen: () => void
}) {
  const head = (
    <div className="flex items-center gap-3">
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", TONE_PILL.info)}>
        <CalendarClockIcon className="size-5" strokeWidth={1.75} />
      </span>
      <span className="text-[15px] leading-snug font-medium text-fg-secondary">Next delivery</span>
    </div>
  )
  const box = "flex h-full w-full min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-5 text-left shadow-card"

  if (!po) {
    return (
      <div className={box}>
        {head}
        <div className="flex flex-col gap-1.5">
          <span className="text-[22px] leading-none font-semibold text-muted-foreground sm:text-[26px]">None due</span>
          <span className="text-sm text-muted-foreground">No orders are on the way</span>
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      title={date(po.expectedDate)}
      className={cn(
        box,
        "group transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-float focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
      )}
    >
      {head}
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="text-[26px] leading-none font-semibold tracking-[-0.01em] text-foreground tabular sm:text-[30px]">
          {dateShort(po.expectedDate)}
        </span>
        <span className="truncate text-sm text-muted-foreground">
          {hint ? `${hint} · ` : ""}
          {supplier}
        </span>
      </div>
      <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary-ink">
        View order
        <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
      </span>
    </button>
  )
}

