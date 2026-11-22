"use client"

import { motion } from "motion/react"
import { useMemo, useState } from "react"
import { ArrowLeftRightIcon } from "lucide-react"
import { EmptyState, Mono } from "@/components/kit/misc"
import { EASE, Page, PageHeader } from "@/components/kit/page"
import { Panel } from "@/components/kit/panel"
import { binCode, godownMin, isOpenableRef, openRef, shareOf } from "@/components/stock/shared"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { onHand } from "@/lib/calc"
import { ago, inr, num, signed } from "@/lib/format"
import { CATEGORIES } from "@/lib/seed"
import { useInventory, useNow, useUI } from "@/lib/store"
import type { Godown, Item, MovementType } from "@/lib/types"
import { cn } from "@/lib/utils"

const AISLES = ["A", "B", "C", "D", "E", "F"]
const WEEK = 7 * 86_400_000

export function GodownsView() {
  const godowns = useInventory((s) => s.godowns)
  const items = useInventory((s) => s.items)
  const stock = useInventory((s) => s.stock)
  const [selectedId, setSelectedId] = useState("g-bho")
  const selected = godowns.find((g) => g.id === selectedId) ?? godowns[0]

  const summaries = useMemo(
    () =>
      godowns.map((g) => {
        let units = 0
        let value = 0
        let low = 0
        for (const it of items) {
          const qty = onHand(stock, it.id, g.id)
          units += qty
          value += qty * it.cost
          if (qty <= godownMin(it.minLevel, g.id)) low++
        }
        return { godown: g, units, value, low, used: g.capacity > 0 ? units / g.capacity : 0 }
      }),
    [godowns, items, stock],
  )

  return (
    <Page>
      <PageHeader title="Godowns" description="Where every unit sits right now" />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3" role="radiogroup" aria-label="Godown">
        {summaries.map((s) => (
          <GodownCard key={s.godown.id} {...s} selected={s.godown.id === selected?.id} onSelect={() => setSelectedId(s.godown.id)} />
        ))}
      </div>

      {selected ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <RackMap godown={selected} />
          <MovesThisWeek godown={selected} />
        </div>
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
  used,
  selected,
  onSelect,
}: {
  godown: Godown
  units: number
  value: number
  low: number
  used: number
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex flex-col gap-5 rounded-xl border p-5 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        selected ? "border-foreground/15 bg-raised shadow-highlight" : "border-border bg-card hover:bg-raised/50",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            {selected ? <span aria-hidden className="size-1.5 rounded-full bg-signal" /> : null}
            <span className="text-[15px] font-medium text-foreground">{godown.name}</span>
            <Mono>{godown.code}</Mono>
          </div>
          <span className="truncate text-xs text-muted-foreground">
            {godown.city} · {godown.manager}
          </span>
        </div>
        <span className={cn("shrink-0 text-xs", low > 0 ? "text-warning" : "text-muted-foreground")}>
          {low > 0 ? `${num(low)} low here` : "All above min"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Units on hand</span>
          <span className="font-mono text-lg text-foreground tabular">{num(units)}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Stock value</span>
          <span className="font-mono text-lg text-foreground tabular">{inr(value)}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Capacity used</span>
          <span className="font-mono text-fg-secondary tabular">
            {Math.round(used * 100)}% of {num(godown.capacity)}
          </span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-foreground/8">
          <div
            className={cn("h-full origin-left rounded-full transition-transform duration-500 ease-out-quint", used > 0.9 ? "bg-warning" : "bg-fg-secondary")}
            style={{ transform: `scaleX(${Math.min(1, used)})` }}
          />
        </div>
      </div>
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Rack map — one aisle per category, one bin per item. Fill height is  */
/* stock against 3× this godown's share of the min level; the hairline  */
/* at one third marks the min itself, like the shelf meter's tick.       */
/* ------------------------------------------------------------------ */
function RackMap({ godown }: { godown: Godown }) {
  const items = useInventory((s) => s.items)
  const stock = useInventory((s) => s.stock)
  const openPanel = useUI((s) => s.openPanel)

  const aisles = useMemo(
    () =>
      CATEGORIES.map((cat, i) => ({
        letter: AISLES[i],
        category: cat,
        items: items.filter((it) => it.category === cat),
      })).filter((a) => a.items.length),
    [items],
  )

  return (
    <Panel
      title={`Rack map · ${godown.name}`}
      description={`${Math.round(shareOf(godown.id) * 100)}% of each item's min level is held here`}
      bodyClassName="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-4">
        {aisles.map((aisle) => (
          <div key={aisle.letter} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex w-40 shrink-0 items-center gap-2.5">
              <span className="grid size-6 place-items-center rounded-md border border-border font-mono text-xs text-fg-secondary">
                {aisle.letter}
              </span>
              <span className="truncate text-sm text-muted-foreground">{aisle.category}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {aisle.items.map((it) => (
                <Bin
                  key={it.id}
                  item={it}
                  qty={onHand(stock, it.id, godown.id)}
                  min={godownMin(it.minLevel, godown.id)}
                  godownName={godown.name}
                  onOpen={() => openPanel({ type: "item", id: it.id })}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4 text-xs text-fg-secondary">
          <LegendSwatch className="bg-fg-secondary/25" label="Filled" />
          <LegendSwatch className="bg-warning/30" label="Low" />
          <LegendSwatch className="border border-dashed border-negative/60 bg-transparent" label="Empty" />
        </div>
        <p className="text-xs text-muted-foreground">Bin height shows stock against this godown&apos;s share of the min level</p>
      </div>
    </Panel>
  )
}

function Bin({
  item,
  qty,
  min,
  godownName,
  onOpen,
}: {
  item: Item
  qty: number
  min: number
  godownName: string
  onOpen: () => void
}) {
  const empty = qty <= 0
  const low = !empty && qty <= min
  const fill = empty ? 0 : Math.min(1, qty / (min * 3))

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onOpen}
          aria-label={`${item.name}: ${qty} ${item.unit} at ${godownName}, min share ${min}`}
          className={cn(
            "relative flex h-11 w-[76px] flex-col justify-between overflow-hidden rounded-md border px-1.5 py-1 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            empty ? "border-dashed border-negative/50 hover:bg-negative/5" : "border-border bg-background/40 hover:border-foreground/20",
          )}
        >
          <motion.span
            aria-hidden
            className={cn("absolute inset-0 origin-bottom", low ? "bg-warning/30" : "bg-fg-secondary/25")}
            initial={false}
            animate={{ scaleY: fill }}
            transition={{ duration: 0.6, ease: EASE }}
          />
          <span aria-hidden className="absolute inset-x-0 bottom-1/3 h-px bg-foreground/15" />
          <span className="relative truncate font-mono text-[10px] leading-tight text-muted-foreground">{binCode(item.sku)}</span>
          <span
            className={cn(
              "relative font-mono text-xs leading-tight tabular",
              empty ? "text-negative" : low ? "text-warning" : "text-foreground",
            )}
          >
            {num(qty)}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="flex-col items-start gap-0.5">
        <span className="font-medium">{item.name}</span>
        <span className="font-mono tabular opacity-80">
          {num(qty)} {item.unit} here · min share {num(min)}
        </span>
      </TooltipContent>
    </Tooltip>
  )
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className={cn("size-3 rounded-[3px]", className)} />
      {label}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Moves this week — ledger rows for this godown grouped by document    */
/* ------------------------------------------------------------------ */
const MOVE_LABEL: Record<MovementType, string> = {
  sale: "Sale",
  purchase: "Purchase receipt",
  transfer_in: "Transfer in",
  transfer_out: "Transfer out",
  adjustment: "Adjustment",
}

function MovesThisWeek({ godown }: { godown: Godown }) {
  const movements = useInventory((s) => s.movements)
  // captured once per mount; the week window doesn't need to tick
  const now = useNow()

  const groups = useMemo(() => {
    const since = now - WEEK
    const map = new Map<string, { ref: string; type: MovementType; units: number; date: string; lines: number }>()
    for (const m of movements) {
      if (m.godownId !== godown.id) continue
      if (new Date(m.date).getTime() < since) continue
      const g = map.get(m.ref)
      if (g) {
        g.units += m.qty
        g.lines += 1
        if (m.date > g.date) g.date = m.date
      } else {
        map.set(m.ref, { ref: m.ref, type: m.type, units: m.qty, date: m.date, lines: 1 })
      }
    }
    return [...map.values()].sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [movements, godown.id, now])

  const net = groups.reduce((s, g) => s + g.units, 0)

  return (
    <Panel
      title="Moves this week"
      description={groups.length ? `${num(groups.length)} documents · net ${signed(net)} units` : undefined}
      flush
      className="lg:self-start"
    >
      {groups.length === 0 ? (
        <EmptyState icon={ArrowLeftRightIcon} title="Quiet week" description={`Nothing moved in or out of ${godown.name} in the last 7 days`} />
      ) : (
        <ul className="scroll-quiet flex max-h-[560px] flex-col overflow-y-auto px-2 pb-2">
          {groups.slice(0, 16).map((g) => {
            const openable = isOpenableRef(g.ref)
            const Row = openable ? "button" : "div"
            return (
              <li key={g.ref}>
                <Row
                  {...(openable ? { type: "button" as const, onClick: () => openRef(g.ref) } : {})}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left",
                    openable && "transition-colors outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-ring/50",
                  )}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <Mono className="text-fg-secondary">{g.ref}</Mono>
                      <span className="truncate text-sm text-foreground">{MOVE_LABEL[g.type]}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {g.lines} {g.lines === 1 ? "item" : "items"} · {ago(g.date)}
                    </span>
                  </div>
                  <span className={cn("font-mono text-sm tabular", g.units > 0 ? "text-positive" : "text-foreground")}>
                    {signed(g.units)}
                  </span>
                </Row>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}
