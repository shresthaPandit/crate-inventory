"use client"

import { BinLabel } from "@/components/kit/misc"
import { TableCell } from "@/components/ui/table"
import { num, pct } from "@/lib/format"
import type { Item } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Shared chart styling: mono 11px ticks, quiet grid. */
export const AXIS_TICK = { fontSize: 11, fontFamily: "var(--font-geist-mono)", fill: "var(--muted-foreground)" }
export const CHART_CLASS =
  "aspect-auto h-[280px] w-full sm:h-[300px] [&_.recharts-cartesian-grid_line]:stroke-border [&_.recharts-cartesian-axis-tick_text]:font-mono"

/** Tooltip body used by every report chart. */
export function ChartTip({ title, rows }: { title: string; rows: { label: string; value: string; accent?: boolean }[] }) {
  return (
    <div className="min-w-40 rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-float">
      <p className="mb-1.5 text-fg-secondary">{title}</p>
      <div className="flex flex-col gap-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              {r.accent !== undefined ? (
                <span className={cn("size-1.5 rounded-full", r.accent ? "bg-signal" : "bg-fg-secondary")} />
              ) : null}
              {r.label}
            </span>
            <span className="font-mono text-foreground tabular">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** A ranked list row with a thin bar underneath. */
export function RankRow({
  label,
  meta,
  value,
  share,
  barClassName,
  onClick,
}: {
  label: React.ReactNode
  meta?: React.ReactNode
  value: React.ReactNode
  /** 0..1 width of the bar */
  share: number
  barClassName?: string
  onClick?: () => void
}) {
  const Comp = onClick ? "button" : "div"
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex w-full flex-col gap-2 rounded-lg px-2 py-2 text-left",
        onClick && "transition-colors hover:bg-raised/60 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm text-foreground">{label}</span>
          {meta ? <span className="truncate text-xs text-muted-foreground">{meta}</span> : null}
        </div>
        <span className="shrink-0 font-mono text-[13px] text-fg-secondary tabular">{value}</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-foreground/[0.06]">
        <div
          className={cn("h-full rounded-full bg-fg-secondary/70 transition-transform duration-500 ease-out-quint", barClassName)}
          style={{ width: "100%", transform: `scaleX(${Math.max(0, Math.min(1, share))})`, transformOrigin: "left" }}
        />
      </div>
    </Comp>
  )
}

/** Item name with its bin label and SKU. */
export function ItemCellBody({ item }: { item: Item }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <BinLabel category={item.category} />
      <div className="flex min-w-0 flex-col">
        <span className="max-w-[180px] truncate text-sm text-foreground sm:max-w-[260px]">{item.name}</span>
        <span className="font-mono text-[11px] text-muted-foreground">{item.sku}</span>
      </div>
    </div>
  )
}

/** Right-aligned mono figure; zero renders as a quiet dash. */
export function NumCell({
  children,
  value,
  className,
  dashZero,
}: {
  children?: React.ReactNode
  value?: number
  className?: string
  dashZero?: boolean
}) {
  const zero = dashZero && value === 0
  return (
    <TableCell className={cn("text-right font-mono text-[13px] tabular", zero ? "text-muted-foreground/60" : "text-fg-secondary", className)}>
      {zero ? "—" : (children ?? (value !== undefined ? num(value) : null))}
    </TableCell>
  )
}

/** Delta text for a stat card. Tone is only applied when direction has a meaning. */
export function deltaPct(
  cur: number,
  prev: number,
  label: string,
  meaning: "higher-good" | "neutral" = "higher-good",
): { text: string; tone: "positive" | "negative" | "neutral" } | undefined {
  if (!prev) return undefined
  const d = ((cur - prev) / prev) * 100
  const rounded = Math.round(d)
  if (rounded === 0) return { text: `No change ${label}`, tone: "neutral" }
  return {
    text: `${pct(d)} ${label}`,
    tone: meaning === "neutral" ? "neutral" : d > 0 ? "positive" : "negative",
  }
}

/** Row props that make a table row open something, by mouse or keyboard. */
export function rowLink(open: () => void) {
  return {
    tabIndex: 0,
    role: "button" as const,
    onClick: open,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        open()
      }
    },
    className: "cursor-pointer outline-none focus-visible:bg-raised",
  }
}
