"use client"

import { motion } from "motion/react"
import { usePathname, useSearchParams } from "next/navigation"
import { Suspense, useMemo, useState } from "react"
import { ArrowLeftRightIcon, PackageSearchIcon, SlidersHorizontalIcon } from "lucide-react"
import { BinLabel, EmptyState, Mono, SearchInput, Segmented } from "@/components/kit/misc"
import { EASE, Page, PageHeader } from "@/components/kit/page"
import { Panel } from "@/components/kit/panel"
import { StatCard } from "@/components/kit/stat-card"
import { StatusBadge } from "@/components/kit/status-badge"
import { StockMeter } from "@/components/kit/stock-meter"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { incomingQty, onHand, stockStatus } from "@/lib/calc"
import { inr, num } from "@/lib/format"
import { CATEGORIES } from "@/lib/seed"
import { useInventory, useUI } from "@/lib/store"
import type { Item, StockStatus } from "@/lib/types"
import { cn } from "@/lib/utils"
import { godownMin, shareOf } from "./shared"

type StatusFilter = "all" | StockStatus
type Sort = "name" | "cover" | "value"

const STATUS_VALUES: StatusFilter[] = ["all", "ok", "low", "out"]

function parseStatus(v: string | null): StatusFilter {
  return v && (STATUS_VALUES as string[]).includes(v) ? (v as StatusFilter) : "all"
}

