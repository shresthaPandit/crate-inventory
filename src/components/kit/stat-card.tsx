"use client"

import { cn } from "@/lib/utils"
import { AnimatedNumber } from "./animated-number"

/**
 * Stat cards are numbers: a label, a big figure, and a change with what it
 * compares to. No sparklines or icons. `emphasis` gives the one key figure
 * on a screen the accent treatment.
 */
export function StatCard({
  label,
  value,
  kind = "number",
  suffix,
  delta,
  footnote,
  emphasis,
  onClick,
  className,
}: {
  label: string
  value: number
  kind?: "number" | "inr" | "percent"
  suffix?: string
  /** e.g. { text: "+12% vs last month", tone: "positive" } */
  delta?: { text: string; tone?: "positive" | "negative" | "neutral" }
  footnote?: React.ReactNode
  emphasis?: boolean
  onClick?: () => void
  className?: string
}) {
  const Comp = onClick ? "button" : "div"
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "group relative flex min-h-[120px] w-full min-w-0 flex-col justify-between gap-5 rounded-xl border border-border bg-card p-4 text-left sm:min-h-[132px] sm:gap-6 sm:p-5",
        onClick && "transition-colors hover:bg-raised/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-sm text-fg-secondary">
        {emphasis ? <span aria-hidden className="size-1.5 rounded-full bg-signal" /> : null}
        {label}
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline gap-1.5">
          <AnimatedNumber value={value} kind={kind} className="text-[22px] leading-none font-medium tracking-[-0.02em] text-foreground sm:text-[30px]" />
          {suffix ? <span className="text-sm text-muted-foreground">{suffix}</span> : null}
        </div>
        {delta || footnote ? (
          <div className="flex items-center gap-2 text-xs">
            {delta ? (
              <span
                className={cn(
                  "tabular",
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
    </Comp>
  )
}
