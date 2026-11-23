"use client"

import { motion } from "motion/react"
import { usePathname, useSearchParams } from "next/navigation"
import { Suspense, useId, useMemo, useState } from "react"
import {
  BoxesIcon,
  CircleXIcon,
  ClipboardCheckIcon,
  IndianRupeeIcon,
  InfoIcon,
  PackageSearchIcon,
  TriangleAlertIcon,
  TruckIcon,
  XIcon,
} from "lucide-react"
import { HelpTip } from "@/components/kit/help"
import { EmptyState, ItemIcon, SearchInput, Segmented } from "@/components/kit/misc"
import { EASE, Page, PageHeader } from "@/components/kit/page"
import { Panel } from "@/components/kit/panel"
import { StatCard } from "@/components/kit/stat-card"
import { StatusBadge } from "@/components/kit/status-badge"
import { StockMeter } from "@/components/kit/stock-meter"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { incomingQty, onHand, stockStatus } from "@/lib/calc"
import { num } from "@/lib/format"
import { CATEGORIES } from "@/lib/seed"
import { useInventory, useUI } from "@/lib/store"
import type { Item, StockStatus } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ACTION } from "@/lib/words"
import { godownMin, MAIN_GODOWN, meaning, qtyText, reorderQty, shareOf, unitWord } from "./shared"

type StatusFilter = "all" | StockStatus
type Sort = "name" | "cover" | "value"

const STATUS_VALUES: StatusFilter[] = ["all", "ok", "low", "out"]

function parseStatus(v: string | null): StatusFilter {
  return v && (STATUS_VALUES as string[]).includes(v) ? (v as StatusFilter) : "all"
}

const SORT_LABEL: Record<Sort, string> = {
  name: "Name, A to Z",
  cover: "Lowest stock first",
  value: "Highest stock value first",
}

interface Row {
  item: Item
  /** in stock, in the chosen godown (or all godowns) */
  qty: number
  /** minimum level, in the chosen godown (or all godowns) */
  min: number
  /** in stock, all godowns */
  total: number
  status: StockStatus
  perGodown: { id: string; name: string; qty: number }[]
  /** on the way, to the chosen godown (or all godowns) */
  incoming: number
  /** on the way, all godowns */
  incomingAll: number
  value: number
  cover: number
}

export function StockView() {
  return (
    <Suspense fallback={null}>
      <StockViewInner />
    </Suspense>
  )
}

