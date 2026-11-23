"use client"

import { useMemo, useState } from "react"
import { ArrowRightIcon, ArrowRightLeftIcon, WarehouseIcon, XIcon } from "lucide-react"
import { EmptyState, Mono, SearchInput, Segmented } from "@/components/kit/misc"
import { Page, PageHeader, Stagger, StaggerItem } from "@/components/kit/page"
import { Panel } from "@/components/kit/panel"
import { StatCard } from "@/components/kit/stat-card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { onHand } from "@/lib/calc"
import { dateTime, num, plural } from "@/lib/format"
import { useInventory, useNow, useUI } from "@/lib/store"
import type { Transfer } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ACTION } from "@/lib/words"
import { itemNames, itemsText, linesQtyText } from "@/components/purchases/lib"

const PAGE = 25
const DAY = 86_400_000

export function TransfersView() {
  const transfers = useInventory((s) => s.transfers)
  const godowns = useInventory((s) => s.godowns)
  const items = useInventory((s) => s.items)
  const stock = useInventory((s) => s.stock)
  const openPanel = useUI((s) => s.openPanel)
  const openComposer = useUI((s) => s.openComposer)
  const now = useNow()

  const [from, setFrom] = useState("all")
  const [to, setTo] = useState("all")
  const [q, setQ] = useState("")
  const [limit, setLimit] = useState(PAGE)

  const godownById = useMemo(() => new Map(godowns.map((g) => [g.id, g])), [godowns])
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])

  const godownStats = useMemo(() => {
    const since = now - 30 * DAY
    const recent = transfers.filter((t) => new Date(t.date).getTime() >= since)
    return godowns.map((g) => {
      const units = items.reduce((s, it) => s + onHand(stock, it.id, g.id), 0)
      const inbound = recent.filter((t) => t.toGodownId === g.id).reduce((s, t) => s + t.lines.reduce((a, l) => a + l.qty, 0), 0)
      const outbound = recent.filter((t) => t.fromGodownId === g.id).reduce((s, t) => s + t.lines.reduce((a, l) => a + l.qty, 0), 0)
      return { godown: g, units, inbound, outbound }
    })
  }, [godowns, items, stock, transfers, now])

  const fromCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of transfers) m.set(t.fromGodownId, (m.get(t.fromGodownId) ?? 0) + 1)
    return m
  }, [transfers])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return transfers.filter((t) => {
      if (from !== "all" && t.fromGodownId !== from) return false
      if (to !== "all" && t.toGodownId !== to) return false
      if (!needle) return true
      if (t.number.toLowerCase().includes(needle)) return true
      if ((t.note ?? "").toLowerCase().includes(needle)) return true
      const route = `${godownById.get(t.fromGodownId)?.name ?? ""} ${godownById.get(t.toGodownId)?.name ?? ""}`.toLowerCase()
      if (route.includes(needle)) return true
      return t.lines.some((l) => {
        const it = itemById.get(l.itemId)
        return it ? it.name.toLowerCase().includes(needle) || it.sku.toLowerCase().includes(needle) : false
      })
    })
  }, [transfers, from, to, q, itemById, godownById])

  const visible = filtered.slice(0, limit)
  const filtersActive = from !== "all" || to !== "all" || q !== ""

  const pickFrom = (v: string) => {
    setFrom(v)
    setLimit(PAGE)
  }
  const clearFilters = () => {
    setFrom("all")
    setTo("all")
    setQ("")
    setLimit(PAGE)
  }
  const newMove = () => openComposer({ type: "transfer" })
  const open = (t: Transfer) => openPanel({ type: "transfer", id: t.id })

  const rowData = (t: Transfer) => ({
    fromName: godownById.get(t.fromGodownId)?.name ?? "Godown",
    toName: godownById.get(t.toGodownId)?.name ?? "Godown",
    count: itemsText(t.lines.length),
    names: itemNames(t.lines, itemById),
    qty: linesQtyText(t.lines, itemById),
    when: dateTime(t.date),
  })

  return (
    <Page>
      <PageHeader
        icon={ArrowRightLeftIcon}
        title="Move stock"
        description="Send items from one godown to another. The total stock stays the same; it just changes place."
        actions={
          <Button size="lg" onClick={newMove}>
            <ArrowRightLeftIcon strokeWidth={2} />
            {ACTION.newTransfer}
          </Button>
        }
      />

      <Stagger className="grid gap-3 sm:grid-cols-3 sm:gap-4">
        {godownStats.map(({ godown, units, inbound, outbound }) => {
          const active = from === godown.id
          return (
            <StaggerItem key={godown.id} className="h-full">
              <StatCard
                className={cn("h-full", active && "border-primary ring-2 ring-primary/20")}
                label={`${godown.name} godown`}
                value={units}
                suffix="units"
                footnote={`Last 30 days: ${num(inbound)} came in, ${num(outbound)} went out`}
                icon={WarehouseIcon}
                tone={active ? "info" : "neutral"}
                onClick={() => pickFrom(active ? "all" : godown.id)}
                actionLabel={active ? "Show all moves" : "Show moves from here"}
              />
            </StaggerItem>
          )
        })}
      </Stagger>

      <div className="flex flex-col gap-3">
        <Segmented<string>
          value={from}
          onValueChange={pickFrom}
          items={[
            { value: "all", label: "All moves", count: transfers.length },
            ...godowns.map((g) => ({ value: g.id, label: `From ${g.name}`, count: fromCounts.get(g.id) ?? 0 })),
          ]}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <SearchInput
            value={q}
            onChange={(v) => {
              setQ(v)
              setLimit(PAGE)
            }}
            placeholder="Search by item, godown, note or move number…"
            className="sm:w-96"
          />
          <Select
            value={to}
            onValueChange={(v) => {
              setTo(v)
              setLimit(PAGE)
            }}
          >
            <SelectTrigger className="w-full sm:w-52" aria-label="Show moves going to this godown">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="start">
              <SelectItem value="all">To any godown</SelectItem>
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
          {filtersActive ? `Showing ${num(filtered.length)} of ${plural(transfers.length, "move")}` : plural(transfers.length, "move")}
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
            icon={ArrowRightLeftIcon}
            title={filtersActive ? "No moves match" : "No stock moved yet"}
            description={
              filtersActive
                ? "Nothing fits these godowns or this search. Clear the filters to see every move."
                : "When one godown runs short, send items from another. The total stock stays the same."
            }
            action={
              filtersActive ? (
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : (
                <Button onClick={newMove}>
                  <ArrowRightLeftIcon strokeWidth={2} />
                  {ACTION.newTransfer}
                </Button>
              )
            }
          />
        </Panel>
      ) : (
        <>
          {/* Phones and tablets: one card per move */}
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:hidden">
            {visible.map((t) => {
              const r = rowData(t)
              return (
                <li key={t.id} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => open(t)}
                    className="group flex h-full w-full flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-card transition-[border-color,box-shadow] outline-none hover:border-primary/40 hover:shadow-float focus-visible:ring-3 focus-visible:ring-ring/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <Route from={r.fromName} to={r.toName} />
                        <Mono>
                          {t.number} · {r.when}
                        </Mono>
                      </div>
                      <span className="shrink-0 text-[15px] font-semibold text-foreground tabular">{r.qty}</span>
                    </div>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-[15px] text-fg-secondary">
                        {r.count}: {r.names}
                      </span>
                      {t.note ? <span className="truncate text-[13px] text-muted-foreground">Note: {t.note}</span> : null}
                    </div>
                    <span className="mt-auto inline-flex items-center gap-1 self-end text-sm font-medium text-primary-ink">
                      {ACTION.view}
                      <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          {/* Wide screens: table */}
          <Panel flush className="hidden xl:flex">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-5">From → To</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="hidden 2xl:table-cell">Note</TableHead>
                  <TableHead className="pr-5 text-right">
                    <span className="sr-only">What to do</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((t) => {
                  const r = rowData(t)
                  return (
                    <TableRow
                      key={t.id}
                      tabIndex={0}
                      onClick={() => open(t)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") open(t)
                      }}
                      className="cursor-pointer outline-none focus-visible:bg-raised"
                    >
                      <TableCell className="pl-5">
                        <div className="flex flex-col gap-0.5">
                          <Route from={r.fromName} to={r.toName} />
                          <Mono>Move {t.number}</Mono>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[260px]">
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="text-foreground">{r.count}</span>
                          <span className="truncate text-[13px] text-muted-foreground">{r.names}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-fg-secondary tabular">{r.when}</TableCell>
                      <TableCell className="text-right font-medium text-foreground tabular">{r.qty}</TableCell>
                      <TableCell className="hidden max-w-[240px] truncate text-muted-foreground 2xl:table-cell">{t.note ?? "—"}</TableCell>
                      <TableCell className="pr-5 text-right">
                        <Button
                          variant="ghost"
                          className="text-fg-secondary"
                          onClick={(e) => {
                            e.stopPropagation()
                            open(t)
                          }}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          {ACTION.view}
                          <ArrowRightIcon strokeWidth={1.75} />
                        </Button>
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
    </Page>
  )
}

/** "Bhosari → Chakan", the way people say it. */
function Route({ from, to }: { from: string; to: string }) {
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-x-2 text-[15px] font-medium text-foreground">
      <span className="truncate">{from}</span>
      <ArrowRightIcon aria-label="to" className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
      <span className="truncate">{to}</span>
    </span>
  )
}
