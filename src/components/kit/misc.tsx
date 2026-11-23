"use client"

import { motion } from "motion/react"
import { CableIcon, CylinderIcon, FanIcon, LightbulbIcon, PlugIcon, SearchIcon, ToggleRightIcon, XIcon } from "lucide-react"
import { useId } from "react"
import type { Category } from "@/lib/types"
import { cn } from "@/lib/utils"
import { EASE } from "./page"

/* ------------------------------------------------------------------ */
/* Search field — icon, input, clear button. Label is just "Search".   */
/* ------------------------------------------------------------------ */
export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className,
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
}) {
  return (
    <div className={cn("relative flex h-10 w-full items-center sm:w-80", className)}>
      <SearchIcon aria-hidden className="pointer-events-none absolute left-3 size-[18px] text-muted-foreground" strokeWidth={1.75} />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-10 w-full rounded-lg border border-input bg-card pr-9 pl-10 text-[15px] text-foreground shadow-xs transition-colors outline-none placeholder:text-muted-foreground hover:border-foreground/25 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2 grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-raised hover:text-foreground"
        >
          <XIcon className="size-4" strokeWidth={1.75} />
        </button>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Segmented control with a sliding active surface (status filters).   */
/* ------------------------------------------------------------------ */
export function Segmented<T extends string>({
  value,
  onValueChange,
  items,
  className,
}: {
  value: T
  onValueChange: (v: T) => void
  items: { value: T; label: string; count?: number }[]
  className?: string
}) {
  const id = useId()
  return (
    <div
      role="tablist"
      className={cn(
        "scroll-quiet inline-flex h-11 max-w-full items-center gap-1 overflow-x-auto rounded-xl bg-raised p-1",
        className,
      )}
    >
      {items.map((it) => {
        const active = it.value === value
        return (
          <button
            key={it.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onValueChange(it.value)}
            className={cn(
              "relative flex h-full shrink-0 items-center gap-2 rounded-lg px-3.5 text-[15px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              active ? "font-medium text-foreground" : "text-fg-secondary hover:text-foreground",
            )}
          >
            {active ? (
              <motion.span
                layoutId={`seg-${id}`}
                transition={{ duration: 0.3, ease: EASE }}
                className="absolute inset-0 rounded-lg bg-card shadow-card ring-1 ring-border"
              />
            ) : null}
            <span className="relative">{it.label}</span>
            {typeof it.count === "number" ? (
              <span
                className={cn(
                  "relative min-w-6 rounded-full px-1.5 text-center text-xs leading-5 font-semibold tabular",
                  active ? "bg-primary text-primary-foreground" : "bg-card text-fg-secondary",
                )}
              >
                {it.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Empty state                                                          */
/* ------------------------------------------------------------------ */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-6 py-14 text-center", className)}>
      {Icon ? (
        <div className="grid size-12 place-items-center rounded-full bg-accent text-primary-ink">
          <Icon className="size-6" strokeWidth={1.75} />
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        <p className="text-base font-semibold text-foreground">{title}</p>
        {description ? <p className="max-w-sm text-[15px] text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Item icon: a coloured category picture, so items are easy to spot.   */
/* (Named BinLabel for older callers.)                                  */
/* ------------------------------------------------------------------ */
const CATEGORY: Record<Category, { Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; tone: string }> = {
  Lighting: { Icon: LightbulbIcon, tone: "bg-amber-50 text-amber-600 ring-amber-200/70" },
  "Wires & cables": { Icon: CableIcon, tone: "bg-sky-50 text-sky-600 ring-sky-200/70" },
  Switchgear: { Icon: ToggleRightIcon, tone: "bg-violet-50 text-violet-600 ring-violet-200/70" },
  Fans: { Icon: FanIcon, tone: "bg-teal-50 text-teal-600 ring-teal-200/70" },
  "Conduits & fittings": { Icon: CylinderIcon, tone: "bg-slate-100 text-slate-600 ring-slate-200" },
  Accessories: { Icon: PlugIcon, tone: "bg-rose-50 text-rose-600 ring-rose-200/70" },
}

export function BinLabel({ category, size = "md", className }: { category: Category; size?: "sm" | "md" | "lg"; className?: string }) {
  const { Icon, tone } = CATEGORY[category]
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-lg ring-1 ring-inset",
        tone,
        size === "sm" && "size-8",
        size === "md" && "size-10",
        size === "lg" && "size-14 rounded-xl",
        className,
      )}
    >
      <Icon className={cn(size === "sm" ? "size-4" : size === "md" ? "size-5" : "size-7")} strokeWidth={1.75} />
    </span>
  )
}

export const ItemIcon = BinLabel

/* ------------------------------------------------------------------ */
/* Keycap                                                               */
/* ------------------------------------------------------------------ */
export function Keycap({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-border bg-raised px-1 font-mono text-[11px] text-muted-foreground",
        className,
      )}
    >
      {children}
    </kbd>
  )
}

/* ------------------------------------------------------------------ */
/* Mono meta text (document numbers, SKUs, counts)                      */
/* ------------------------------------------------------------------ */
export function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("text-[13px] text-muted-foreground tabular", className)}>{children}</span>
}

/* ------------------------------------------------------------------ */
/* Small labelled field row used inside detail sheets                   */
/* ------------------------------------------------------------------ */
export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <div className="min-w-0 text-[15px] text-foreground">{children}</div>
    </div>
  )
}
