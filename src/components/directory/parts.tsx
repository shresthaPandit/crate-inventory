"use client"

import { PhoneIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { num } from "@/lib/format"
import type { Unit } from "@/lib/types"
import { cn } from "@/lib/utils"

/** "+91 98221 30418" → "tel:+919822130418" */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`

/** Matches a typed phone number however it was spaced ("98221 30418", "9822130418"). */
export function phoneMatches(phone: string, needle: string) {
  const digits = needle.replace(/\D/g, "")
  return digits.length >= 3 && phone.replace(/\D/g, "").includes(digits)
}

/** "24 pcs", "1 coil", "3 boxes" */
export function qtyUnit(qty: number, unit: Unit) {
  if (unit === "pcs") return `${num(qty)} pcs`
  if (unit === "box") return `${num(qty)} ${qty === 1 ? "box" : "boxes"}`
  return `${num(qty)} ${qty === 1 ? "coil" : "coils"}`
}

/** Phone number that dials on tap. Stops the click so the row behind it does not open. */
export function PhoneLink({ phone, className }: { phone: string; className?: string }) {
  return (
    <a
      href={telHref(phone)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      aria-label={`Call ${phone}`}
      className={cn(
        "inline-flex min-h-8 items-center gap-1.5 rounded-md text-[15px] text-fg-secondary tabular underline-offset-4 transition-colors outline-none hover:text-primary-ink hover:underline focus-visible:ring-2 focus-visible:ring-ring/50",
        className,
      )}
    >
      <PhoneIcon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
      {phone}
    </a>
  )
}

/** "Showing 4 of 12 customers" with a Clear filters button when something is filtered. */
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

/** A titled block inside a detail drawer. */
export function SheetSection({
  title,
  hint,
  children,
  className,
}: {
  title: React.ReactNode
  hint?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {hint ? <span className="text-[13px] text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </section>
  )
}

/** A label with a figure under it, in a soft box. Used for money and counts in drawers. */
export function FigureBox({
  label,
  value,
  note,
  tone,
  className,
}: {
  label: React.ReactNode
  value: React.ReactNode
  note?: React.ReactNode
  tone?: "negative" | "warning"
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1 rounded-xl border border-border bg-card px-4 py-3",
        tone === "negative" && "border-negative/25 bg-negative-soft/40",
        tone === "warning" && "border-warning/25 bg-warning-soft/40",
        className,
      )}
    >
      <span className="flex items-center gap-1 text-[13px] text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-lg leading-tight font-semibold text-foreground tabular",
          tone === "negative" && "text-negative",
        )}
      >
        {value}
      </span>
      {note ? <span className="text-[13px] text-muted-foreground">{note}</span> : null}
    </div>
  )
}

/** Shared class for the clickable lines inside a drawer list. */
export const LINE_CLASS =
  "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors outline-none hover:bg-accent/60 focus-visible:bg-accent"
