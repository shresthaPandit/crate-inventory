"use client"

import { useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts"
import { Segmented } from "@/components/kit/misc"
import { Panel } from "@/components/kit/panel"
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart"
import { date, dateShort, num, signed } from "@/lib/format"
import { useInventory } from "@/lib/store"
import { cn } from "@/lib/utils"
import { DAY_MS, dayStart, useNow } from "./use-now"

type Range = "14" | "30" | "60"

const config = {
  inbound: { label: "In", color: "var(--chart-1)" },
  outbound: { label: "Out", color: "var(--chart-2)" },
} satisfies ChartConfig

interface Row {
  day: number
  label: string
  inbound: number
  outbound: number
}

const TICK = {
  fontSize: 11,
  fontFamily: "var(--font-geist-mono)",
  fill: "var(--muted-foreground)",
}

/**
 * The dashboard's one rich moment: a mirrored ledger of the floor.
 * Units received from suppliers rise above the line in hi-vis,
 * units shipped to customers hang below it in grey.
 */
export function MovementChart({ className }: { className?: string }) {
  const [range, setRange] = useState<Range>("30")
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
      const idx = Math.floor((dayStart(t) - first) / DAY_MS)
      const row = rows[idx]
      if (!row) continue
      if (m.type === "purchase") {
        row.inbound += m.qty
        totalIn += m.qty
      } else {
        row.outbound += m.qty // already negative
        totalOut += -m.qty
      }
    }
    return { data: rows, totalIn, totalOut }
  }, [movements, range, now])

  return (
    <Panel
      className={className}
      title="Stock movement"
      description="Units received and shipped per day, all godowns"
      action={
        <Segmented<Range>
          value={range}
          onValueChange={setRange}
          items={[
            { value: "14", label: "14d" },
            { value: "30", label: "30d" },
            { value: "60", label: "60d" },
          ]}
        />
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <Figure swatch="bg-[var(--chart-1)]" value={`+${num(totalIn)}`} label="in from suppliers" />
          <Figure swatch="bg-[var(--chart-2)]" value={`−${num(totalOut)}`} label="out to customers" />
          <span className="ml-auto font-mono text-xs text-muted-foreground tabular">
            net {signed(totalIn - totalOut)}
          </span>
        </div>
        <ChartContainer config={config} className="aspect-auto h-[280px] w-full sm:h-[300px]">
          <BarChart data={data} stackOffset="sign" barCategoryGap="18%" margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={TICK}
              tickMargin={10}
              minTickGap={28}
              interval="preserveStartEnd"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={TICK}
              width={44}
              tickFormatter={(v: number) => num(Math.abs(v))}
            />
            <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.45} />
            <ChartTooltip
              cursor={{ fill: "var(--raised)", opacity: 0.6 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const row = payload[0]?.payload as Row | undefined
                if (!row) return null
                return <MovementTooltip row={row} />
              }}
            />
            <Bar
              dataKey="inbound"
              stackId="m"
              fill="var(--color-inbound)"
              radius={2}
              maxBarSize={10}
              animationDuration={600}
              animationEasing="ease-out"
            />
            <Bar
              dataKey="outbound"
              stackId="m"
              fill="var(--color-outbound)"
              radius={2}
              maxBarSize={10}
              animationDuration={600}
              animationEasing="ease-out"
            />
          </BarChart>
        </ChartContainer>
      </div>
    </Panel>
  )
}

function Figure({ swatch, value, label }: { swatch: string; value: string; label: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span aria-hidden className={cn("inline-block size-2 translate-y-[-1px] rounded-[2px]", swatch)} />
      <span className="font-mono text-lg leading-none text-foreground tabular">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

function MovementTooltip({ row }: { row: Row }) {
  const out = -row.outbound
  return (
    <div className="min-w-40 rounded-lg border border-border bg-popover px-3 py-2.5 text-xs shadow-float">
      <p className="mb-2 text-fg-secondary">{date(row.day)}</p>
      <div className="flex flex-col gap-1.5">
        <TipRow swatch="bg-[var(--chart-1)]" label="In" value={`+${num(row.inbound)}`} />
        <TipRow swatch="bg-[var(--chart-2)]" label="Out" value={`−${num(out)}`} />
        <div className="mt-0.5 border-t border-border pt-1.5">
          <TipRow label="Net" value={signed(row.inbound - out)} />
        </div>
      </div>
    </div>
  )
}

function TipRow({ swatch, label, value }: { swatch?: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      {swatch ? <span aria-hidden className={cn("size-2 rounded-[2px]", swatch)} /> : <span className="size-2" />}
      <span className="flex-1 text-muted-foreground">{label}</span>
      <span className="font-mono text-foreground tabular">{value}</span>
    </div>
  )
}
