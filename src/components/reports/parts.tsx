"use client"

import { XIcon } from "lucide-react"
import { HelpTip } from "@/components/kit/help"
import { ItemIcon } from "@/components/kit/misc"
import { TONE_PILL, type Tone } from "@/components/kit/status-badge"
import { Button } from "@/components/ui/button"
import { TableCell } from "@/components/ui/table"
import { num } from "@/lib/format"
import type { Item, Unit } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Shared chart styling: readable 13px labels, quiet grid. */
export const AXIS_TICK = { fontSize: 13, fill: "var(--muted-foreground)" }
export const CHART_CLASS = "aspect-auto h-[260px] w-full sm:h-[300px] [&_.recharts-cartesian-grid_line]:stroke-border"

/** Chart colours with a fixed meaning: green = came in / bought, blue = went out / sold. */
export const IN_COLOR = "var(--chart-1)"
export const OUT_COLOR = "var(--chart-2)"

/** Tooltip body used by every report chart. */
export function ChartTip({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="min-w-44 rounded-lg border border-border bg-popover px-3 py-2.5 text-sm shadow-float">
      <p className="mb-1.5 font-medium text-foreground">{title}</p>
      <div className="flex flex-col gap-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-fg-secondary">
              {r.color ? <span className="size-2.5 rounded-sm" style={{ background: r.color }} /> : null}
              {r.label}
            </span>
            <span className="font-medium text-foreground tabular">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** A ranked list row: name, one muted line, the figure, and a bar showing its share. */
export function RankRow({
  label,
  meta,
  value,
  share,
  barColor = OUT_COLOR,
  warn,
}: {
  label: React.ReactNode
  meta?: React.ReactNode
  value: React.ReactNode
  /** 0..1 width of the bar */
  share: number
  barColor?: string
  /** paint the bar amber */
  warn?: boolean
}) {
  return (
    <div className="flex w-full flex-col gap-2 py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[15px] text-foreground">{label}</span>
          {meta ? <span className="text-[13px] text-muted-foreground">{meta}</span> : null}
        </div>
        <span className="shrink-0 text-[15px] font-medium text-foreground tabular">{value}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-raised">
        <div
          className={cn("h-full rounded-full transition-transform duration-500 ease-out-quint", warn && "bg-warning")}
          style={{
            width: "100%",
            background: warn ? undefined : barColor,
            transform: `scaleX(${Math.max(0, Math.min(1, share))})`,
            transformOrigin: "left",
          }}
        />
      </div>
    </div>
  )
}

/** Item name with its picture and item code. */
export function ItemCellBody({ item, meta }: { item: Item; meta?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <ItemIcon category={item.category} size="sm" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="max-w-[200px] truncate text-[15px] text-foreground lg:max-w-[280px]">{item.name}</span>
        <span className="text-[13px] text-muted-foreground tabular">{meta ?? `Item code ${item.sku}`}</span>
      </div>
    </div>
  )
}

/** Right-aligned figure; zero renders as a quiet dash. */
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
    <TableCell className={cn("text-right tabular", zero ? "text-muted-foreground/70" : "text-fg-secondary", className)}>
      {zero ? "—" : (children ?? (value !== undefined ? num(value) : null))}
    </TableCell>
  )
}

/** A table header with a "?" next to it. */
export function HeadHelp({ children, help, label }: { children: React.ReactNode; help: React.ReactNode; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {children}
      <HelpTip label={label}>{help}</HelpTip>
    </span>
  )
}

/** "12% more than the 30 days before". Tone is only applied when direction has a meaning. */
export function deltaPct(
  cur: number,
  prev: number,
  label: string,
  meaning: "higher-good" | "neutral" = "higher-good",
): { text: string; tone: "positive" | "negative" | "neutral" } | undefined {
  if (!prev) return undefined
  const d = ((cur - prev) / prev) * 100
  const rounded = Math.round(d)
  if (rounded === 0) return { text: `About the same as ${label}`, tone: "neutral" }
  return {
    text: `${Math.abs(rounded)}% ${d > 0 ? "more" : "less"} than ${label}`,
    tone: meaning === "neutral" ? "neutral" : d > 0 ? "positive" : "negative",
  }
}

