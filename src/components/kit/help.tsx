"use client"

import { CircleCheckIcon, CircleHelpIcon, InfoIcon, TriangleAlertIcon, CircleXIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { Tone } from "./status-badge"

/** A small "?" next to a word that might be new. Click or tap to read what it means. */
export function HelpTip({ children, label = "What does this mean?", className }: { children: React.ReactNode; label?: string; className?: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            "inline-grid size-5 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-primary-ink focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
            className,
          )}
        >
          <CircleHelpIcon className="size-4" strokeWidth={1.75} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 text-sm leading-relaxed text-fg-secondary">
        {children}
      </PopoverContent>
    </Popover>
  )
}

type CalloutTone = Extract<Tone, "info" | "positive" | "warning" | "negative">

const CALLOUT: Record<CalloutTone, { box: string; icon: string; Icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }> = {
  info: { box: "border-info/20 bg-info-soft/50", icon: "bg-info-soft text-info", Icon: InfoIcon },
  positive: { box: "border-positive/20 bg-positive-soft/50", icon: "bg-positive-soft text-positive", Icon: CircleCheckIcon },
  warning: { box: "border-warning/25 bg-warning-soft/50", icon: "bg-warning-soft text-warning", Icon: TriangleAlertIcon },
  negative: { box: "border-negative/20 bg-negative-soft/50", icon: "bg-negative-soft text-negative", Icon: CircleXIcon },
}

/**
 * "What happens next" box. Put one at the top of every detail view so a
 * first-time user always knows the next step and what it will change.
 */
export function NextStep({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: CalloutTone
  title: React.ReactNode
  children?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  const t = CALLOUT[tone]
  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center", t.box, className)}>
      <div className="flex min-w-0 flex-1 gap-3">
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", t.icon)}>
          <t.Icon className="size-[18px]" strokeWidth={2} />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5 pt-1">
          <p className="text-[15px] leading-snug font-semibold text-foreground">{title}</p>
          {children ? <div className="text-sm leading-relaxed text-fg-secondary">{children}</div> : null}
        </div>
      </div>
      {action ? <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">{action}</div> : null}
    </div>
  )
}

/** Numbered steps, for "how it works" explanations. */
export function Steps({ steps, className }: { steps: readonly { title: string; text: string }[]; className?: string }) {
  return (
    <ol className={cn("grid gap-3 sm:grid-cols-3", className)}>
      {steps.map((s, i) => (
        <li key={s.title} className="flex gap-3 rounded-xl border border-border bg-card p-4">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {i + 1}
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-[15px] font-semibold text-foreground">{s.title}</p>
            <p className="text-sm leading-relaxed text-fg-secondary">{s.text}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}
