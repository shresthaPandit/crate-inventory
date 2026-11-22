"use client"

import { motion } from "motion/react"
import { SearchIcon, XIcon } from "lucide-react"
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
  placeholder = "Search",
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
    <div className={cn("relative flex h-8 w-full items-center sm:w-64", className)}>
      <SearchIcon aria-hidden className="pointer-events-none absolute left-2.5 size-4 text-muted-foreground" strokeWidth={1.5} />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-8 w-full rounded-lg border border-input bg-transparent pr-8 pl-8 text-sm text-foreground transition-colors outline-none placeholder:text-muted-foreground hover:border-foreground/20 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-1.5 grid size-5 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-raised hover:text-foreground"
        >
          <XIcon className="size-3.5" strokeWidth={1.5} />
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
        "scroll-quiet inline-flex h-8 max-w-full items-center gap-0.5 overflow-x-auto rounded-lg border border-border bg-card p-0.5",
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
              "relative flex h-full shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active ? (
              <motion.span
                layoutId={`seg-${id}`}
                transition={{ duration: 0.3, ease: EASE }}
                className="absolute inset-0 rounded-md border border-border bg-raised shadow-highlight"
              />
            ) : null}
            <span className="relative">{it.label}</span>
            {typeof it.count === "number" ? (
              <span className="relative font-mono text-xs text-muted-foreground tabular">{it.count}</span>
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
        <div className="grid size-10 place-items-center rounded-lg border border-border bg-raised text-muted-foreground">
          <Icon className="size-[18px]" strokeWidth={1.5} />
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Bin label — the item's thumbnail. A stencilled category code, like   */
/* the label on a rack bin. No product photos, no coloured icons.       */
/* ------------------------------------------------------------------ */
const BIN: Record<Category, string> = {
  Lighting: "LT",
  "Wires & cables": "WC",
  Switchgear: "SG",
  Fans: "FN",
  "Conduits & fittings": "CF",
  Accessories: "AC",
}

export function BinLabel({ category, size = "md", className }: { category: Category; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative grid shrink-0 place-items-center rounded-md border border-border bg-raised font-mono font-medium text-fg-secondary",
        size === "sm" && "size-6 text-[10px]",
        size === "md" && "size-8 text-[11px]",
        size === "lg" && "size-12 rounded-lg text-sm",
        className,
      )}
    >
      {BIN[category]}
      <span className="absolute inset-x-1.5 bottom-1 h-px bg-foreground/10" />
    </span>
  )
}

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
  return <span className={cn("font-mono text-xs text-muted-foreground tabular", className)}>{children}</span>
}

/* ------------------------------------------------------------------ */
/* Small labelled field row used inside detail sheets                   */
/* ------------------------------------------------------------------ */
export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="min-w-0 text-sm text-foreground">{children}</div>
    </div>
  )
}
