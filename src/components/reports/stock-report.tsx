"use client"

import { useMemo, useState } from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { PackageSearchIcon } from "lucide-react"
import { EmptyState, SearchInput } from "@/components/kit/misc"
import { Panel } from "@/components/kit/panel"
import { StatCard } from "@/components/kit/stat-card"
import { StatusBadge } from "@/components/kit/status-badge"
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { date, dateShort, inr, inrCompact, num, pct, signed } from "@/lib/format"
import { useUI } from "@/lib/store"
import type { Range } from "./range"
import { AXIS_TICK, CHART_CLASS, ChartTip, ItemCellBody, NumCell, RankRow, deltaPct, rowLink } from "./parts"
import type { StockReport as StockData } from "./use-reports"

const config = { value: { label: "Stock value", color: "var(--chart-1)" } } satisfies ChartConfig

export function StockReport({ data, range }: { data: StockData; range: Range }) {
  const openPanel = useUI((s) => s.openPanel)
  const [q, setQ] = useState("")

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return data.rows
    return data.rows.filter((r) => r.item.name.toLowerCase().includes(needle) || r.item.sku.toLowerCase().includes(needle))
  }, [data.rows, q])

  const valueChange = data.openingValue ? ((data.closingValue - data.openingValue) / data.openingValue) * 100 : 0
  const maxCat = data.byCategory[0]?.value ?? 1
  const hasMovement = data.unitsIn + data.unitsOut > 0 || data.series.some((p) => p.value !== data.closingValue)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Stock value"
          value={data.closingValue}
          kind="inr"
          emphasis
          delta={{
            text: `${pct(valueChange, Math.abs(valueChange) < 10 ? 1 : 0)} since ${dateShort(range.from)}`,
            tone: "neutral",
          }}
        />
        <StatCard
          label="Units in"
          value={data.unitsIn}
          delta={deltaPct(data.unitsIn, data.prevUnitsIn, range.compareLabel, "neutral")}
          footnote={data.receipts ? `${num(data.receipts)} receipts` : undefined}
        />
        <StatCard
          label="Units out"
          value={data.unitsOut}
          delta={deltaPct(data.unitsOut, data.prevUnitsOut, range.compareLabel)}
          footnote={data.shipments ? `${num(data.shipments)} shipments` : undefined}
        />
        <StatCard
          label="Items below min"
          value={data.lowCount}
          suffix={`of ${data.rows.length}`}
          delta={{ text: data.lowCount ? "Need a purchase order" : "All above min level", tone: data.lowCount ? "negative" : "neutral" }}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel
          title="Stock value"
          description={`Closing value at cost, ${date(range.from)} to today`}
          className="xl:col-span-2"
          action={<span className="font-mono text-xs text-muted-foreground tabular">{inr(data.openingValue)} → {inr(data.closingValue)}</span>}
        >
          {hasMovement ? (
            <ChartContainer config={config} className={CHART_CLASS}>
              <AreaChart data={data.series} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="stock-value-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="t"
                  tickFormatter={(t: number) => dateShort(t)}
                  tickLine={false}
                  axisLine={false}
                  tick={AXIS_TICK}
                  minTickGap={32}
                  tickMargin={8}
                />
                <YAxis
                  tickFormatter={(v: number) => inrCompact(v)}
                  tickLine={false}
                  axisLine={false}
                  tick={AXIS_TICK}
                  width={56}
                  domain={[(min: number) => Math.floor(min * 0.97), (max: number) => Math.ceil(max * 1.02)]}
                />
                <ChartTooltip
                  cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
                  content={(p) => {
                    const d = p.payload?.[0]?.payload as { t: number; value: number } | undefined
                    if (!p.active || !d) return null
                    return <ChartTip title={date(d.t)} rows={[{ label: "Closing value", value: inr(d.value), accent: true }]} />
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--color-value)"
                  strokeWidth={1.75}
                  fill="url(#stock-value-fill)"
                  activeDot={{ r: 3.5, strokeWidth: 0, fill: "var(--color-value)" }}
                  animationDuration={600}
                />
              </AreaChart>
            </ChartContainer>
          ) : (
            <EmptyState icon={PackageSearchIcon} title="No stock movement in this period" description="Pick a longer range to see how the value changed" />
          )}
        </Panel>

        <Panel title="Value by category" description="Closing stock at cost">
          <div className="-mx-2 flex flex-col gap-1">
            {data.byCategory.map((c) => (
              <RankRow
                key={c.category}
                label={c.category}
                meta={`${num(c.units)} units`}
                value={inr(c.value)}
                share={c.value / maxCat}
              />
            ))}
          </div>
        </Panel>
      </div>

      <Panel
        flush
        title="Item movement"
        description={`Opening plus in, out and other changes gives today's closing stock`}
        action={<SearchInput value={q} onChange={setQ} placeholder="Search items" className="hidden sm:flex sm:w-56" />}
      >
        <div className="px-4 pb-3 sm:hidden">
          <SearchInput value={q} onChange={setQ} placeholder="Search items" className="w-full sm:w-full" />
        </div>
        {rows.length ? (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Item</TableHead>
                <TableHead className="hidden text-right md:table-cell">Opening</TableHead>
                <TableHead className="hidden text-right sm:table-cell">In</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Out</TableHead>
                <TableHead className="hidden text-right lg:table-cell">Other</TableHead>
                <TableHead className="text-right">Closing</TableHead>
                <TableHead className="hidden text-right md:table-cell">Value</TableHead>
                <TableHead className="pr-5">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const link = rowLink(() => openPanel({ type: "item", id: r.item.id }))
                return (
                  <TableRow key={r.item.id} {...link}>
                    <TableCell className="pl-5">
                      <ItemCellBody item={r.item} />
                    </TableCell>
                    <NumCell value={r.opening} className="hidden md:table-cell" />
                    <NumCell value={r.in} dashZero className="hidden sm:table-cell">
                      {signed(r.in)}
                    </NumCell>
                    <NumCell value={r.out} dashZero className="hidden sm:table-cell">
                      {signed(-r.out)}
                    </NumCell>
                    <NumCell value={r.other} dashZero className="hidden lg:table-cell">
                      {signed(r.other)}
                    </NumCell>
                    <NumCell className="text-foreground">
                      {num(r.closing)}
                      <span className="ml-1 text-[11px] text-muted-foreground">{r.item.unit}</span>
                    </NumCell>
                    <NumCell className="hidden md:table-cell">{inr(r.value)}</NumCell>
                    <TableCell className="pr-5">
                      <StatusBadge status={r.status} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
            {!q ? (
              <TableFooter className="bg-transparent">
                <TableRow className="hover:bg-transparent">
                  <TableCell className="pl-5 text-sm text-fg-secondary">{num(rows.length)} items</TableCell>
                  <NumCell value={data.totals.opening} className="hidden md:table-cell" />
                  <NumCell className="hidden sm:table-cell">{signed(data.totals.in)}</NumCell>
                  <NumCell className="hidden sm:table-cell">{signed(-data.totals.out)}</NumCell>
                  <NumCell className="hidden lg:table-cell">{signed(data.totals.other)}</NumCell>
                  <NumCell value={data.totals.closing} className="text-foreground" />
                  <NumCell className="hidden text-foreground md:table-cell">{inr(data.totals.value)}</NumCell>
                  <TableCell className="pr-5" />
                </TableRow>
              </TableFooter>
            ) : null}
          </Table>
        ) : (
          <EmptyState icon={PackageSearchIcon} title="No items match" description="Try a SKU like WC-FR25 or part of the name" />
        )}
      </Panel>
    </div>
  )
}
