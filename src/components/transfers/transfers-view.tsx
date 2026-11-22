"use client"

import { useMemo, useState } from "react"
import { ArrowLeftRightIcon, ArrowRightIcon, PlusIcon } from "lucide-react"
import { AnimatedNumber } from "@/components/kit/animated-number"
import { EmptyState, Mono, SearchInput } from "@/components/kit/misc"
import { Page, PageHeader, Stagger, StaggerItem } from "@/components/kit/page"
import { Panel } from "@/components/kit/panel"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { onHand } from "@/lib/calc"
import { dateTime, num } from "@/lib/format"
import { useInventory, useUI } from "@/lib/store"
import { nowMs } from "@/components/purchases/lib"

const PAGE = 25
const DAY = 86_400_000

export function TransfersView() {
  const transfers = useInventory((s) => s.transfers)
  const godowns = useInventory((s) => s.godowns)
  const items = useInventory((s) => s.items)
  const stock = useInventory((s) => s.stock)
  const openPanel = useUI((s) => s.openPanel)
  const openComposer = useUI((s) => s.openComposer)

  const [from, setFrom] = useState("all")
  const [q, setQ] = useState("")
  const [limit, setLimit] = useState(PAGE)

  const godownById = useMemo(() => new Map(godowns.map((g) => [g.id, g])), [godowns])
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])

  const godownStats = useMemo(() => {
    const since = nowMs() - 30 * DAY
    return godowns.map((g) => {
      const units = items.reduce((s, it) => s + onHand(stock, it.id, g.id), 0)
      const recent = transfers.filter((t) => new Date(t.date).getTime() >= since)
      const inbound = recent.filter((t) => t.toGodownId === g.id).reduce((s, t) => s + t.lines.reduce((a, l) => a + l.qty, 0), 0)
      const outbound = recent.filter((t) => t.fromGodownId === g.id).reduce((s, t) => s + t.lines.reduce((a, l) => a + l.qty, 0), 0)
      return { godown: g, units, inbound, outbound }
    })
  }, [godowns, items, stock, transfers])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return transfers.filter((t) => {
      if (from !== "all" && t.fromGodownId !== from) return false
      if (!needle) return true
      if (t.number.toLowerCase().includes(needle)) return true
      if ((t.note ?? "").toLowerCase().includes(needle)) return true
      return t.lines.some((l) => {
        const it = itemById.get(l.itemId)
        return it ? it.name.toLowerCase().includes(needle) || it.sku.toLowerCase().includes(needle) : false
      })
    })
  }, [transfers, from, q, itemById])

  const visible = filtered.slice(0, limit)
  const filtersActive = from !== "all" || q !== ""

  return (
    <Page>
      <PageHeader
        title="Transfers"
        description="Stock moved between godowns"
        actions={
          <Button onClick={() => openComposer({ type: "transfer" })} className="gap-1.5 pr-3 pl-2.5">
            <PlusIcon className="size-4" strokeWidth={1.75} />
            New transfer
          </Button>
        }
      />

      <Stagger className="grid gap-3 sm:grid-cols-3">
        {godownStats.map(({ godown, units, inbound, outbound }) => (
          <StaggerItem key={godown.id}>
            <button
              type="button"
              onClick={() => {
                setFrom(from === godown.id ? "all" : godown.id)
                setLimit(PAGE)
              }}
              aria-pressed={from === godown.id}
              className="flex w-full items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors outline-none hover:bg-raised/50 focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:border-foreground/20 aria-pressed:bg-raised/60"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm text-foreground">{godown.name}</span>
                  <Mono>{godown.code}</Mono>
                </div>
                <span className="text-xs text-muted-foreground tabular">
                  30 days: <span className="font-mono">+{num(inbound)}</span> in, <span className="font-mono">−{num(outbound)}</span> out
                </span>
              </div>
              <div className="flex flex-col items-end">
                <AnimatedNumber value={units} className="text-lg leading-none font-medium text-foreground" />
                <span className="mt-1 text-xs text-muted-foreground">units</span>
              </div>
            </button>
          </StaggerItem>
        ))}
      </Stagger>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Select
          value={from}
          onValueChange={(v) => {
            setFrom(v)
            setLimit(PAGE)
          }}
        >
          <SelectTrigger className="w-full sm:w-48" aria-label="From godown">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="all">From any godown</SelectItem>
            {godowns.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                From {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <SearchInput
          value={q}
          onChange={(v) => {
            setQ(v)
            setLimit(PAGE)
          }}
        />
      </div>

      <Panel flush>
        {filtered.length === 0 ? (
          <EmptyState
            icon={ArrowLeftRightIcon}
            title={filtersActive ? "No transfers match" : "No transfers yet"}
            description={filtersActive ? "Try another godown or search" : "Move stock from one godown to another to balance shelves"}
            action={
              filtersActive ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setFrom("all")
                    setQ("")
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button onClick={() => openComposer({ type: "transfer" })}>New transfer</Button>
              )
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-5">Transfer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Items</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="hidden pr-5 lg:table-cell">Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((t) => {
                  const open = () => openPanel({ type: "transfer", id: t.id })
                  const units = t.lines.reduce((s, l) => s + l.qty, 0)
                  return (
                    <TableRow
                      key={t.id}
                      tabIndex={0}
                      onClick={open}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") open()
                      }}
                      className="h-12 cursor-pointer outline-none focus-visible:bg-raised"
                    >
                      <TableCell className="pl-5">
                        <Mono className="text-fg-secondary">{t.number}</Mono>
                      </TableCell>
                      <TableCell className="text-fg-secondary tabular">{dateTime(t.date)}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-2 text-foreground">
                          {godownById.get(t.fromGodownId)?.name}
                          <ArrowRightIcon className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                          {godownById.get(t.toGodownId)?.name}
                        </span>
                      </TableCell>
                      <TableCell className="hidden text-right font-mono text-fg-secondary tabular md:table-cell">{t.lines.length}</TableCell>
                      <TableCell className="text-right font-mono text-foreground tabular">{num(units)}</TableCell>
                      <TableCell className="hidden max-w-[280px] truncate pr-5 text-muted-foreground lg:table-cell">
                        {t.note ?? "—"}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
              <span className="tabular">
                {num(visible.length)} of {num(filtered.length)}
              </span>
              {filtered.length > limit ? (
                <Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + PAGE)} className="text-fg-secondary">
                  Show {Math.min(PAGE, filtered.length - limit)} more
                </Button>
              ) : null}
            </div>
          </>
        )}
      </Panel>
    </Page>
  )
}