/** "3 more than the 30 days before" for counts. */
export function deltaCount(
  cur: number,
  prev: number,
  label: string,
  meaning: "higher-good" | "neutral" = "higher-good",
): { text: string; tone: "positive" | "negative" | "neutral" } | undefined {
  if (!prev) return undefined
  const diff = cur - prev
  if (diff === 0) return { text: `Same as ${label}`, tone: "neutral" }
  return {
    text: `${num(Math.abs(diff))} ${diff > 0 ? "more" : "fewer"} than ${label}`,
    tone: meaning === "neutral" ? "neutral" : diff > 0 ? "positive" : "negative",
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
    className: "cursor-pointer outline-none focus-visible:bg-accent",
  }
}

/** Looks like a StatCard, but the figure is a name (e.g. "Top customer"). */
export function TextStat({
  label,
  value,
  footnote,
  icon: Icon,
  tone = "info",
}: {
  label: string
  value: string
  footnote?: React.ReactNode
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>
  tone?: Tone
}) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center gap-3">
        {Icon ? (
          <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", TONE_PILL[tone])}>
            <Icon className="size-5" strokeWidth={1.75} />
          </span>
        ) : null}
        <span className="text-[15px] leading-snug font-medium text-fg-secondary">{label}</span>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="text-[22px] leading-tight font-semibold tracking-[-0.01em] break-words text-foreground">{value}</p>
        {footnote ? <p className="text-sm text-muted-foreground">{footnote}</p> : null}
      </div>
    </div>
  )
}

/** "Showing 4 of 30 items" with a Clear filters button when something is filtered. */
export function ResultsLine({
  shown,
  total,
  noun,
  filtered,
  onClear,
}: {
  shown: number
  total: number
  noun: string
  filtered: boolean
  onClear: () => void
}) {
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1">
      <p className="text-sm text-fg-secondary tabular" aria-live="polite">
        Showing {num(shown)} of {num(total)} {noun}
      </p>
      {filtered ? (
        <Button variant="ghost" size="sm" onClick={onClear} className="text-primary-ink hover:text-primary-ink">
          <XIcon strokeWidth={2} />
          Clear filters
        </Button>
      ) : null}
    </div>
  )
}

/** "24 pcs", "1 coil", "3 boxes" */
export function qtyUnit(qty: number, unit: Unit) {
  if (unit === "pcs") return `${num(qty)} pcs`
  if (unit === "box") return `${num(qty)} ${qty === 1 ? "box" : "boxes"}`
  return `${num(qty)} ${qty === 1 ? "coil" : "coils"}`
}

/** Phone card used instead of a wide table row. Whole card opens the detail. */
export function MobileRow({
  onClick,
  title,
  subtitle,
  badge,
  figures,
  icon,
}: {
  onClick?: () => void
  title: React.ReactNode
  subtitle?: React.ReactNode
  badge?: React.ReactNode
  figures: { label: string; value: React.ReactNode; className?: string }[]
  icon?: React.ReactNode
}) {
  const Comp = onClick ? "button" : "div"
  return (
    <li>
      <Comp
        type={onClick ? "button" : undefined}
        onClick={onClick}
        className={cn(
          "flex w-full flex-col gap-3 px-4 py-4 text-left outline-none",
          onClick && "transition-colors hover:bg-accent/60 focus-visible:bg-accent",
        )}
      >
        <div className="flex items-start gap-3">
          {icon}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[15px] leading-snug font-medium text-foreground">{title}</span>
            {subtitle ? <span className="text-[13px] text-muted-foreground tabular">{subtitle}</span> : null}
          </div>
          {badge ? <div className="shrink-0">{badge}</div> : null}
        </div>
        <div className={cn("grid gap-3", figures.length >= 3 ? "grid-cols-3" : "grid-cols-2")}>
          {figures.map((f) => (
            <div key={f.label} className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[13px] text-muted-foreground">{f.label}</span>
              <span className={cn("text-[15px] font-medium text-foreground tabular", f.className)}>{f.value}</span>
            </div>
          ))}
        </div>
      </Comp>
    </li>
  )
}
