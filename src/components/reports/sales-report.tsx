"use client"

import { useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts"
import { ReceiptTextIcon } from "lucide-react"
import { EmptyState, SearchInput } from "@/components/kit/misc"
import { Panel } from "@/components/kit/panel"
import { StatCard } from "@/components/kit/stat-card"
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { inr, inrCompact, num, plural, signed } from "@/lib/format"
import { useUI } from "@/lib/store"
import type { Range } from "./range"
import { AXIS_TICK, CHART_CLASS, ChartTip, ItemCellBody, NumCell, RankRow, deltaPct, rowLink } from "./parts"
import type { SalesReport as SalesData } from "./use-reports"

const config = {
  revenue: { label: "Revenue", color: "var(--chart-2)" },
  current: { label: "Current", color: "var(--chart-1)" },
} satisfies ChartConfig

export function SalesReport({ data, range }: { data: SalesData; range: Range }) {
  const openPanel = useUI((s) => s.openPanel)
  const [q, setQ] = useState("")

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return data.byItem
    return data.byItem.filter((r) => r.item.name.toLowerCase().includes(needle) || r.item.sku.toLowerCase().includes(needle))
  }, [data.byItem, q])

  const topMax = data.topCustomers[0]?.revenue ?? 1
  const lastIdx = data.series.length - 1
  const orderDiff = data.orders - data.prevOrders

  if (!data.orders) {
    return (
      <Panel>
        <EmptyState
          icon={ReceiptTextIcon}
          title="Nothing shipped in this period"
          description="Revenue counts when an order ships. Pick a longer range or ship an open order from Sales"
        />
      </Panel>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue incl. GST"
          value={data.revenue}
          kind="inr"
          emphasis
          delta={deltaPct(data.revenue, data.prevRevenue, range.compareLabel)}
        />
        <StatCard
          label="Orders shipped"
          value={data.orders}
          delta={
            data.prevOrders
              ? {
                  text: `${orderDiff === 0 ? "Same" : signed(orderDiff)} ${range.compareLabel}`,
                  tone: orderDiff > 0 ? "positive" : orderDiff < 0 ? "negative" : "neutral",
                }
              : undefined
          }
        />
        <StatCard
          label="Average order"
          value={data.avgOrder}
          kind="inr"
          delta={deltaPct(data.avgOrder, data.prevAvgOrder, range.compareLabel)}
        />
        <StatCard
          label="Gross margin"
          value={data.margin}
          kind="inr"
          footnote={`${data.marginPct.toFixed(1)}% of sales before GST`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel
          title="Revenue"
          description={range.bucket === "day" ? "Per day, incl. GST, by ship date" : "Per week, incl. GST, by ship date"}
          className="xl:col-span-2"
          action={
            <span className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-signal" />
                {range.bucket === "day" ? "Today" : "This week"}
              </span>
              <span className="hidden items-center gap-1.5 sm:flex">
                <span className="size-1.5 rounded-full bg-fg-secondary" />
                Earlier
              </span>
            </span>
          }
        >
          <ChartContainer config={config} className={CHART_CLASS}>
            <BarChart data={data.series} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} minTickGap={24} tickMargin={8} />
              <YAxis tickFormatter={(v: number) => inrCompact(v)} tickLine={false} axisLine={false} tick={AXIS_TICK} width={56} />
              <ChartTooltip
                cursor={{ fill: "var(--foreground)", fillOpacity: 0.04 }}
                content={(p) => {
                  const d = p.payload?.[0]?.payload as SalesData["series"][number] | undefined
                  if (!p.active || !d) return null
                  return (
                    <ChartTip
                      title={d.tooltip}
                      rows={[
                        { label: "Revenue", value: inr(d.revenue), accent: d.t === data.series[lastIdx]?.t },
                        { label: "Orders", value: num(d.orders) },
                      ]}
                    />
                  )
                }}
              />
              <Bar dataKey="revenue" radius={[3, 3, 0, 0]} maxBarSize={range.bucket === "day" ? 22 : 48} animationDuration={600}>
                {data.series.map((d, i) => (
                  <Cell key={d.t} fill={i === lastIdx ? "var(--color-current)" : "var(--color-revenue)"} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </Panel>

        <Panel title="Top customers" description="By revenue incl. GST">
          <div className="-mx-2 flex flex-col gap-1">
            {data.topCustomers.map((c) => (
              <RankRow
                key={c.customer.id}
                label={c.customer.name}
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
        title="By item"
        description="Revenue before GST, margin against purchase cost"
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
                <TableHead className="hidden text-right sm:table-cell">Units sold</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="hidden text-right md:table-cell">Margin</TableHead>
                <TableHead className="hidden pr-5 text-right lg:table-cell">Margin %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.item.id} {...rowLink(() => openPanel({ type: "item", id: r.item.id }))}>
                  <TableCell className="pl-5">
                    <ItemCellBody item={r.item} />
                  </TableCell>
                  <NumCell className="hidden sm:table-cell">
                    {num(r.units)}
                    <span className="ml-1 text-[11px] text-muted-foreground">{r.item.unit}</span>
                  </NumCell>
                  <NumCell className="text-foreground">{inr(r.revenue)}</NumCell>
                  <NumCell className="hidden md:table-cell">{inr(r.margin)}</NumCell>
                  <NumCell className="hidden pr-5 lg:table-cell">{r.revenue ? `${((r.margin / r.revenue) * 100).toFixed(1)}%` : "—"}</NumCell>
                </TableRow>
              ))}
            </TableBody>
            {!q ? (
              <TableFooter className="bg-transparent">
                <TableRow className="hover:bg-transparent">
                  <TableCell className="pl-5 text-sm text-fg-secondary">{plural(rows.length, "item")}</TableCell>
                  <NumCell value={data.totals.units} className="hidden sm:table-cell" />
                  <NumCell className="text-foreground">{inr(data.totals.revenue)}</NumCell>
                  <NumCell className="hidden text-foreground md:table-cell">{inr(data.totals.margin)}</NumCell>
                  <NumCell className="hidden pr-5 lg:table-cell">{data.marginPct.toFixed(1)}%</NumCell>
                </TableRow>
              </TableFooter>
            ) : null}
          </Table>
        ) : (
          <EmptyState icon={ReceiptTextIcon} title="No items match" description="Try a SKU or part of the item name" />
        )}
      </Panel>
    </div>
  )
}
