"use client"

import { useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts"
import { TruckIcon } from "lucide-react"
import { EmptyState, Mono, SearchInput } from "@/components/kit/misc"
import { Panel } from "@/components/kit/panel"
import { StatCard } from "@/components/kit/stat-card"
import { StatusBadge } from "@/components/kit/status-badge"
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { dateShort, inr, inrCompact, num, plural } from "@/lib/format"
import { useUI } from "@/lib/store"
import { cn } from "@/lib/utils"
import type { Range } from "./range"
import { AXIS_TICK, ChartTip, NumCell, RankRow, deltaPct, rowLink } from "./parts"
import type { PurchaseReport as PurchaseData } from "./use-reports"

const config = {
  spend: { label: "Spend", color: "var(--chart-2)" },
  top: { label: "Largest", color: "var(--chart-1)" },
} satisfies ChartConfig

/** "Kiran Cables Pvt Ltd" → "Kiran Cables" for the chart axis. */
const shortName = (n: string) => n.replace(/\s+(Pvt Ltd|Ltd|Co\.|Works|LLP)$/i, "")

export function PurchaseReport({ data, range }: { data: PurchaseData; range: Range }) {
  const openPanel = useUI((s) => s.openPanel)
  const [q, setQ] = useState("")

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return data.rows
    return data.rows.filter(
      (r) => r.po.number.toLowerCase().includes(needle) || (r.supplier?.name.toLowerCase().includes(needle) ?? false),
    )
  }, [data.rows, q])

  const chartData = data.suppliers
    .filter((s) => s.spend > 0)
    .map((s) => ({ id: s.supplier.id, name: shortName(s.supplier.name), full: s.supplier.name, spend: s.spend, received: s.received }))

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Spend"
          value={data.spend}
          kind="inr"
          emphasis
          delta={deltaPct(data.spend, data.prevSpend, range.compareLabel, "neutral")}
          footnote="before GST"
        />
        <StatCard
          label="POs received"
          value={data.receivedCount}
          delta={deltaPct(data.receivedCount, data.prevReceivedCount, range.compareLabel, "neutral")}
        />
        <StatCard
          label="On-time rate"
          value={data.onTimeRate ?? 0}
          kind="percent"
          delta={
            data.onTimeRate === null
              ? { text: "No deliveries in this period", tone: "neutral" }
              : { text: data.lateCount ? `${plural(data.lateCount, "delivery", "deliveries")} late` : "Every delivery on time", tone: data.lateCount ? "negative" : "positive" }
          }
        />
        <StatCard
          label="Pending value"
          value={data.pendingValue}
          kind="inr"
          delta={
            data.overdueCount
              ? { text: `${num(data.overdueCount)} overdue`, tone: "negative" }
              : undefined
          }
          footnote={`${plural(data.pendingCount, "open PO")}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel title="Spend by supplier" description="Received goods at cost, before GST" className="xl:col-span-2">
          {chartData.length ? (
            <ChartContainer
              config={config}
              className="aspect-auto w-full [&_.recharts-cartesian-grid_line]:stroke-border"
              style={{ height: Math.max(200, chartData.length * 48 + 24) }}
            >
              <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 64, bottom: 0, left: 0 }} barCategoryGap={12}>
                <CartesianGrid horizontal={false} stroke="var(--border)" />
                <XAxis type="number" hide domain={[0, "dataMax"]} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  width={128}
                  tick={{ fontSize: 12, fill: "var(--fg-secondary)" }}
                />
                <ChartTooltip
                  cursor={{ fill: "var(--foreground)", fillOpacity: 0.04 }}
                  content={(p) => {
                    const d = p.payload?.[0]?.payload as (typeof chartData)[number] | undefined
                    if (!p.active || !d) return null
                    return (
                      <ChartTip
                        title={d.full}
                        rows={[
                          { label: "Spend", value: inr(d.spend), accent: d.id === chartData[0]?.id },
                          { label: "Receipts", value: num(d.received) },
                        ]}
                      />
                    )
                  }}
                />
                <Bar dataKey="spend" radius={[0, 3, 3, 0]} maxBarSize={22} animationDuration={600}>
                  {chartData.map((d, i) => (
                    <Cell key={d.id} fill={i === 0 ? "var(--color-top)" : "var(--color-spend)"} />
                  ))}
                  <LabelList
                    dataKey="spend"
                    position="right"
                    offset={8}
                    formatter={(v) => inrCompact(Number(v))}
                    style={{ ...AXIS_TICK, fill: "var(--fg-secondary)" }}
                  />
                </Bar>
              </BarChart>
            </ChartContainer>
          ) : (
            <EmptyState icon={TruckIcon} title="Nothing received in this period" description="Spend counts when goods arrive. Pick a longer range" />
          )}
        </Panel>

        <Panel title="Delivery performance" description="Received in this period, against the promised date">
          <div className="-mx-2 flex flex-col gap-1">
            {data.suppliers.map((s) => {
              const rate = s.received ? s.onTime / s.received : 0
              return (
                <RankRow
                  key={s.supplier.id}
                  label={s.supplier.name}
                  meta={
                    s.received
                      ? s.avgLate > 0
                        ? `${s.avgLate.toFixed(1)} days late on average · lead time ${s.supplier.leadTimeDays} days`
                        : `On time · lead time ${s.supplier.leadTimeDays} days`
                      : `No deliveries · ${plural(s.open, "open PO")}`
                  }
                  value={s.received ? `${Math.round(rate * 100)}%` : "—"}
                  share={rate}
                  barClassName={cn(s.received && rate < 0.75 && "bg-warning")}
                />
              )
            })}
          </div>
        </Panel>
      </div>

      <Panel
        flush
        title="Purchase orders"
        description="Raised or received in this period, plus everything still open"
        action={<SearchInput value={q} onChange={setQ} placeholder="Search POs" className="hidden sm:flex sm:w-56" />}
      >
        <div className="px-4 pb-3 sm:hidden">
          <SearchInput value={q} onChange={setQ} placeholder="Search POs" className="w-full sm:w-full" />
        </div>
        {rows.length ? (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">PO</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="hidden md:table-cell">Ordered</TableHead>
                <TableHead className="hidden sm:table-cell">Expected</TableHead>
                <TableHead>Received</TableHead>
                <TableHead className="hidden text-right lg:table-cell">Units</TableHead>
                <TableHead className="pr-5 text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.po.id} {...rowLink(() => openPanel({ type: "purchase", id: r.po.id }))}>
                  <TableCell className="pl-5">
                    <Mono className="text-[13px] text-foreground">{r.po.number}</Mono>
                  </TableCell>
                  <TableCell className="max-w-[140px] truncate text-fg-secondary sm:max-w-[220px]">{r.supplier?.name ?? "Unknown supplier"}</TableCell>
                  <TableCell className="hidden font-mono text-[13px] text-fg-secondary tabular md:table-cell">{dateShort(r.po.date)}</TableCell>
                  <TableCell className="hidden font-mono text-[13px] text-fg-secondary tabular sm:table-cell">{dateShort(r.po.expectedDate)}</TableCell>
                  <TableCell>
                    {r.state === "received" && r.po.receivedAt ? (
                      <span className="font-mono text-[13px] text-fg-secondary tabular">
                        {dateShort(r.po.receivedAt)}
                        {r.daysLate > 0 ? <span className="ml-1.5 text-warning">+{r.daysLate}d</span> : null}
                      </span>
                    ) : (
                      <StatusBadge status={r.state === "late" ? "late" : r.state === "cancelled" ? "cancelled" : "ordered"} />
                    )}
                  </TableCell>
                  <NumCell value={r.units} className="hidden lg:table-cell" />
                  <NumCell className={cn("pr-5", r.state === "cancelled" ? "text-muted-foreground line-through" : "text-foreground")}>
                    {inr(r.amount)}
                  </NumCell>
                </TableRow>
              ))}
            </TableBody>
            {!q ? (
              <TableFooter className="bg-transparent">
                <TableRow className="hover:bg-transparent">
                  <TableCell className="pl-5 text-sm text-fg-secondary" colSpan={2}>
                    {plural(rows.length, "order")}
                  </TableCell>
                  <TableCell className="hidden md:table-cell" />
                  <TableCell className="hidden sm:table-cell" />
                  <TableCell />
                  <NumCell value={data.totals.units} className="hidden lg:table-cell" />
                  <NumCell className="pr-5 text-foreground">{inr(data.totals.amount)}</NumCell>
                </TableRow>
              </TableFooter>
            ) : null}
          </Table>
        ) : (
          <EmptyState icon={TruckIcon} title="No purchase orders match" description="Search by PO number or supplier name" />
        )}
      </Panel>
    </div>
  )
}
