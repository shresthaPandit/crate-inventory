"use client"

import { useMemo, useState } from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { ArrowDownToLineIcon, ArrowUpFromLineIcon, PackageSearchIcon, TriangleAlertIcon, WarehouseIcon } from "lucide-react"
import { HelpTip } from "@/components/kit/help"
import { EmptyState, ItemIcon, SearchInput, Segmented } from "@/components/kit/misc"
import { Panel } from "@/components/kit/panel"
import { StatCard } from "@/components/kit/stat-card"
import { StatusBadge } from "@/components/kit/status-badge"
import { Button } from "@/components/ui/button"
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { date, dateShort, inr, inrCompact, num, plural, signed } from "@/lib/format"
import { useUI } from "@/lib/store"
import type { Category, StockStatus } from "@/lib/types"
import { cn } from "@/lib/utils"
import { GLOSSARY } from "@/lib/words"
import type { Range } from "./range"
import {
  AXIS_TICK,
  CHART_CLASS,
  ChartTip,
  HeadHelp,
  IN_COLOR,
  ItemCellBody,
  MobileRow,
  NumCell,
  RankRow,
  ResultsLine,
  deltaPct,
  qtyUnit,
  rowLink,
} from "./parts"
import type { StockReport as StockData } from "./use-reports"

const config = { value: { label: "Stock value", color: IN_COLOR } } satisfies ChartConfig

const meaning = (term: string) => GLOSSARY.find((g) => g.term === term)?.meaning
const STOCK_VALUE_HELP = meaning("Stock value") ?? "What all the items in your godowns cost you to buy."
const MIN_LEVEL_HELP = meaning("Minimum level") ?? "The lowest amount you want to keep."
const OTHER_HELP =
  "Stock corrections after a count, and stock moved between godowns. Moving stock between godowns does not change the total."

type Filter = "all" | Exclude<StockStatus, "ok">

