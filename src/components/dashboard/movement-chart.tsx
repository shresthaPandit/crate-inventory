"use client"

import { format } from "date-fns"
import { useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Segmented } from "@/components/kit/misc"
import { Panel } from "@/components/kit/panel"
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart"
import { dateShort, num } from "@/lib/format"
import { useInventory, useNow } from "@/lib/store"
import { cn } from "@/lib/utils"
import { DAY_MS, dayStart } from "./use-now"

type Range = "14" | "30" | "60"

const IN_LABEL = "Came in (purchases)"
const OUT_LABEL = "Went out (sales)"

const config = {
  inbound: { label: IN_LABEL, color: "var(--chart-1)" },
  outbound: { label: OUT_LABEL, color: "var(--chart-2)" },
} satisfies ChartConfig

interface Row {
  day: number
  label: string
  inbound: number
  outbound: number
}

const TICK = { fontSize: 13, fill: "var(--muted-foreground)" }

/**
 * Stock in and out per day, all godowns together. Green bars: units that
 * came in from suppliers. Blue bars: units that went out to customers.
 * Side by side, both growing up from zero, so taller simply means more.
 */
export function MovementChart({ className }: { className?: string }) {
  const [range, setRange] = useState<Range>("14")
  const movements = useInventory((s) => s.movements)
  const now = useNow(60_000)

  const { data, totalIn, totalOut } = useMemo(() => {
    const days = Number(range)
    const today = dayStart(now)
    const first = today - (days - 1) * DAY_MS
    const rows: Row[] = Array.from({ length: days }, (_, i) => {
      const day = first + i * DAY_MS
      return { day, label: dateShort(day), inbound: 0, outbound: 0 }
    })
    let totalIn = 0
    let totalOut = 0
    for (const m of movements) {
      if (m.type !== "purchase" && m.type !== "sale") continue
      const t = new Date(m.date).getTime()
      if (t < first) continue
      const row = rows[Math.floor((dayStart(t) - first) / DAY_MS)]
      if (!row) continue
      if (m.type === "purchase") {
        row.inbound += m.qty
        totalIn += m.qty
      } else {
        row.outbound += -m.qty // sales are stored as negative; show how many went out
        totalOut += -m.qty
      }
    }
    return { data: rows, totalIn, totalOut }
  }, [movements, range, now])

  const barSize = range === "14" ? 14 : range === "30" ? 8 : 4

  return (
    <Panel
      className={className}
      title={`Stock in and out — last ${range} days`}
      description="How many units came into your godowns and went out each day."
      action={
        <Segmented<Range>
          value={range}
          onValueChange={setRange}
          items={[
            { value: "14", label: "14 days" },
            { value: "30", label: "30 days" },
            { value: "60", label: "60 days" },
          ]}
        />
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <Legend swatch="bg-[var(--chart-1)]" label={IN_LABEL} value={`${num(totalIn)} units`} />
          <Legend swatch="bg-[var(--chart-2)]" label={OUT_LABEL} value={`${num(totalOut)} units`} />
        </div>
        <p className="sr-only">
          In the last {range} days, {num(totalIn)} units came in from suppliers and {num(totalOut)} units went out to customers.
        </p>
        <ChartContainer config={config} className="aspect-auto h-[260px] w-full sm:h-[300px]">
          <BarChart data={data} barGap={2} barCategoryGap="20%" margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              tick={TICK}
              tickMargin={10}
              minTickGap={24}
              interval="preserveStartEnd"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={TICK}
              width={48}
              allowDecimals={false}
              tickFormatter={(v: number) => num(v)}
            />
            <ChartTooltip
              cursor={{ fill: "var(--raised)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const row = payload[0]?.payload as Row | undefined
                return row ? <DayTooltip row={row} /> : null
              }}
            />
            <Bar
              dataKey="inbound"
              name={IN_LABEL}
              fill="var(--color-inbound)"
              radius={[4, 4, 0, 0]}
              maxBarSize={barSize}
              animationDuration={500}
              animationEasing="ease-out"
            />
            <Bar
              dataKey="outbound"
              name={OUT_LABEL}
              fill="var(--color-outbound)"
              radius={[4, 4, 0, 0]}
              maxBarSize={barSize}
              animationDuration={500}
              animationEasing="ease-out"
            />
          </BarChart>
        </ChartContainer>
        <p className="text-[13px] text-muted-foreground">Touch or point at a day to see its numbers.</p>
      </div>
    </Panel>
  )
}

function Legend({ swatch, label, value }: { swatch: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span aria-hidden className={cn("size-3 shrink-0 rounded-[3px]", swatch)} />
      <span className="text-[15px] text-fg-secondary">{label}</span>
      <span className="text-[15px] font-semibold text-foreground tabular">{value}</span>
    </div>
  )
}

function DayTooltip({ row }: { row: Row }) {
  return (
    <div className="min-w-48 rounded-lg border border-border bg-popover px-3.5 py-3 text-sm shadow-float">
      <p className="mb-2 font-semibold text-foreground">{format(row.day, "EEEE, d MMM")}</p>
      <div className="flex flex-col gap-1.5">
        <TipRow swatch="bg-[var(--chart-1)]" label="Came in" value={`${num(row.inbound)} units`} />
        <TipRow swatch="bg-[var(--chart-2)]" label="Went out" value={`${num(row.outbound)} units`} />
      </div>
    </div>
  )
}

function TipRow({ swatch, label, value }: { swatch: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span aria-hidden className={cn("size-2.5 shrink-0 rounded-[2px]", swatch)} />
      <span className="flex-1 text-fg-secondary">{label}:</span>
      <span className="font-medium text-foreground tabular">{value}</span>
    </div>
  )
}
