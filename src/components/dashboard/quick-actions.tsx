"use client"

import { QUICK_ACTIONS } from "@/components/kit/actions"
import { useUI } from "@/lib/store"
import { cn } from "@/lib/utils"

type ActionType = (typeof QUICK_ACTIONS)[number]["type"]

/** Same colour cue as the chart: selling takes stock out (blue), buying brings it in (green). */
const CHIP: Record<ActionType, string> = {
  sale: "bg-info-soft text-info",
  purchase: "bg-positive-soft text-positive",
  transfer: "bg-raised text-fg-secondary",
  adjust: "bg-raised text-fg-secondary",
}

/** The four everyday jobs as big buttons: picture, name, one line on what it does. */
export function QuickActions({ className }: { className?: string }) {
  const openComposer = useUI((s) => s.openComposer)

  return (
    <section aria-labelledby="quick-actions-title" className={cn("flex flex-col gap-3", className)}>
      <h2 id="quick-actions-title" className="text-base font-semibold text-foreground">
        What do you want to do?
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {QUICK_ACTIONS.map((a) => (
          <button
            key={a.type}
            type="button"
            onClick={() => openComposer({ type: a.type })}
            className="group flex min-h-36 min-w-0 flex-col items-start gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-card transition-[border-color,box-shadow] outline-none hover:border-primary/40 hover:shadow-float focus-visible:ring-3 focus-visible:ring-ring/40 sm:p-5"
          >
            <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", CHIP[a.type])}>
              <a.icon className="size-[22px]" strokeWidth={1.75} />
            </span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-base leading-snug font-semibold text-foreground group-hover:text-primary-ink">{a.label}</span>
              <span className="text-[13px] leading-snug text-fg-secondary sm:text-sm">{a.hint}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