export function StockReport({ data, range }: { data: StockData; range: Range }) {
  const openPanel = useUI((s) => s.openPanel)
  const [q, setQ] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [cat, setCat] = useState<"all" | Category>("all")

  const categories = useMemo(() => Array.from(new Set(data.rows.map((r) => r.item.category))).sort(), [data.rows])

  const searched = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return data.rows.filter((r) => {
      if (cat !== "all" && r.item.category !== cat) return false
      if (!needle) return true
      return r.item.name.toLowerCase().includes(needle) || r.item.sku.toLowerCase().includes(needle)
    })
  }, [data.rows, q, cat])

  const rows = useMemo(() => (filter === "all" ? searched : searched.filter((r) => r.status === filter)), [searched, filter])

  const isFiltered = q.trim() !== "" || cat !== "all" || filter !== "all"
  const clear = () => {
    setQ("")
    setCat("all")
    setFilter("all")
  }

  const valueChange = data.openingValue ? ((data.closingValue - data.openingValue) / data.openingValue) * 100 : 0
  const roundedChange = Math.abs(valueChange) < 10 ? Math.round(Math.abs(valueChange) * 10) / 10 : Math.round(Math.abs(valueChange))
  const maxCat = data.byCategory[0]?.value || 1
  const hasMovement = data.unitsIn + data.unitsOut > 0 || data.series.some((p) => p.value !== data.closingValue)
  const since = dateShort(range.from)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Stock value"
          value={data.closingValue}
          kind="inr"
          icon={WarehouseIcon}
          tone="info"
          delta={{
            text: roundedChange === 0 ? `Same as on ${since}` : `${valueChange > 0 ? "Up" : "Down"} ${roundedChange}% since ${since}`,
            tone: "neutral",
          }}
          footnote={<HelpTip label="What is stock value?">{STOCK_VALUE_HELP}</HelpTip>}
        />
        <StatCard
          label="Came in"
          value={data.unitsIn}
          suffix="units"
          icon={ArrowDownToLineIcon}
          tone="positive"
          delta={deltaPct(data.unitsIn, data.prevUnitsIn, range.compareLabel, "neutral")}
          footnote={data.receipts ? `From ${plural(data.receipts, "delivery", "deliveries")}` : "Nothing arrived"}
        />
        <StatCard
          label="Went out"
          value={data.unitsOut}
          suffix="units"
          icon={ArrowUpFromLineIcon}
          tone="info"
          delta={deltaPct(data.unitsOut, data.prevUnitsOut, range.compareLabel)}
          footnote={data.shipments ? `In ${plural(data.shipments, "shipped order")}` : "Nothing shipped"}
        />
        <StatCard
          label="Items to order more"
          value={data.lowCount}
          suffix={`of ${data.rows.length}`}
          icon={TriangleAlertIcon}
          tone={data.lowCount ? "warning" : "positive"}
          delta={
            data.lowCount
              ? { text: "Running low or out of stock", tone: "negative" }
              : { text: "Every item is above its minimum level", tone: "positive" }
          }
          footnote={<HelpTip label="What is the minimum level?">{MIN_LEVEL_HELP}</HelpTip>}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel
          title={
            <span className="inline-flex items-center gap-1">
              Stock value each day
              <HelpTip label="What is stock value?">{STOCK_VALUE_HELP}</HelpTip>
            </span>
          }
          description={`What all your stock was worth at cost, each day from ${date(range.from)} to today.`}
          className="xl:col-span-2"
          action={
            <span className="text-sm text-fg-secondary tabular">
              {inr(data.openingValue)} → <span className="font-semibold text-foreground">{inr(data.closingValue)}</span>
            </span>
          }
        >
          {hasMovement ? (
            <ChartContainer config={config} className={CHART_CLASS}>
              <AreaChart data={data.series} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="stock-value-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.2} />
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
                  minTickGap={36}
                  tickMargin={8}
                />
                <YAxis
                  tickFormatter={(v: number) => inrCompact(v)}
                  tickLine={false}
                  axisLine={false}
                  tick={AXIS_TICK}
                  width={64}
                  domain={[(min: number) => Math.floor(min * 0.97), (max: number) => Math.ceil(max * 1.02)]}
                />
                <ChartTooltip
                  cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
                  content={(p) => {
                    const d = p.payload?.[0]?.payload as { t: number; value: number } | undefined
                    if (!p.active || !d) return null
                    return <ChartTip title={date(d.t)} rows={[{ label: "Stock value", value: inr(d.value), color: IN_COLOR }]} />
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--color-value)"
                  strokeWidth={2.25}
                  fill="url(#stock-value-fill)"
                  activeDot={{ r: 4.5, strokeWidth: 0, fill: "var(--color-value)" }}
                  animationDuration={600}
                />
              </AreaChart>
            </ChartContainer>
          ) : (
            <EmptyState
              icon={PackageSearchIcon}
              title="No stock came in or went out in this time period"
              description="Pick a longer time period to see how the value changed."
            />
          )}
        </Panel>

        <Panel title="Stock value by kind of item" description="What the stock in each group is worth today, at cost.">
          <div className="flex flex-col divide-y divide-border">
            {data.byCategory.map((c) => (
              <RankRow
                key={c.category}
                label={c.category}
                meta={`${num(c.units)} units in stock`}
                value={inr(c.value)}
                share={c.value / maxCat}
                barColor={IN_COLOR}
              />
            ))}
          </div>
        </Panel>
      </div>

      <Panel
        flush
        title="Stock by item"
        description="How much of each item came in, went out, and is in stock now. Tap an item to see it."
      >
        <div className="flex flex-col gap-3 px-5 pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
            <SearchInput value={q} onChange={setQ} placeholder="Search by item name or code…" />
            <Segmented<Filter>
              value={filter}
              onValueChange={setFilter}
              items={[
                { value: "all", label: "All", count: searched.length },
                { value: "low", label: "Running low", count: searched.filter((r) => r.status === "low").length },
                { value: "out", label: "Out of stock", count: searched.filter((r) => r.status === "out").length },
              ]}
            />
            <Select value={cat} onValueChange={(v) => setCat(v as "all" | Category)}>
              <SelectTrigger className="w-full sm:w-56" aria-label="Filter by kind of item">
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
          <ResultsLine shown={rows.length} total={data.rows.length} noun="items" filtered={isFiltered} onClear={clear} />
        </div>

        {rows.length ? (
          <>
            {/* Phones: one card per item */}
            <ul className="divide-y divide-border border-t border-border md:hidden">
              {rows.map((r) => (
                <MobileRow
                  key={r.item.id}
                  onClick={() => openPanel({ type: "item", id: r.item.id })}
                  icon={<ItemIcon category={r.item.category} size="sm" />}
                  title={r.item.name}
                  subtitle={`Item code ${r.item.sku}`}
                  badge={<StatusBadge status={r.status} />}
                  figures={[
                    { label: "In stock now", value: qtyUnit(r.closing, r.item.unit) },
                    { label: "Came in", value: r.in ? signed(r.in) : "—", className: r.in ? "text-positive" : "text-muted-foreground" },
                    { label: "Went out", value: r.out ? signed(-r.out) : "—", className: r.out ? "text-info" : "text-muted-foreground" },
                  ]}
                />
              ))}
            </ul>

            {/* Tablets and computers */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5">Item</TableHead>
                    <TableHead className="hidden text-right 2xl:table-cell">At start</TableHead>
                    <TableHead className="text-right">Came in</TableHead>
                    <TableHead className="text-right">Went out</TableHead>
                    <TableHead className="hidden text-right xl:table-cell">
                      <HeadHelp label="What is moved or corrected?" help={OTHER_HELP}>
                        Moved or corrected
                      </HeadHelp>
                    </TableHead>
                    <TableHead className="text-right">In stock now</TableHead>
                    <TableHead className="hidden text-right xl:table-cell">Stock value</TableHead>
                    <TableHead className="pr-5">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.item.id} {...rowLink(() => openPanel({ type: "item", id: r.item.id }))}>
                      <TableCell className="pl-5">
                        <ItemCellBody item={r.item} />
                      </TableCell>
                      <NumCell value={r.opening} className="hidden 2xl:table-cell" />
                      <NumCell value={r.in} dashZero className={cn(r.in && "text-positive")}>
                        {signed(r.in)}
                      </NumCell>
                      <NumCell value={r.out} dashZero className={cn(r.out && "text-info")}>
                        {signed(-r.out)}
                      </NumCell>
                      <NumCell value={r.other} dashZero className="hidden xl:table-cell">
                        {signed(r.other)}
                      </NumCell>
                      <NumCell className="font-medium text-foreground">{qtyUnit(r.closing, r.item.unit)}</NumCell>
                      <NumCell className="hidden xl:table-cell">{inr(r.value)}</NumCell>
                      <TableCell className="pr-5">
                        <StatusBadge status={r.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                {!isFiltered ? (
                  <TableFooter className="bg-raised/50">
                    <TableRow className="hover:bg-transparent">
                      <TableCell className="pl-5 font-semibold text-foreground">Total, {plural(rows.length, "item")}</TableCell>
                      <NumCell value={data.totals.opening} className="hidden font-semibold text-foreground 2xl:table-cell" />
                      <NumCell className="font-semibold text-foreground">{signed(data.totals.in)}</NumCell>
                      <NumCell className="font-semibold text-foreground">{signed(-data.totals.out)}</NumCell>
                      <NumCell className="hidden font-semibold text-foreground xl:table-cell">{signed(data.totals.other)}</NumCell>
                      <NumCell value={data.totals.closing} className="font-semibold text-foreground" />
                      <NumCell className="hidden font-semibold text-foreground xl:table-cell">{inr(data.totals.value)}</NumCell>
                      <TableCell className="pr-5" />
                    </TableRow>
                  </TableFooter>
                ) : null}
              </Table>
            </div>
          </>
        ) : (
          <EmptyState
            icon={PackageSearchIcon}
            title="No items match"
            description={
              filter === "out"
                ? "Nothing here is out of stock."
                : filter === "low"
                  ? "Nothing here is running low."
                  : "Try another item name or code, or show all kinds of items."
            }
            action={
              <Button variant="outline" onClick={clear}>
                Clear filters
              </Button>
            }
          />
        )}
      </Panel>
    </div>
  )
}
