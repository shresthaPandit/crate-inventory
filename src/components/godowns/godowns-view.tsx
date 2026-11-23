"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import {
  ArrowRightLeftIcon,
  BoxesIcon,
  ClipboardCheckIcon,
  PackageCheckIcon,
  PackageSearchIcon,
  ShoppingCartIcon,
  TruckIcon,
  WarehouseIcon,
  XIcon,
} from "lucide-react"
import { HelpTip } from "@/components/kit/help"
import { EmptyState, ItemIcon, SearchInput, Segmented } from "@/components/kit/misc"
import { Page, PageHeader } from "@/components/kit/page"
import { Panel } from "@/components/kit/panel"
import { StatusBadge, TONE_PILL, type Tone } from "@/components/kit/status-badge"
import { StockMeter } from "@/components/kit/stock-meter"
import {
  godownMin,
  isOpenableRef,
  MAIN_GODOWN,
  meaning,
  openRef,
  qtyText,
  reorderQty,
  shareOf,
  timeAgo,
  unitWord,
  useRefNames,
} from "@/components/stock/shared"
import { Button } from "@/components/ui/button"
import { incomingQty, onHand, stockStatus } from "@/lib/calc"
import { inr, num, signed } from "@/lib/format"
import { CATEGORIES } from "@/lib/seed"
import { useInventory, useNow, useUI } from "@/lib/store"
import type { Godown, Item, MovementType, StockStatus } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ACTION } from "@/lib/words"

const WEEK = 7 * 86_400_000

