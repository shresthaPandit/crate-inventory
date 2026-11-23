"use client"

import { ArrowRightIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { AnimatedNumber } from "./animated-number"
import { TONE_PILL, type Tone } from "./status-badge"

type Icon = React.ComponentType<{ className?: string; strokeWidth?: number }>

/**
 * A number with its meaning: an icon, a plain label, the figure, and one
 * line that says whether it is good or bad. When clickable, it says where
 * it goes ("View" + arrow) instead of relying on hover.
 */
export function StatCard({
  label,
  value,
  kind = "number",
  suffix,
  delta,
  footnote,
  emphasis,
  icon: IconComp,
  tone = "info",
  onClick,
  actionLabel = "View",
  className,
}: {
  label: string
  value: number
  kind?: "number" | "inr" | "percent"
  suffix?: string
  /** e.g. { text: "12% more than last month", tone: "positive" } */
  delta?: { text: string; tone?: "positive" | "negative" | "neutral" }
  footnote?: React.ReactNode
  /** kept for older callers: same as tone="info" */
  emphasis?: boolean
  icon?: Icon
  tone?: Tone
  onClick?: () => void
  actionLabel?: string
  className?: string
}) {
  const Comp = onClick ? "button" : "div"
  const t = emphasis ? "info" : tone
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "group relative flex w-full min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-5 text-left shadow-card",
        onClick &&
          "transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-float focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        {IconComp ? (
          <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", TONE_PILL[t])}>
            <IconComp className="size-5" strokeWidth={1.75} />
          </span>
        ) : null}
        <span className="text-[15px] leading-snug font-medium text-fg-secondary">{label}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline gap-1.5">
          <AnimatedNumber
            value={value}
            kind={kind}
            className="text-[26px] leading-none font-semibold tracking-[-0.01em] text-foreground sm:text-[30px]"
          />
          {suffix ? <span className="text-[15px] text-muted-foreground">{suffix}</span> : null}
        </div>
        {delta || footnote ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
            {delta ? (
              <span
                className={cn(
                  "font-medium",
                  delta.tone === "positive" && "text-positive",
                  delta.tone === "negative" && "text-negative",
                  (!delta.tone || delta.tone === "neutral") && "text-muted-foreground",
                )}
              >
                {delta.text}
              </span>
            ) : null}
            {footnote ? <span className="text-muted-foreground">{footnote}</span> : null}
          </div>
        ) : null}
      </div>
      {onClick ? (
        <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary-ink">
          {actionLabel}
          <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
        </span>
      ) : null}
    </Comp>
  )
}
