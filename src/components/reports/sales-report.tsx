"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { IndianRupeeIcon, PackageCheckIcon, ReceiptTextIcon, StarIcon } from "lucide-react"
import { HelpTip } from "@/components/kit/help"
import { EmptyState, ItemIcon, SearchInput } from "@/components/kit/misc"
import { Panel } from "@/components/kit/panel"
import { StatCard } from "@/components/kit/stat-card"
import { Button } from "@/components/ui/button"
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { inr, inrCompact, num, plural } from "@/lib/format"
import { useUI } from "@/lib/store"
import type { Category } from "@/lib/types"
import { GLOSSARY } from "@/lib/words"
import type { Range } from "./range"
import {
  AXIS_TICK,
  CHART_CLASS,
  ChartTip,
  HeadHelp,
  ItemCellBody,
  MobileRow,
  NumCell,
  OUT_COLOR,
  RankRow,
  ResultsLine,
  TextStat,
  deltaCount,
  deltaPct,
  qtyUnit,
  rowLink,
} from "./parts"
import type { SalesReport as SalesData } from "./use-reports"

const config = {
  revenue: { label: "Sales", color: OUT_COLOR },
} satisfies ChartConfig

const GST_MEANING = GLOSSARY.find((g) => g.term === "GST")?.meaning
const PROFIT_HELP = "Sales before GST, minus what those items cost you to buy from the supplier."

