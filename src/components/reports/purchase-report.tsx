"use client"

import { useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"
import { ClockIcon, PackageCheckIcon, TruckIcon, WalletIcon } from "lucide-react"
import { HelpTip } from "@/components/kit/help"
import { EmptyState, SearchInput, Segmented } from "@/components/kit/misc"
import { Panel } from "@/components/kit/panel"
import { StatCard } from "@/components/kit/stat-card"
import { StatusBadge, type BadgeStatus } from "@/components/kit/status-badge"
import { Button } from "@/components/ui/button"
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { dateShort, inr, inrCompact, num, plural } from "@/lib/format"
import { useUI } from "@/lib/store"
import { cn } from "@/lib/utils"
import type { Range } from "./range"
import { AXIS_TICK, ChartTip, IN_COLOR, MobileRow, NumCell, RankRow, ResultsLine, deltaCount, deltaPct, rowLink } from "./parts"
import type { PurchaseReport as PurchaseData, PurchaseRow, PurchaseRowState } from "./use-reports"

const config = {
  spend: { label: "Spent", color: IN_COLOR },
} satisfies ChartConfig

/** "Kiran Cables Pvt Ltd" → "Kiran Cables" for the chart axis. */
const shortName = (n: string) => n.replace(/\s+(Pvt Ltd|Ltd|Co\.|Works|LLP)$/i, "")

const ON_TIME_HELP = "Goods that arrived on or before the date the supplier promised."

const STATE_BADGE: Record<PurchaseRowState, BadgeStatus> = {
  received: "received",
  ordered: "ordered",
  late: "late",
  cancelled: "cancelled",
}

type Filter = "all" | PurchaseRowState

export function PurchaseReport({ data, range }: { data: PurchaseData; range: Range }) {
  const openPanel = useUI((s) => s.openPanel)
  const [q, setQ] = useState("")
  const [filter, setFilter] = useState<Filter>("all")

  const searched = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return data.rows
    return data.rows.filter(
      (r) => r.po.number.toLowerCase().includes(needle) || (r.supplier?.name.toLowerCase().includes(needle) ?? false),
    )
  }, [data.rows, q])

  const rows = useMemo(() => (filter === "all" ? searched : searched.filter((r) => r.state === filter)), [searched, filter])

  const count = (s: PurchaseRowState) => searched.filter((r) => r.state === s).length
  const hasCancelled = data.rows.some((r) => r.state === "cancelled")
  const isFiltered = q.trim() !== "" || filter !== "all"
  const clear = () => {
    setQ("")
    setFilter("all")
  }

  const chartData = data.suppliers
    .filter((s) => s.spend > 0)
    .map((s) => ({ id: s.supplier.id, name: shortName(s.supplier.name), full: s.supplier.name, spend: s.spend, received: s.received }))

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Spent on stock"
          value={data.spend}
          kind="inr"
          icon={WalletIcon}
          tone="positive"
          delta={deltaPct(data.spend, data.prevSpend, range.compareLabel, "neutral")}
          footnote="Before GST, for goods that arrived"
        />
        <StatCard
          label="Deliveries received"
          value={data.receivedCount}
          icon={PackageCheckIcon}
          tone="positive"
          delta={deltaCount(data.receivedCount, data.prevReceivedCount, range.compareLabel, "neutral")}
        />
        <StatCard
          label="Arrived on time"
          value={data.onTimeRate ?? 0}
          kind="percent"
          icon={ClockIcon}
          tone={data.lateCount ? "warning" : "info"}
          delta={
            data.onTimeRate === null
              ? { text: "Nothing arrived in this period", tone: "neutral" }
              : {
                  text: data.lateCount ? `${plural(data.lateCount, "delivery", "deliveries")} came late` : "Every delivery on time",
                  tone: data.lateCount ? "negative" : "positive",
                }
          }
          footnote={<HelpTip label="What does on time mean?">{ON_TIME_HELP}</HelpTip>}
        />
        <StatCard
          label="Still on the way"
          value={data.pendingValue}
          kind="inr"
          icon={TruckIcon}
          tone={data.overdueCount ? "negative" : "info"}
          delta={data.overdueCount ? { text: `${plural(data.overdueCount, "order")} late`, tone: "negative" } : undefined}
          footnote={`${plural(data.pendingCount, "order")} not arrived yet`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel
          title="Spent per supplier"
          description="What you paid each supplier for goods that arrived in this time period, before GST. Longer bar, more money."
          className="xl:col-span-2"
        >
          {chartData.length ? (
            <ChartContainer
              config={config}
              className="aspect-auto w-full [&_.recharts-cartesian-grid_line]:stroke-border"
              style={{ height: Math.max(200, chartData.length * 52 + 24) }}
            >
              <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 72, bottom: 0, left: 0 }} barCategoryGap={12}>
                <CartesianGrid horizontal={false} stroke="var(--border)" />
                <XAxis type="number" hide domain={[0, "dataMax"]} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  width={132}
                  tick={{ fontSize: 13, fill: "var(--fg-secondary)" }}
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
                          { label: "Spent", value: inr(d.spend), color: IN_COLOR },
                          { label: "Deliveries", value: num(d.received) },
                        ]}
                      />
                    )
                  }}
                />
                <Bar dataKey="spend" fill="var(--color-spend)" radius={[0, 4, 4, 0]} maxBarSize={24} animationDuration={600}>
                  <LabelList
                    dataKey="spend"
                    position="right"
                    offset={8}
                    formatter={(v) => inrCompact(Number(v))}
                    style={{ ...AXIS_TICK, fill: "var(--fg-secondary)", fontWeight: 500 }}
                  />
                </Bar>
              </BarChart>
            </ChartContainer>
          ) : (
            <EmptyState
              icon={TruckIcon}
              title="Nothing arrived in this time period"
              description="Money spent counts on the day the goods arrive. Pick a longer time period."
            />
          )}
        </Panel>

        <Panel
          title={
            <span className="inline-flex items-center gap-1">
              Delivered on time
              <HelpTip label="What does on time mean?">{ON_TIME_HELP}</HelpTip>
            </span>
          }
          description="For each supplier, goods that arrived in this time period."
        >
          <div className="flex flex-col divide-y divide-border">
            {data.suppliers.map((s) => {
              const rate = s.received ? s.onTime / s.received : 0
              return (
                <RankRow
                  key={s.supplier.id}
                  label={s.supplier.name}
                  meta={
                    s.received
                      ? s.avgLate > 0
                        ? `${num(s.onTime)} of ${num(s.received)} on time · ${s.avgLate.toFixed(1)} days late on average`
                        : `${num(s.onTime)} of ${num(s.received)} on time · usually ${plural(s.supplier.leadTimeDays, "day")}`
                      : s.open
                        ? `Nothing arrived · ${plural(s.open, "order")} on the way`
                        : "Nothing arrived"
                  }
                  value={s.received ? `${Math.round(rate * 100)}%` : "—"}
                  share={rate}
                  barColor={IN_COLOR}
                  warn={s.received > 0 && rate < 0.75}
                />
              )
            })}
          </div>
        </Panel>
      </div>

      <Panel
        flush
        title="Orders to suppliers"
        description="Orders placed or received in this time period, plus every order still on the way. Tap an order to open it."
      >
        <div className="flex flex-col gap-3 px-5 pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <SearchInput value={q} onChange={setQ} placeholder="Search by order number or supplier…" />
            <Segmented<Filter>
              value={filter}
              onValueChange={setFilter}
              items={[
                { value: "all", label: "All", count: searched.length },
                { value: "ordered", label: "On the way", count: count("ordered") },
                { value: "late", label: "Late", count: count("late") },
                { value: "received", label: "Received", count: count("received") },
                ...(hasCancelled ? [{ value: "cancelled" as const, label: "Cancelled", count: count("cancelled") }] : []),
              ]}
            />
          </div>
          <ResultsLine shown={rows.length} total={data.rows.length} noun="orders" filtered={isFiltered} onClear={clear} />
        </div>

        {rows.length ? (
          <>
            {/* Phones: one card per order */}
            <ul className="divide-y divide-border border-t border-border md:hidden">
              {rows.map((r) => (
                <MobileRow
                  key={r.po.id}
                  onClick={() => openPanel({ type: "purchase", id: r.po.id })}
                  title={r.supplier?.name ?? "Unknown supplier"}
                  subtitle={`Order ${r.po.number} · ordered ${dateShort(r.po.date)}`}
                  badge={<StatusBadge status={STATE_BADGE[r.state]} />}
                  figures={[
                    { label: r.state === "received" ? "Arrived" : "Due", value: dueOrArrived(r) },
                    { label: "Quantity", value: num(r.units) },
                    {
                      label: "Amount",
                      value: inr(r.amount),
                      className: r.state === "cancelled" ? "text-muted-foreground line-through" : undefined,
                    },
                  ]}
                />
              ))}
            </ul>

            {/* Tablets and computers */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5">Order</TableHead>
                    <TableHead className="hidden xl:table-cell">Ordered on</TableHead>
                    <TableHead>Due or arrived</TableHead>
                    <TableHead className="hidden text-right xl:table-cell">Quantity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-5 text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.po.id} {...rowLink(() => openPanel({ type: "purchase", id: r.po.id }))}>
                      <TableCell className="max-w-[260px] pl-5">
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate font-medium text-foreground">{r.supplier?.name ?? "Unknown supplier"}</span>
                          <span className="text-[13px] text-muted-foreground tabular">Order {r.po.number}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-fg-secondary tabular xl:table-cell">{dateShort(r.po.date)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-fg-secondary tabular">
                            {r.state === "received" ? "Arrived " : r.state === "cancelled" ? "Was due " : "Due "}
                            {dueOrArrived(r)}
                          </span>
                          {r.state === "received" && r.daysLate > 0 ? (
                            <span className="text-[13px] text-warning">{plural(r.daysLate, "day")} late</span>
                          ) : null}
                        </div>
                      </TableCell>
                      <NumCell value={r.units} className="hidden xl:table-cell" />
                      <TableCell>
                        <StatusBadge status={STATE_BADGE[r.state]} />
                      </TableCell>
                      <NumCell
                        className={cn(
                          "pr-5",
                          r.state === "cancelled" ? "text-muted-foreground line-through" : "font-medium text-foreground",
                        )}
                      >
                        {inr(r.amount)}
                      </NumCell>
                    </TableRow>
                  ))}
                </TableBody>
                {!isFiltered ? (
                  <TableFooter className="bg-raised/50">
                    <TableRow className="hover:bg-transparent">
                      <TableCell className="pl-5 font-semibold text-foreground">
                        Total, {plural(rows.length, "order")}
                        {hasCancelled ? <span className="block text-[13px] font-normal text-muted-foreground">Cancelled orders not counted</span> : null}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell" />
                      <TableCell />
                      <NumCell value={data.totals.units} className="hidden font-semibold text-foreground xl:table-cell" />
                      <TableCell />
                      <NumCell className="pr-5 font-semibold text-foreground">{inr(data.totals.amount)}</NumCell>
                    </TableRow>
                  </TableFooter>
                ) : null}
              </Table>
            </div>
          </>
        ) : (
          <EmptyState
            icon={TruckIcon}
            title={data.rows.length ? "No orders match" : "No supplier orders in this time period"}
            description={
              data.rows.length ? "Try another order number or supplier name, or show all orders." : "Pick a longer time period to see older orders."
            }
            action={
              data.rows.length ? (
                <Button variant="outline" onClick={clear}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        )}
      </Panel>
    </div>
  )
}

function dueOrArrived(r: PurchaseRow) {
  if (r.state === "received" && r.po.receivedAt) return dateShort(r.po.receivedAt)
  return dateShort(r.po.expectedDate)
}
