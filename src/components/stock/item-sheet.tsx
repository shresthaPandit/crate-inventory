"use client"

import { useMemo, useState } from "react"
import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts"
import { ArrowLeftRightIcon, SlidersHorizontalIcon, TruckIcon } from "lucide-react"
import { toast } from "sonner"
import { AnimatedNumber } from "@/components/kit/animated-number"
import { NumberInput } from "@/components/kit/line-editor"
import { BinLabel, Field, Mono } from "@/components/kit/misc"
import { StatusBadge } from "@/components/kit/status-badge"
import { StockMeter } from "@/components/kit/stock-meter"
import { Button } from "@/components/ui/button"
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { committedQty, incomingQty, onHand, stockStatus, suggestedReorder } from "@/lib/calc"
import { dateShort, dateTime, inr, num, pct, signed } from "@/lib/format"
import { useInventory, useUI } from "@/lib/store"
import type { Item } from "@/lib/types"
import { cn } from "@/lib/utils"
import { isOpenableRef, MOVEMENT_LABEL, openRef } from "./shared"

const DAY = 86_400_000

export function ItemSheet({
  id,
  open,
  onOpenChange,
}: {
  id: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const items = useInventory((s) => s.items)
  const item = id ? items.find((i) => i.id === id) : undefined

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[600px]">
        {item ? (
          <ItemSheetBody key={item.id} item={item} />
        ) : (
          <div className="px-6 pt-5 pb-4">
            <SheetTitle>Item</SheetTitle>
            <SheetDescription>This item is no longer in the catalogue</SheetDescription>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function ItemSheetBody({ item }: { item: Item }) {
  const stock = useInventory((s) => s.stock)
  const godowns = useInventory((s) => s.godowns)
  const suppliers = useInventory((s) => s.suppliers)
  const purchaseOrders = useInventory((s) => s.purchaseOrders)
  const salesOrders = useInventory((s) => s.salesOrders)
  const movements = useInventory((s) => s.movements)
  const updateItem = useInventory((s) => s.updateItem)
  const openComposer = useUI((s) => s.openComposer)

  const total = onHand(stock, item.id)
  const status = stockStatus(total, item.minLevel)
  const incoming = useMemo(() => incomingQty(purchaseOrders, item.id), [purchaseOrders, item.id])
  const committed = useMemo(() => committedQty(salesOrders, item.id), [salesOrders, item.id])
  const supplier = suppliers.find((s) => s.id === item.supplierId)
  const margin = item.price > 0 ? ((item.price - item.cost) / item.price) * 100 : 0

  const itemMoves = useMemo(() => movements.filter((m) => m.itemId === item.id), [movements, item.id])

  const [minDraft, setMinDraft] = useState(item.minLevel)

  const reorderQty = Math.max(10, Math.ceil(suggestedReorder(item, total, incoming) / 10) * 10)

  const meta = [
    `min ${num(item.minLevel)}`,
    incoming ? `${num(incoming)} on the way` : null,
    committed ? `${num(committed)} committed to open orders` : null,
  ].filter(Boolean)

  return (
    <>
      {/* Header */}
      <div className="flex items-start gap-4 border-b border-border px-6 pt-5 pb-4 pr-14">
        <BinLabel category={item.category} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <SheetTitle className="text-base leading-snug">{item.name}</SheetTitle>
          <SheetDescription className="flex items-center gap-1.5 text-xs">
            <Mono>{item.sku}</Mono>
            <span aria-hidden>·</span>
            <span>{item.category}</span>
          </SheetDescription>
        </div>
        <StatusBadge status={status} className="mt-0.5 shrink-0" />
      </div>

      {/* Body */}
      <div className="scroll-quiet flex flex-1 flex-col gap-8 overflow-y-auto px-6 py-5">
        {/* On hand */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted-foreground">On hand, all godowns</span>
              <div className="flex items-baseline gap-1.5">
                <AnimatedNumber value={total} className="text-[32px] leading-none font-medium tracking-[-0.02em]" />
                <span className="text-sm text-muted-foreground">{item.unit}</span>
              </div>
            </div>
            <StockMeter qty={total} min={item.minLevel} className="mb-1" />
          </div>
          <p className="font-mono text-xs text-muted-foreground tabular">{meta.join(" · ")}</p>
          <div className="grid grid-cols-2 gap-4 rounded-lg border border-border px-4 py-3 sm:grid-cols-4">
            <Field label="Price">
              <span className="font-mono tabular">{inr(item.price)}</span>
            </Field>
            <Field label="Cost">
              <span className="font-mono tabular">{inr(item.cost)}</span>
            </Field>
            <Field label="Margin">
              <span className="font-mono tabular">{pct(margin)}</span>
            </Field>
            <Field label="Supplier">
              <span className="block truncate" title={supplier?.name}>
                {supplier?.name ?? "—"}
              </span>
            </Field>
          </div>
        </section>

        {/* By godown */}
        <section className="flex flex-col gap-3">
          <SectionTitle>By godown</SectionTitle>
          <div className="flex flex-col gap-2">
            {godowns.map((g) => {
              const qty = onHand(stock, item.id, g.id)
              const share = total > 0 ? qty / total : 0
              return (
                <div key={g.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_64px] items-center gap-4">
                  <div className="flex min-w-0 items-baseline gap-2">
                    <span className="truncate text-sm">{g.name}</span>
                    <Mono className="text-[11px]">{g.code}</Mono>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-foreground/8">
                    <div
                      className={cn("h-full origin-left rounded-full transition-transform duration-500 ease-out-quint", qty === 0 ? "bg-negative" : "bg-fg-secondary")}
                      style={{ transform: `scaleX(${qty === 0 ? 0 : Math.max(0.02, share)})` }}
                    />
                  </div>
                  <span className={cn("text-right font-mono text-sm tabular", qty === 0 ? "text-negative" : "text-foreground")}>
                    {num(qty)}
                  </span>
                </div>
              )
            })}
          </div>
        </section>

        {/* History */}
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <SectionTitle>Stock history</SectionTitle>
            <span className="text-xs text-muted-foreground">Last 60 days</span>
          </div>
          <HistoryChart item={item} total={total} />
        </section>

        {/* Ledger */}
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <SectionTitle>Ledger</SectionTitle>
            <span className="text-xs text-muted-foreground">
              {itemMoves.length > 30 ? `Latest 30 of ${num(itemMoves.length)}` : `${num(itemMoves.length)} entries`}
            </span>
          </div>
          {itemMoves.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              No movements recorded yet
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <div className="grid grid-cols-[minmax(0,1fr)_72px_56px_64px] gap-3 border-b border-border bg-raised/40 px-3 py-2 text-xs text-muted-foreground sm:grid-cols-[112px_minmax(0,1fr)_72px_56px_56px_64px]">
                <span>Date</span>
                <span className="hidden sm:block">Type</span>
                <span>Ref</span>
                <span className="hidden sm:block">Godown</span>
                <span className="text-right">Change</span>
                <span className="text-right">Balance</span>
              </div>
              <ul>
                {itemMoves.slice(0, 30).map((m) => {
                  const gd = godowns.find((g) => g.id === m.godownId)
                  return (
                    <li
                      key={m.id}
                      className="grid grid-cols-[minmax(0,1fr)_72px_56px_64px] items-center gap-3 border-b border-border px-3 py-2 text-sm last:border-0 sm:grid-cols-[112px_minmax(0,1fr)_72px_56px_56px_64px]"
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-xs text-fg-secondary tabular">{dateTime(m.date)}</span>
                        <span className="truncate text-[11px] text-muted-foreground sm:hidden">{MOVEMENT_LABEL[m.type]}</span>
                      </span>
                      <span className="hidden min-w-0 truncate text-xs text-fg-secondary sm:block" title={m.note}>
                        {MOVEMENT_LABEL[m.type]}
                        {m.note ? <span className="text-muted-foreground"> · {m.note}</span> : null}
                      </span>
                      {isOpenableRef(m.ref) ? (
                        <button
                          type="button"
                          onClick={() => openRef(m.ref)}
                          className="w-fit rounded font-mono text-xs text-fg-secondary underline-offset-4 transition-colors outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                        >
                          {m.ref}
                        </button>
                      ) : (
                        <Mono>{m.ref}</Mono>
                      )}
                      <Mono className="hidden sm:block">{gd?.code ?? "—"}</Mono>
                      <span className={cn("text-right font-mono text-xs tabular", m.qty > 0 ? "text-positive" : "text-foreground")}>
                        {signed(m.qty)}
                      </span>
                      <span className="text-right font-mono text-xs text-muted-foreground tabular">{num(m.balanceAfter)}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </section>

        {/* Settings */}
        <section className="flex flex-col gap-3">
          <SectionTitle>Reorder point</SectionTitle>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">Min level, all godowns</span>
              <NumberInput value={minDraft} onChange={setMinDraft} ariaLabel="Min level" className="w-32" />
            </label>
            <Button
              variant="outline"
              size="lg"
              disabled={minDraft === item.minLevel || minDraft <= 0}
              onClick={() => {
                updateItem(item.id, { minLevel: minDraft })
                toast.success("Min level updated", {
                  description: `${item.name}: ${num(item.minLevel)} → ${num(minDraft)}`,
                })
              }}
            >
              Save
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Items at or below this level show on the dashboard and in stock alerts</p>
        </section>
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-6 py-4">
        <Button variant="ghost" className="gap-1.5" onClick={() => openComposer({ type: "adjust", defaults: { itemId: item.id } })}>
          <SlidersHorizontalIcon className="size-4" strokeWidth={1.5} />
          Adjust
        </Button>
        <Button
          variant="outline"
          className="gap-1.5"
          onClick={() => openComposer({ type: "transfer", defaults: { lines: [{ itemId: item.id, qty: 1 }] } })}
        >
          <ArrowLeftRightIcon className="size-4" strokeWidth={1.5} />
          Transfer
        </Button>
        <Button
          className="gap-1.5"
          onClick={() =>
            openComposer({
              type: "purchase",
              defaults: {
                supplierId: item.supplierId,
                godownId: "g-bho",
                lines: [{ itemId: item.id, qty: reorderQty, rate: item.cost }],
              },
            })
          }
        >
          <TruckIcon className="size-4" strokeWidth={1.5} />
          Reorder
        </Button>
      </div>
    </>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-medium text-foreground">{children}</h3>
}

/* ------------------------------------------------------------------ */
/* Stock history: end-of-day balance for the last 60 days, rebuilt from */
/* the ledger (current total minus every movement after that day).      */
/* ------------------------------------------------------------------ */

const chartConfig = {
  balance: { label: "On hand", color: "var(--chart-1)" },
} satisfies ChartConfig

function HistoryChart({ item, total }: { item: Item; total: number }) {
  const movements = useInventory((s) => s.movements)

  const data = useMemo(() => {
    const mine = movements.filter((m) => m.itemId === item.id).map((m) => ({ t: new Date(m.date).getTime(), qty: m.qty }))
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    const end = today.getTime()
    const points: { t: number; label: string; balance: number }[] = []
    for (let d = 59; d >= 0; d--) {
      const dayEnd = end - d * DAY
      const after = mine.reduce((s, m) => (m.t > dayEnd ? s + m.qty : s), 0)
      points.push({ t: dayEnd, label: dateShort(dayEnd), balance: Math.max(0, total - after) })
    }
    return points
  }, [movements, item.id, total])

  const max = Math.max(item.minLevel, ...data.map((d) => d.balance))
  const gradientId = `hist-${item.id}`

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-[180px] w-full">
      <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-balance)" stopOpacity={0.16} />
            <stop offset="100%" stopColor="var(--color-balance)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={40}
          tickMargin={8}
          tick={{ fontSize: 11, fontFamily: "var(--font-geist-mono)", fill: "var(--muted-foreground)" }}
        />
        <YAxis
          width={40}
          tickLine={false}
          axisLine={false}
          domain={[0, Math.ceil(max * 1.15)]}
          tickFormatter={(v: number) => num(v)}
          tick={{ fontSize: 11, fontFamily: "var(--font-geist-mono)", fill: "var(--muted-foreground)" }}
        />
        <ReferenceLine
          y={item.minLevel}
          stroke="var(--muted-foreground)"
          strokeOpacity={0.6}
          strokeDasharray="4 4"
          label={{
            value: "Min",
            position: "insideTopRight",
            fill: "var(--muted-foreground)",
            fontSize: 11,
            fontFamily: "var(--font-geist-mono)",
          }}
        />
        <ChartTooltip
          cursor={{ stroke: "var(--border)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const p = payload[0].payload as { label: string; balance: number }
            return (
              <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-float">
                <p className="text-xs text-muted-foreground">{p.label}</p>
                <p className="font-mono text-sm text-foreground tabular">
                  {num(p.balance)} <span className="text-muted-foreground">{item.unit}</span>
                </p>
              </div>
            )
          }}
        />
        <Area
          type="stepAfter"
          dataKey="balance"
          stroke="var(--color-balance)"
          strokeWidth={1.5}
          fill={`url(#${gradientId})`}
          isAnimationActive={false}
          activeDot={{ r: 3, strokeWidth: 0, fill: "var(--color-balance)" }}
        />
      </AreaChart>
    </ChartContainer>
  )
}