export function SalesReport({ data, range }: { data: SalesData; range: Range }) {
  const openPanel = useUI((s) => s.openPanel)
  const [q, setQ] = useState("")
  const [cat, setCat] = useState<"all" | Category>("all")

  const categories = useMemo(() => Array.from(new Set(data.byItem.map((r) => r.item.category))).sort(), [data.byItem])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return data.byItem.filter((r) => {
      if (cat !== "all" && r.item.category !== cat) return false
      if (!needle) return true
      return r.item.name.toLowerCase().includes(needle) || r.item.sku.toLowerCase().includes(needle)
    })
  }, [data.byItem, q, cat])

  const isFiltered = q.trim() !== "" || cat !== "all"
  const clear = () => {
    setQ("")
    setCat("all")
  }

  if (!data.orders) {
    return (
      <Panel>
        <EmptyState
          icon={ReceiptTextIcon}
          title="No sales shipped in this time period"
          description="A sale counts here on the day it ships. Pick a longer time period, or ship a waiting order on the Sales page."
          action={
            <Button asChild variant="outline">
              <Link href="/sales">Go to Sales</Link>
            </Button>
          }
        />
      </Panel>
    )
  }

  const top = data.topCustomers[0]
  const topMax = top?.revenue || 1
  const perDay = range.bucket === "day"

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total sales"
          value={data.revenue}
          kind="inr"
          icon={IndianRupeeIcon}
          tone="info"
          delta={deltaPct(data.revenue, data.prevRevenue, range.compareLabel)}
          footnote={
            <span className="inline-flex items-center gap-1">
              With GST
              {GST_MEANING ? <HelpTip label="What is GST?">{GST_MEANING}</HelpTip> : null}
            </span>
          }
        />
        <StatCard
          label="Orders shipped"
          value={data.orders}
          icon={PackageCheckIcon}
          tone="info"
          delta={deltaCount(data.orders, data.prevOrders, range.compareLabel)}
        />
        <StatCard
          label="Average order"
          value={data.avgOrder}
          kind="inr"
          icon={ReceiptTextIcon}
          tone="info"
          delta={deltaPct(data.avgOrder, data.prevAvgOrder, range.compareLabel)}
          footnote="What one order brings in, on average"
        />
        <TextStat
          label="Top customer"
          value={top?.customer.name ?? "None yet"}
          footnote={top ? `${inr(top.revenue)} from ${plural(top.orders, "order")}` : undefined}
          icon={StarIcon}
          tone="positive"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel
          title={perDay ? "Sales each day" : "Sales each week"}
          description={
            perDay
              ? "Each bar is the money from orders shipped that day, with GST. Taller bar, more sales."
              : "Each bar is the money from orders shipped that week, with GST. Taller bar, more sales."
          }
          className="xl:col-span-2"
        >
          <ChartContainer config={config} className={CHART_CLASS}>
            <BarChart data={data.series} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} minTickGap={28} tickMargin={8} />
              <YAxis tickFormatter={(v: number) => inrCompact(v)} tickLine={false} axisLine={false} tick={AXIS_TICK} width={64} />
              <ChartTooltip
                cursor={{ fill: "var(--foreground)", fillOpacity: 0.04 }}
                content={(p) => {
                  const d = p.payload?.[0]?.payload as SalesData["series"][number] | undefined
                  if (!p.active || !d) return null
                  return (
                    <ChartTip
                      title={d.tooltip}
                      rows={[
                        { label: "Sales", value: inr(d.revenue), color: OUT_COLOR },
                        { label: "Orders shipped", value: num(d.orders) },
                      ]}
                    />
                  )
                }}
              />
              <Bar
                dataKey="revenue"
                fill="var(--color-revenue)"
                radius={[4, 4, 0, 0]}
                maxBarSize={perDay ? 24 : 52}
                animationDuration={600}
              />
            </BarChart>
          </ChartContainer>
        </Panel>

        <Panel title="Best customers" description="Who bought the most in this time period, with GST.">
          <div className="flex flex-col divide-y divide-border">
            {data.topCustomers.map((c, i) => (
              <RankRow
                key={c.customer.id}
                label={`${i + 1}. ${c.customer.name}`}
                meta={`${c.customer.city} · ${plural(c.orders, "order")}`}
                value={inr(c.revenue)}
                share={c.revenue / topMax}
              />
            ))}
          </div>
        </Panel>
      </div>

      <Panel
        flush
        title="Items sold"
        description="How much of each item you sold, and the profit on it. Amounts are before GST. Tap an item to see it."
      >
        <div className="flex flex-col gap-3 px-5 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SearchInput value={q} onChange={setQ} placeholder="Search by item name or code…" />
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
          <ResultsLine shown={rows.length} total={data.byItem.length} noun="items" filtered={isFiltered} onClear={clear} />
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
                  figures={[
                    { label: "Sold", value: qtyUnit(r.units, r.item.unit) },
                    { label: "Sales", value: inr(r.revenue) },
                    { label: "Profit", value: inr(r.margin), className: r.margin < 0 ? "text-negative" : undefined },
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
                    <TableHead className="text-right">Quantity sold</TableHead>
                    <TableHead className="text-right">Sales</TableHead>
                    <TableHead className="hidden text-right lg:table-cell">
                      <HeadHelp label="What is profit?" help={PROFIT_HELP}>
                        Profit
                      </HeadHelp>
                    </TableHead>
                    <TableHead className="hidden pr-5 text-right xl:table-cell">Profit %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.item.id} {...rowLink(() => openPanel({ type: "item", id: r.item.id }))}>
                      <TableCell className="pl-5">
                        <ItemCellBody item={r.item} />
                      </TableCell>
                      <NumCell>{qtyUnit(r.units, r.item.unit)}</NumCell>
                      <NumCell className="font-medium text-foreground">{inr(r.revenue)}</NumCell>
                      <NumCell className="hidden lg:table-cell">{inr(r.margin)}</NumCell>
                      <NumCell className="hidden pr-5 xl:table-cell">
                        {r.revenue ? `${((r.margin / r.revenue) * 100).toFixed(1)}%` : "—"}
                      </NumCell>
                    </TableRow>
                  ))}
                </TableBody>
                {!isFiltered ? (
                  <TableFooter className="bg-raised/50">
                    <TableRow className="hover:bg-transparent">
                      <TableCell className="pl-5 font-semibold text-foreground">Total, {plural(rows.length, "item")}</TableCell>
                      <NumCell value={data.totals.units} className="font-semibold text-foreground" />
                      <NumCell className="font-semibold text-foreground">{inr(data.totals.revenue)}</NumCell>
                      <NumCell className="hidden font-semibold text-foreground lg:table-cell">{inr(data.totals.margin)}</NumCell>
                      <NumCell className="hidden pr-5 font-semibold text-foreground xl:table-cell">{data.marginPct.toFixed(1)}%</NumCell>
                    </TableRow>
                  </TableFooter>
                ) : null}
              </Table>
            </div>
          </>
        ) : (
          <EmptyState
            icon={ReceiptTextIcon}
            title="No items match"
            description="Try another item name or code, or show all kinds of items."
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