function StockViewInner() {
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const items = useInventory((s) => s.items)
  const stock = useInventory((s) => s.stock)
  const godowns = useInventory((s) => s.godowns)
  const suppliers = useInventory((s) => s.suppliers)
  const purchaseOrders = useInventory((s) => s.purchaseOrders)
  const openPanel = useUI((s) => s.openPanel)
  const openComposer = useUI((s) => s.openComposer)

  // status and godown live in the URL, so "/stock?status=low" (bell, Home) and
  // "/stock?godown=g-bho" (Godowns page) land on the right filter
  const status = parseStatus(searchParams.get("status"))
  const godownParam = searchParams.get("godown")
  const godownId = godownParam && godowns.some((g) => g.id === godownParam) ? godownParam : "all"
  const setParams = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "all") params.delete(k)
      else params.set(k, v)
    }
    const qs = params.toString()
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname)
  }
  const setStatus = (v: StatusFilter) => setParams({ status: v })
  const setGodownId = (v: string) => setParams({ godown: v })

  const [category, setCategory] = useState<string>("all")
  const [sort, setSort] = useState<Sort>("name")
  const [query, setQuery] = useState("")

  const scoped = godownId !== "all"
  const scopedGodown = godowns.find((g) => g.id === godownId)

  // every item, scoped to the chosen godown (quantity and minimum both follow the scope)
  const rows = useMemo<Row[]>(
    () =>
      items.map((item) => {
        const total = onHand(stock, item.id)
        const qty = scoped ? onHand(stock, item.id, godownId) : total
        const min = scoped ? godownMin(item.minLevel, godownId) : item.minLevel
        const incomingAll = incomingQty(purchaseOrders, item.id)
        return {
          item,
          qty,
          min,
          total,
          status: stockStatus(qty, min),
          perGodown: godowns.map((g) => ({ id: g.id, name: g.name, qty: onHand(stock, item.id, g.id) })),
          incoming: scoped ? incomingQty(purchaseOrders.filter((p) => p.godownId === godownId), item.id) : incomingAll,
          incomingAll,
          value: qty * item.cost,
          cover: min > 0 ? qty / min : qty,
        }
      }),
    [items, stock, godowns, purchaseOrders, scoped, godownId],
  )

  const totals = useMemo(
    () => ({
      value: rows.reduce((s, r) => s + r.value, 0),
      inStock: rows.filter((r) => r.qty > 0).length,
      low: rows.filter((r) => r.status === "low").length,
      out: rows.filter((r) => r.status === "out").length,
    }),
    [rows],
  )

  // search + category first, so the status tab counts match what the list shows
  const searched = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter(
      (r) =>
        (category === "all" || r.item.category === category) &&
        (!q || r.item.name.toLowerCase().includes(q) || r.item.sku.toLowerCase().includes(q)),
    )
  }, [rows, category, query])

  const counts = useMemo(
    () => ({
      all: searched.length,
      ok: searched.filter((r) => r.status === "ok").length,
      low: searched.filter((r) => r.status === "low").length,
      out: searched.filter((r) => r.status === "out").length,
    }),
    [searched],
  )

  const visible = useMemo(() => {
    const list = searched.filter((r) => status === "all" || r.status === status)
    const sorted = [...list]
    if (sort === "name") sorted.sort((a, b) => a.item.name.localeCompare(b.item.name))
    if (sort === "cover") sorted.sort((a, b) => a.cover - b.cover)
    if (sort === "value") sorted.sort((a, b) => b.value - a.value)
    return sorted
  }, [searched, status, sort])

  const filtered = status !== "all" || category !== "all" || scoped || query.trim() !== ""
  const clearFilters = () => {
    setParams({ status: null, godown: null })
    setCategory("all")
    setQuery("")
  }

  const orderMore = (r: Row) =>
    openComposer({
      type: "purchase",
      defaults: {
        supplierId: suppliers.some((s) => s.id === r.item.supplierId) ? r.item.supplierId : undefined,
        godownId: scoped ? godownId : MAIN_GODOWN,
        lines: [{ itemId: r.item.id, qty: reorderQty(r.item, r.total, r.incomingAll), rate: r.item.cost }],
      },
    })
  const open = (r: Row) => openPanel({ type: "item", id: r.item.id })

  const place = scoped && scopedGodown ? `at ${scopedGodown.name} godown` : null

  return (
    <Page>
      <PageHeader
        icon={BoxesIcon}
        title="Stock"
        description="Every item you sell, and how many you have in each godown. Items below their minimum level are marked Running low."
        actions={
          <>
            <Button variant="outline" onClick={() => openComposer({ type: "adjust", defaults: scoped ? { godownId } : undefined })}>
              <ClipboardCheckIcon strokeWidth={1.75} />
              {ACTION.adjust}
            </Button>
            <Button onClick={() => openComposer({ type: "purchase", defaults: scoped ? { godownId } : undefined })}>
              <TruckIcon strokeWidth={1.75} />
              {ACTION.newPurchase}
            </Button>
          </>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Items"
          value={rows.length}
          icon={BoxesIcon}
          tone="info"
          footnote={place ? `${num(totals.inStock)} have stock ${place}` : `${num(totals.inStock)} have stock now`}
        />
        <StatCard
          label="Running low"
          value={totals.low}
          icon={TriangleAlertIcon}
          tone="warning"
          footnote={place ?? "At or below the minimum level"}
          onClick={() => setStatus(status === "low" ? "all" : "low")}
          actionLabel={status === "low" ? "Show all items" : "Show these items"}
        />
        <StatCard
          label="Out of stock"
          value={totals.out}
          icon={CircleXIcon}
          tone="negative"
          footnote={place ?? (totals.out ? "None left. You cannot ship these" : "Nothing is out of stock")}
          onClick={() => setStatus(status === "out" ? "all" : "out")}
          actionLabel={status === "out" ? "Show all items" : "Show these items"}
        />
        <StatCard
          label="Stock value"
          value={totals.value}
          kind="inr"
          icon={IndianRupeeIcon}
          tone="neutral"
          footnote={
            <span className="inline-flex items-center gap-1">
              {place ? `What the stock ${place} cost you` : "What it all cost you to buy"}
              <HelpTip label="What is stock value?">{meaning("Stock value")}</HelpTip>
            </span>
          }
        />
      </div>

      {/* Search and filters */}
      <div className="flex flex-col gap-4">
        <Segmented<StatusFilter>
          value={status}
          onValueChange={setStatus}
          items={[
            { value: "all", label: "All", count: counts.all },
            { value: "low", label: "Running low", count: counts.low },
            { value: "out", label: "Out of stock", count: counts.out },
            { value: "ok", label: "In stock", count: counts.ok },
          ]}
        />
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search by item name or code…"
            className="sm:w-full xl:min-w-0 xl:flex-1"
          />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:flex xl:shrink-0">
            <FilterSelect label="Category" value={category} onChange={setCategory} className="xl:w-48">
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </FilterSelect>
            <FilterSelect
              label="Godown"
              help={meaning("Godown")}
              value={godownId}
              onChange={setGodownId}
              className="xl:w-44"
            >
              <SelectItem value="all">All godowns</SelectItem>
              {godowns.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </FilterSelect>
            <FilterSelect label="Sort by" value={sort} onChange={(v) => setSort(v as Sort)} className="col-span-2 md:col-span-1 xl:w-56">
              {(Object.keys(SORT_LABEL) as Sort[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {SORT_LABEL[s]}
                </SelectItem>
              ))}
            </FilterSelect>
          </div>
        </div>

        <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="text-[15px] text-fg-secondary">
            Showing <span className="font-semibold text-foreground tabular">{num(visible.length)}</span> of{" "}
            <span className="tabular">{num(rows.length)}</span> items{place ? ` ${place}` : ""}
          </p>
          {filtered ? (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-primary-ink hover:text-primary-ink">
              <XIcon strokeWidth={2} />
              Clear filters
            </Button>
          ) : null}
        </div>
        {scoped && scopedGodown ? (
          <p className="-mt-2 flex items-start gap-2 text-[13px] leading-relaxed text-muted-foreground">
            <InfoIcon className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
            At {scopedGodown.name}, each item&apos;s minimum is this godown&apos;s share ({Math.round(shareOf(scopedGodown.id) * 100)}%) of
            the full minimum level.
          </p>
        ) : null}
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <Panel>
          <EmptyState
            icon={PackageSearchIcon}
            title={filtered ? "No items match" : "No items yet"}
            description={
              filtered
                ? "Nothing matches your search and filters. Clear them to see every item."
                : "Items you buy and sell will show here."
            }
            action={
              filtered ? (
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : null
            }
          />
        </Panel>
      ) : (
        <>
          {/* Phones: one card per item */}
          <ul className="flex flex-col gap-3 md:hidden">
            {visible.map((r) => (
              <StockCard key={r.item.id} row={r} godownId={godownId} onOpen={() => open(r)} onOrder={() => orderMore(r)} />
            ))}
          </ul>

          {/* Tablets and up: table */}
          <Panel flush className="hidden md:flex">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-5">Item</TableHead>
                  <TableHead className="text-right">{scoped ? `In stock at ${scopedGodown?.name}` : "In stock"}</TableHead>
                  <TableHead className="hidden text-right xl:table-cell">
                    <span className="inline-flex items-center gap-1">
                      Minimum
                      <HelpTip label="What is the minimum level?">{meaning("Minimum level")}</HelpTip>
                    </span>
                  </TableHead>
                  <TableHead className="hidden text-right 2xl:table-cell">
                    <span className="inline-flex items-center gap-1">
                      On the way
                      <HelpTip label="What does on the way mean?">
                        Items you ordered from suppliers that have not arrived yet. Stock goes up when you press “Goods received”.
                      </HelpTip>
                    </span>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-5 text-right">
                    <span className="sr-only">Action</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((r) => (
                  <motion.tr
                    key={r.item.id}
                    layout="position"
                    transition={{ duration: 0.35, ease: EASE }}
                    tabIndex={0}
                    onClick={() => open(r)}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        open(r)
                      }
                    }}
                    className="cursor-pointer border-b transition-colors outline-none last:border-0 hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset"
                  >
                    <TableCell className="min-w-[200px] pl-5 whitespace-normal">
                      <div className="flex min-w-0 items-center gap-3">
                        <ItemIcon category={r.item.category} />
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="leading-snug font-medium text-foreground">{r.item.name}</span>
                          <span className="text-[13px] text-muted-foreground">
                            {r.item.sku} · {r.item.category}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-1.5">
                        <span className="whitespace-nowrap">
                          <span className="text-[17px] font-semibold text-foreground tabular">{num(r.qty)}</span>{" "}
                          <span className="text-[13px] text-muted-foreground">{unitWord(r.qty, r.item.unit)}</span>
                        </span>
                        <StockMeter qty={r.qty} min={r.min} size="sm" />
                        <GodownSplit row={r} godownId={godownId} className="hidden xl:block" />
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-right text-fg-secondary xl:table-cell">
                      <span className="tabular">{num(r.min)}</span>{" "}
                      <span className="text-[13px] text-muted-foreground">{unitWord(r.min, r.item.unit)}</span>
                    </TableCell>
                    <TableCell className="hidden text-right 2xl:table-cell">
                      {r.incoming ? (
                        <span className="text-info">
                          <span className="font-medium tabular">{num(r.incoming)}</span>{" "}
                          <span className="text-[13px]">{unitWord(r.incoming, r.item.unit)}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge status={r.status} />
                        {r.incoming ? (
                          <span className="text-[13px] text-info 2xl:hidden">{qtyText(r.incoming, r.item.unit)} on the way</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      <RowAction row={r} onOpen={() => open(r)} onOrder={() => orderMore(r)} />
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </Panel>
        </>
      )}
    </Page>
  )
}

/* ------------------------------------------------------------------ */
/* Pieces                                                               */
/* ------------------------------------------------------------------ */

/** Select with its label above it. */
function FilterSelect({
  label,
  help,
  value,
  onChange,
  className,
  children,
}: {
  label: string
  help?: string
  value: string
  onChange: (v: string) => void
  className?: string
  children: React.ReactNode
}) {
  const id = useId()
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <span className="flex items-center gap-1 text-[13px] font-medium text-fg-secondary">
        <label htmlFor={id}>{label}</label>
        {help ? <HelpTip label={`What is a ${label.toLowerCase()}?`}>{help}</HelpTip> : null}
      </span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" align="start">
          {children}
        </SelectContent>
      </Select>
    </div>
  )
}

/** "Bhosari 120 · Chakan 40 · Bhiwandi 0": how the stock is spread over the godowns. */
function GodownSplit({ row, godownId, className }: { row: Row; godownId: string; className?: string }) {
  return (
    <p className={cn("text-[13px] whitespace-nowrap text-muted-foreground", className)}>
      {row.perGodown.map((g, i) => (
        <span key={g.id}>
          {i > 0 ? <span aria-hidden> · </span> : null}
          <span className={cn(g.id === godownId && "font-medium text-foreground", g.qty <= 0 && "text-negative")}>
            {g.name} <span className="tabular">{num(g.qty)}</span>
          </span>
        </span>
      ))}
    </p>
  )
}

/** The visible next step for a row: order more when low, otherwise view. */
function RowAction({
  row,
  onOpen,
  onOrder,
  className,
}: {
  row: Row
  onOpen: () => void
  onOrder: () => void
  className?: string
}) {
  if (row.status === "ok") {
    return (
      <Button
        variant="outline"
        size="sm"
        className={className}
        onClick={(e) => {
          e.stopPropagation()
          onOpen()
        }}
      >
        {ACTION.view}
      </Button>
    )
  }
  return (
    <Button
      size="sm"
      className={className}
      onClick={(e) => {
        e.stopPropagation()
        onOrder()
      }}
    >
      <TruckIcon strokeWidth={1.75} />
      {ACTION.reorder}
    </Button>
  )
}

function StockCard({
  row: r,
  godownId,
  onOpen,
  onOrder,
}: {
  row: Row
  godownId: string
  onOpen: () => void
  onOrder: () => void
}) {
  return (
    <li className="relative flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-start gap-3">
        <ItemIcon category={r.item.category} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          {/* the name button covers the whole card, so a tap anywhere opens the item */}
          <button
            type="button"
            onClick={onOpen}
            className="text-left text-[15px] leading-snug font-medium text-foreground outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring/50"
          >
            {r.item.name}
          </button>
          <span className="text-[13px] text-muted-foreground">
            {r.item.sku} · {r.item.category}
          </span>
        </div>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] text-muted-foreground">In stock</span>
          <span>
            <span className="text-[22px] leading-none font-semibold text-foreground tabular">{num(r.qty)}</span>{" "}
            <span className="text-[15px] text-muted-foreground">{unitWord(r.qty, r.item.unit)}</span>
          </span>
          <StockMeter qty={r.qty} min={r.min} />
        </div>
        <StatusBadge status={r.status} />
      </div>

      <div className="flex flex-col gap-1 border-t border-border pt-3 text-[13px] text-muted-foreground">
        <GodownSplit row={r} godownId={godownId} className="whitespace-normal" />
        <p>
          Minimum <span className="text-fg-secondary tabular">{qtyText(r.min, r.item.unit)}</span>
          {r.incoming ? (
            <>
              <span aria-hidden> · </span>
              <span className="text-info">{qtyText(r.incoming, r.item.unit)} on the way</span>
            </>
          ) : null}
        </p>
      </div>

      <RowAction row={r} onOpen={onOpen} onOrder={onOrder} className="relative z-10 h-10 w-full" />
    </li>
  )
}