export function GodownsView() {
  const godowns = useInventory((s) => s.godowns)
  const items = useInventory((s) => s.items)
  const stock = useInventory((s) => s.stock)
  const openComposer = useUI((s) => s.openComposer)
  const [selectedId, setSelectedId] = useState(MAIN_GODOWN)
  const selected = godowns.find((g) => g.id === selectedId) ?? godowns[0]

  const summaries = useMemo(() => {
    const allUnits = items.reduce((s, it) => s + onHand(stock, it.id), 0)
    return godowns.map((g) => {
      let units = 0
      let value = 0
      let low = 0
      let out = 0
      let stocked = 0
      for (const it of items) {
        const qty = onHand(stock, it.id, g.id)
        units += qty
        value += qty * it.cost
        if (qty > 0) stocked++
        const st = stockStatus(qty, godownMin(it.minLevel, g.id))
        if (st === "low") low++
        if (st === "out") out++
      }
      return {
        godown: g,
        units,
        value,
        low,
        out,
        stocked,
        used: g.capacity > 0 ? units / g.capacity : 0,
        share: allUnits > 0 ? units / allUnits : 0,
      }
    })
  }, [godowns, items, stock])

  return (
    <Page>
      <PageHeader
        icon={WarehouseIcon}
        title="Godowns"
        description={
          <>
            Your warehouses and what is in each one.{" "}
            <HelpTip label="What is a godown?" className="align-[-3px]">
              {meaning("Godown")}
            </HelpTip>
          </>
        }
        actions={
          <Button onClick={() => openComposer({ type: "transfer" })}>
            <ArrowRightLeftIcon strokeWidth={1.75} />
            {ACTION.newTransfer}
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {summaries.map((s, i) => (
          <GodownCard key={s.godown.id} {...s} totalItems={items.length} explainValue={i === 0} />
        ))}
      </div>

      {selected ? (
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold text-foreground">What is in each godown</h2>
              <p className="text-[15px] text-fg-secondary">Pick a godown to see its items and what came in or went out this week.</p>
            </div>
            <Segmented<string>
              value={selected.id}
              onValueChange={setSelectedId}
              items={godowns.map((g) => ({ value: g.id, label: g.name }))}
            />
          </div>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <GodownItems godown={selected} />
            <MovesThisWeek godown={selected} />
          </div>
        </section>
      ) : null}
    </Page>
  )
}

/* ------------------------------------------------------------------ */
/* Godown card                                                          */
/* ------------------------------------------------------------------ */
function GodownCard({
  godown,
  units,
  value,
  low,
  out,
  stocked,
  used,
  share,
  totalItems,
  explainValue,
}: {
  godown: Godown
  units: number
  value: number
  low: number
  out: number
  stocked: number
  used: number
  share: number
  totalItems: number
  explainValue: boolean
}) {
  const openComposer = useUI((s) => s.openComposer)
  const usedPct = Math.round(used * 100)

  return (
    <article className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5 shadow-card">
      <header className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-primary-ink">
            <WarehouseIcon className="size-5" strokeWidth={1.75} />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="text-lg leading-tight font-semibold text-foreground">{godown.name}</h2>
            <p className="text-[13px] text-muted-foreground">
              {godown.city} · Manager: {godown.manager}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {low > 0 ? <StatusBadge status="low" label={`${num(low)} running low`} /> : null}
          {out > 0 ? <StatusBadge status="out" label={`${num(out)} out of stock`} /> : null}
          {low === 0 && out === 0 ? <StatusBadge status="ok" label="Nothing running low" /> : null}
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-4">
        <CardStat label="Items here" value={num(stocked)} sub={`of ${num(totalItems)} items`} />
        <CardStat label="Units in total" value={num(units)} sub="pcs, coils and boxes" />
        <CardStat
          className="col-span-2"
          label={
            <>
              Stock value
              {explainValue ? <HelpTip label="What is stock value?">{meaning("Stock value")}</HelpTip> : null}
            </>
          }
          value={inr(value)}
          sub="What the stock here cost you to buy"
        />
      </dl>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3 text-[13px]">
          <span className="font-medium text-fg-secondary">How full it is</span>
          <span className={cn("font-medium tabular", used > 0.9 ? "text-warning" : "text-fg-secondary")}>{usedPct}% full</span>
        </div>
        <div
          role="meter"
          aria-valuenow={usedPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${godown.name} is ${usedPct}% full`}
          className="h-2.5 overflow-hidden rounded-full bg-raised"
        >
          <div
            className={cn("h-full rounded-full transition-[width] duration-500", used > 0.9 ? "bg-warning" : "bg-primary")}
            style={{ width: `${Math.min(100, Math.max(used > 0 ? 2 : 0, used * 100))}%` }}
          />
        </div>
        <p className="text-[13px] text-muted-foreground">
          {num(units)} of {num(godown.capacity)} units of space. Holds {Math.round(share * 100)}% of all your stock.
        </p>
      </div>

      <div className="mt-auto flex flex-wrap gap-2">
        <Button asChild variant="outline" className="flex-1">
          <Link href={`/stock?godown=${godown.id}`}>
            <BoxesIcon strokeWidth={1.75} />
            See stock
          </Link>
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          disabled={units <= 0}
          onClick={() => openComposer({ type: "transfer", defaults: { fromGodownId: godown.id } })}
        >
          <ArrowRightLeftIcon strokeWidth={1.75} />
          Move stock from here
        </Button>
      </div>
    </article>
  )
}

function CardStat({
  label,
  value,
  sub,
  className,
}: {
  label: React.ReactNode
  value: string
  sub: string
  className?: string
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <dt className="flex items-center gap-1 text-[13px] text-muted-foreground">{label}</dt>
      <dd className="text-xl leading-tight font-semibold text-foreground tabular">{value}</dd>
      <dd className="text-[13px] text-muted-foreground">{sub}</dd>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Items in one godown: search + status filter, grouped by category.    */
/* Each item's minimum here is this godown's share of its full minimum. */
/* ------------------------------------------------------------------ */
type StatusFilter = "all" | StockStatus

interface ItemRow {
  item: Item
  qty: number
  min: number
  status: StockStatus
  total: number
  incomingAll: number
  /** the godown with the most to spare, when this godown could be refilled from it */
  spare: { godownId: string; qty: number } | null
}

function GodownItems({ godown }: { godown: Godown }) {
  const items = useInventory((s) => s.items)
  const stock = useInventory((s) => s.stock)
  const godowns = useInventory((s) => s.godowns)
  const suppliers = useInventory((s) => s.suppliers)
  const purchaseOrders = useInventory((s) => s.purchaseOrders)
  const openPanel = useUI((s) => s.openPanel)
  const openComposer = useUI((s) => s.openComposer)

  const [status, setStatus] = useState<StatusFilter>("all")
  const [query, setQuery] = useState("")

  const rows = useMemo<ItemRow[]>(
    () =>
      items.map((item) => {
        const qty = onHand(stock, item.id, godown.id)
        const min = godownMin(item.minLevel, godown.id)
        const total = onHand(stock, item.id)
        let spare: ItemRow["spare"] = null
        for (const g of godowns) {
          if (g.id === godown.id) continue
          const extra = onHand(stock, item.id, g.id) - godownMin(item.minLevel, g.id)
          if (extra > 0 && (!spare || extra > spare.qty)) spare = { godownId: g.id, qty: extra }
        }
        return {
          item,
          qty,
          min,
          status: stockStatus(qty, min),
          total,
          incomingAll: incomingQty(purchaseOrders, item.id),
          spare,
        }
      }),
    [items, stock, godowns, purchaseOrders, godown.id],
  )

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? rows.filter((r) => r.item.name.toLowerCase().includes(q) || r.item.sku.toLowerCase().includes(q)) : rows
  }, [rows, query])

  const counts = useMemo(
    () => ({
      all: searched.length,
      low: searched.filter((r) => r.status === "low").length,
      out: searched.filter((r) => r.status === "out").length,
      ok: searched.filter((r) => r.status === "ok").length,
    }),
    [searched],
  )

  const visible = useMemo(() => searched.filter((r) => status === "all" || r.status === status), [searched, status])
  const groups = useMemo(
    () =>
      CATEGORIES.map((category) => ({
        category,
        rows: visible.filter((r) => r.item.category === category).sort((a, b) => a.item.name.localeCompare(b.item.name)),
      })).filter((g) => g.rows.length > 0),
    [visible],
  )

  const filtered = status !== "all" || query.trim() !== ""
  const clearFilters = () => {
    setStatus("all")
    setQuery("")
  }

  /** Low here: move it in from a godown with spare when the business has enough overall, else order more. */
  const refill = (r: ItemRow) => {
    if (stockStatus(r.total, r.item.minLevel) === "ok" && r.spare) {
      const need = Math.max(1, Math.ceil(r.min * 2.5) - r.qty)
      openComposer({
        type: "transfer",
        defaults: {
          fromGodownId: r.spare.godownId,
          toGodownId: godown.id,
          lines: [{ itemId: r.item.id, qty: Math.min(need, r.spare.qty) }],
        },
      })
      return
    }
    openComposer({
      type: "purchase",
      defaults: {
        supplierId: suppliers.some((s) => s.id === r.item.supplierId) ? r.item.supplierId : undefined,
        godownId: godown.id,
        lines: [{ itemId: r.item.id, qty: reorderQty(r.item, r.total, r.incomingAll), rate: r.item.cost }],
      },
    })
  }

  return (
    <Panel
      title={`Items in ${godown.name}`}
      description={`Each item's minimum here is ${godown.name}'s share (${Math.round(shareOf(godown.id) * 100)}%) of its full minimum level.`}
      flush
    >
      <div className="flex flex-col gap-3 border-b border-border px-5 pb-4">
        <SearchInput value={query} onChange={setQuery} placeholder="Search by item name or code…" className="sm:w-full lg:max-w-md" />
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
        <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <p className="text-[15px] text-fg-secondary">
            Showing <span className="font-semibold text-foreground tabular">{num(visible.length)}</span> of{" "}
            <span className="tabular">{num(rows.length)}</span> items at {godown.name}
          </p>
          {filtered ? (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-primary-ink hover:text-primary-ink">
              <XIcon strokeWidth={2} />
              Clear filters
            </Button>
          ) : null}
        </div>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={PackageSearchIcon}
          title="No items match"
          description={`Nothing at ${godown.name} matches your search and filter.`}
          action={
            <Button variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col">
          {groups.map((g) => (
            <div key={g.category} className="flex flex-col">
              <h3 className="border-b border-border bg-raised/60 px-5 py-2 text-[13px] font-semibold text-fg-secondary">
                {g.category} <span className="font-normal text-muted-foreground">· {plural(g.rows.length)}</span>
              </h3>
              <ul className="flex flex-col">
                {g.rows.map((r) => {
                  const moveIn = stockStatus(r.total, r.item.minLevel) === "ok" && r.spare
                  return (
                    <li
                      key={r.item.id}
                      className="relative flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-border px-5 py-3.5 transition-colors last:border-0 hover:bg-accent/60"
                    >
                      <div className="flex min-w-0 flex-1 basis-56 items-center gap-3">
                        <ItemIcon category={r.item.category} size="sm" />
                        <div className="flex min-w-0 flex-col gap-0.5">
                          {/* the name button covers the row, so a tap anywhere opens the item */}
                          <button
                            type="button"
                            onClick={() => openPanel({ type: "item", id: r.item.id })}
                            className="text-left text-[15px] leading-snug font-medium text-foreground outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring/50 focus-visible:after:ring-inset"
                          >
                            {r.item.name}
                          </button>
                          <span className="text-[13px] text-muted-foreground">Item code {r.item.sku}</span>
                        </div>
                      </div>
                      <div className="flex w-full items-center justify-between gap-3 pl-11 sm:ml-auto sm:w-auto sm:justify-end sm:pl-0">
                        <div className="flex flex-col items-end gap-1">
                          <span className="whitespace-nowrap">
                            <span className="text-base font-semibold text-foreground tabular">{num(r.qty)}</span>{" "}
                            <span className="text-[13px] text-muted-foreground">{unitWord(r.qty, r.item.unit)}</span>
                          </span>
                          <StockMeter qty={r.qty} min={r.min} size="sm" />
                          <span className="text-[13px] whitespace-nowrap text-muted-foreground">
                            Minimum {qtyText(r.min, r.item.unit)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={r.status} />
                          {r.status === "ok" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="relative z-10"
                              onClick={() => openPanel({ type: "item", id: r.item.id })}
                            >
                              {ACTION.view}
                            </Button>
                          ) : (
                            <Button size="sm" className="relative z-10" onClick={() => refill(r)}>
                              {moveIn ? <ArrowRightLeftIcon strokeWidth={1.75} /> : <TruckIcon strokeWidth={1.75} />}
                              {moveIn ? "Move stock here" : ACTION.reorder}
                            </Button>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}

function plural(n: number) {
  return `${num(n)} ${n === 1 ? "item" : "items"}`
}

/* ------------------------------------------------------------------ */
/* Last 7 days: what came in and went out of this godown, one line per  */
/* document, written as a plain sentence                                */
/* ------------------------------------------------------------------ */
const MOVE_KIND: Record<MovementType, { Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; tone: Tone }> = {
  sale: { Icon: ShoppingCartIcon, tone: "info" },
  purchase: { Icon: PackageCheckIcon, tone: "positive" },
  transfer_in: { Icon: ArrowRightLeftIcon, tone: "neutral" },
  transfer_out: { Icon: ArrowRightLeftIcon, tone: "neutral" },
  adjustment: { Icon: ClipboardCheckIcon, tone: "warning" },
}

function MovesThisWeek({ godown }: { godown: Godown }) {
  const movements = useInventory((s) => s.movements)
  const items = useInventory((s) => s.items)
  const openPanel = useUI((s) => s.openPanel)
  const names = useRefNames()
  const now = useNow()

  const groups = useMemo(() => {
    const since = now - WEEK
    const map = new Map<string, { ref: string; type: MovementType; units: number; date: string; lines: number; itemId: string }>()
    for (const m of movements) {
      if (m.godownId !== godown.id) continue
      if (new Date(m.date).getTime() < since) continue
      const g = map.get(m.ref)
      if (g) {
        g.units += m.qty
        g.lines += 1
        if (m.date > g.date) g.date = m.date
      } else {
        map.set(m.ref, { ref: m.ref, type: m.type, units: m.qty, date: m.date, lines: 1, itemId: m.itemId })
      }
    }
    return [...map.values()].sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [movements, godown.id, now])

  const unitsIn = groups.reduce((s, g) => s + Math.max(0, g.units), 0)
  const unitsOut = groups.reduce((s, g) => s + Math.max(0, -g.units), 0)

  const sentence = (g: (typeof groups)[number]) => {
    switch (g.type) {
      case "sale":
        return `Sold to ${names.customerOf(g.ref)}`
      case "purchase":
        return `Received from ${names.supplierOf(g.ref)}`
      case "transfer_out":
        return `Moved to ${names.transferOf(g.ref)?.to ?? "another godown"}`
      case "transfer_in":
        return `Moved in from ${names.transferOf(g.ref)?.from ?? "another godown"}`
      case "adjustment":
        return `Count corrected: ${items.find((i) => i.id === g.itemId)?.name ?? "an item"}`
    }
  }

  return (
    <Panel
      title={`Last 7 days at ${godown.name}`}
      description={
        groups.length ? `${num(unitsIn)} units came in and ${num(unitsOut)} went out.` : "What came in and went out this week."
      }
      flush
      className="xl:self-start"
    >
      {groups.length === 0 ? (
        <EmptyState
          icon={ArrowRightLeftIcon}
          title="Nothing moved this week"
          description={`No stock came in or went out of ${godown.name} in the last 7 days.`}
        />
      ) : (
        <>
          <ul className="scroll-quiet flex max-h-[640px] flex-col overflow-y-auto border-t border-border">
            {groups.slice(0, 20).map((g) => {
              const k = MOVE_KIND[g.type]
              const openable = isOpenableRef(g.ref)
              return (
                <li key={g.ref} className="border-b border-border last:border-0">
                  <button
                    type="button"
                    onClick={() => (openable ? openRef(g.ref) : openPanel({ type: "item", id: g.itemId }))}
                    className="flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors outline-none hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset"
                  >
                    <span className={cn("mt-0.5 grid size-9 shrink-0 place-items-center rounded-full", TONE_PILL[k.tone])}>
                      <k.Icon className="size-[18px]" strokeWidth={1.75} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-[15px] leading-snug text-foreground">{sentence(g)}</span>
                      <span className="text-[13px] text-muted-foreground">
                        {plural(g.lines)} · {timeAgo(g.date, now)} · {g.ref}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end">
                      <span className={cn("text-[15px] font-semibold tabular", g.units > 0 ? "text-positive" : "text-foreground")}>
                        {signed(g.units)}
                      </span>
                      <span className="text-[13px] text-muted-foreground">units</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          {groups.length > 20 ? (
            <p className="border-t border-border px-5 py-3 text-[13px] text-muted-foreground">
              Showing the latest 20 of {num(groups.length)}. Open an item to see its full stock history.
            </p>
          ) : null}
        </>
      )}
    </Panel>
  )
}