interface Row {
  item: Item
  qty: number
  min: number
  status: StockStatus
  perGodown: Record<string, number>
  incoming: number
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
  // status lives in the URL so the topbar's "Open stock list" link lands on the right filter
  const status = parseStatus(searchParams.get("status"))
  const setStatus = (v: StatusFilter) => {
    const params = new URLSearchParams(searchParams.toString())
    if (v === "all") params.delete("status")
    else params.set("status", v)
    const qs = params.toString()
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname)
  }

  const items = useInventory((s) => s.items)
  const stock = useInventory((s) => s.stock)
  const godowns = useInventory((s) => s.godowns)
  const purchaseOrders = useInventory((s) => s.purchaseOrders)
  const openPanel = useUI((s) => s.openPanel)
  const openComposer = useUI((s) => s.openComposer)

  const [category, setCategory] = useState<string>("all")
  const [godownId, setGodownId] = useState<string>("all")
  const [sort, setSort] = useState<Sort>("name")
  const [query, setQuery] = useState("")

  const scoped = godownId !== "all"
  const scopedGodown = godowns.find((g) => g.id === godownId)

  // every item, scoped to the chosen godown (qty and min both follow the scope)
  const rows = useMemo<Row[]>(
    () =>
      items.map((item) => {
        const qty = scoped ? onHand(stock, item.id, godownId) : onHand(stock, item.id)
        const min = scoped ? godownMin(item.minLevel, godownId) : item.minLevel
        return {
          item,
          qty,
          min,
          status: stockStatus(qty, min),
          perGodown: Object.fromEntries(godowns.map((g) => [g.id, onHand(stock, item.id, g.id)])),
          incoming: incomingQty(
            scoped ? purchaseOrders.filter((p) => p.godownId === godownId) : purchaseOrders,
            item.id,
          ),
          value: qty * item.cost,
          cover: min > 0 ? qty / min : qty,
        }
      }),
    [items, stock, godowns, purchaseOrders, scoped, godownId],
  )

  const totals = useMemo(
    () => ({
      units: rows.reduce((s, r) => s + r.qty, 0),
      value: rows.reduce((s, r) => s + r.value, 0),
      ok: rows.filter((r) => r.status === "ok").length,
      low: rows.filter((r) => r.status === "low").length,
      out: rows.filter((r) => r.status === "out").length,
    }),
    [rows],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = rows.filter(
      (r) =>
        (status === "all" || r.status === status) &&
        (category === "all" || r.item.category === category) &&
        (!q || r.item.name.toLowerCase().includes(q) || r.item.sku.toLowerCase().includes(q)),
    )
    const sorted = [...list]
    if (sort === "name") sorted.sort((a, b) => a.item.name.localeCompare(b.item.name))
    if (sort === "cover") sorted.sort((a, b) => a.cover - b.cover)
    if (sort === "value") sorted.sort((a, b) => b.value - a.value)
    return sorted
  }, [rows, status, category, query, sort])

  const filtered = status !== "all" || category !== "all" || query.trim() !== ""

  return (
    <Page>
      <PageHeader
        title="Stock"
        description={`${num(items.length)} items across ${num(godowns.length)} godowns`}
        actions={
          <>
            <Button variant="outline" className="gap-1.5" onClick={() => openComposer({ type: "adjust" })}>
              <SlidersHorizontalIcon className="size-4" strokeWidth={1.5} />
              Adjust stock
            </Button>
            <Button variant="outline" className="gap-1.5" onClick={() => openComposer({ type: "transfer" })}>
              <ArrowLeftRightIcon className="size-4" strokeWidth={1.5} />
              Transfer
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={scoped ? `Units at ${scopedGodown?.name}` : "Units on hand"}
          value={totals.units}
          footnote={scoped ? scopedGodown?.code : "all godowns"}
        />
        <StatCard label="Stock value" value={totals.value} kind="inr" footnote="at cost" />
        <StatCard
          label="Low stock"
          value={totals.low}
          footnote="at or below min"
          onClick={() => setStatus(status === "low" ? "all" : "low")}
        />
        <StatCard
          label="Out of stock"
          value={totals.out}
          footnote={totals.out ? "nothing to ship" : "none"}
          onClick={() => setStatus(status === "out" ? "all" : "out")}
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <Segmented<StatusFilter>
            value={status}
            onValueChange={setStatus}
            items={[
              { value: "all", label: "All", count: rows.length },
              { value: "ok", label: "In stock", count: totals.ok },
              { value: "low", label: "Low", count: totals.low },
              { value: "out", label: "Out", count: totals.out },
            ]}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="min-w-40" aria-label="Category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="start">
                <SelectItem value="all">All categories</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={godownId} onValueChange={setGodownId}>
              <SelectTrigger className="min-w-36" aria-label="Godown">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="start">
                <SelectItem value="all">All godowns</SelectItem>
                {godowns.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
              <SelectTrigger className="min-w-40" aria-label="Sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="start">
                <SelectItem value="name">Sort by name</SelectItem>
                <SelectItem value="cover">Lowest cover first</SelectItem>
                <SelectItem value="value">Highest value first</SelectItem>
              </SelectContent>
            </Select>
            <SearchInput value={query} onChange={setQuery} placeholder="Search" className="sm:w-56" />
          </div>
        </div>
        {scoped && scopedGodown ? (
          <p className="text-xs text-muted-foreground">
            Showing {scopedGodown.name} stock against its {Math.round(shareOf(scopedGodown.id) * 100)}% share of each min level
          </p>
        ) : null}
      </div>

      <Panel flush>
        {visible.length === 0 ? (
          <EmptyState
            icon={PackageSearchIcon}
            title="No items match"
            description={filtered ? "Try another status, category or search" : "There are no items yet"}
            action={
              filtered ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setStatus("all")
                    setCategory("all")
                    setQuery("")
                  }}
                >
                  Clear filters
                </Button>
              ) : null
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Item</TableHead>
                <TableHead className="hidden lg:table-cell">Category</TableHead>
                <TableHead className="text-right">{scoped ? `On hand · ${scopedGodown?.code}` : "On hand"}</TableHead>
                <TableHead className="hidden md:table-cell">
                  <span className="sr-only">Shelf meter</span>
                </TableHead>
                <TableHead className="hidden text-right md:table-cell">Min</TableHead>
                {godowns.map((g) => (
                  <TableHead key={g.id} className="hidden text-right xl:table-cell">
                    {g.code}
                  </TableHead>
                ))}
                <TableHead className="hidden text-right lg:table-cell">Incoming</TableHead>
                <TableHead className="hidden text-right md:table-cell">Value</TableHead>
                <TableHead className="pr-5">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((r) => (
                <motion.tr
                  key={r.item.id}
                  layout="position"
                  transition={{ duration: 0.35, ease: EASE }}
                  tabIndex={0}
                  onClick={() => openPanel({ type: "item", id: r.item.id })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      openPanel({ type: "item", id: r.item.id })
                    }
                  }}
                  className="cursor-pointer border-b transition-colors outline-none last:border-0 hover:bg-raised/60 focus-visible:bg-raised/60 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset"
                >
                  <td className="py-2.5 pr-3 pl-5 align-middle">
                    <div className="flex min-w-0 items-center gap-3">
                      <BinLabel category={r.item.category} />
                      <div className="flex min-w-0 flex-col">
                        <span className="max-w-[180px] truncate text-sm text-foreground sm:max-w-[280px]">{r.item.name}</span>
                        <Mono className="text-[11px]">{r.item.sku}</Mono>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-3 py-2.5 align-middle text-sm whitespace-nowrap text-fg-secondary lg:table-cell">
                    {r.item.category}
                  </td>
                  <td className="px-3 py-2.5 text-right align-middle whitespace-nowrap">
                    <span className="font-mono text-sm text-foreground tabular">{num(r.qty)}</span>{" "}
                    <span className="text-xs text-muted-foreground">{r.item.unit}</span>
                  </td>
                  <td className="hidden px-3 py-2.5 align-middle md:table-cell">
                    <StockMeter qty={r.qty} min={r.min} />
                  </td>
                  <td className="hidden px-3 py-2.5 text-right align-middle font-mono text-sm text-muted-foreground tabular md:table-cell">
                    {num(r.min)}
                  </td>
                  {godowns.map((g) => (
                    <td
                      key={g.id}
                      className={cn(
                        "hidden px-3 py-2.5 text-right align-middle font-mono text-xs tabular xl:table-cell",
                        g.id === godownId ? "text-foreground" : "text-muted-foreground",
                        r.perGodown[g.id] === 0 && "text-negative/80",
                      )}
                    >
                      {num(r.perGodown[g.id])}
                    </td>
                  ))}
                  <td className="hidden px-3 py-2.5 text-right align-middle font-mono text-xs tabular lg:table-cell">
                    {r.incoming ? <span className="text-fg-secondary">+{num(r.incoming)}</span> : <span className="text-muted-foreground/60">—</span>}
                  </td>
                  <td className="hidden px-3 py-2.5 text-right align-middle font-mono text-sm text-fg-secondary tabular md:table-cell">
                    {inr(r.value)}
                  </td>
                  <td className="py-2.5 pr-5 pl-3 align-middle">
                    <StatusBadge status={r.status} label={r.status === "low" ? "Low" : r.status === "out" ? "Out" : undefined} />
                  </td>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
    </Page>
  )
}
