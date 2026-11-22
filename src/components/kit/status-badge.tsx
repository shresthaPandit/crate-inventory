import { cn } from "@/lib/utils"

type Tone = "neutral" | "positive" | "warning" | "negative" | "info" | "muted"

const LABELS = {
  // stock
  ok: ["In stock", "neutral"],
  low: ["Low stock", "warning"],
  out: ["Out of stock", "negative"],
  // sales
  draft: ["Draft", "muted"],
  confirmed: ["Confirmed", "info"],
  shipped: ["Shipped", "positive"],
  cancelled: ["Cancelled", "muted"],
  // payment
  unpaid: ["Unpaid", "neutral"],
  paid: ["Paid", "positive"],
  overdue: ["Overdue", "negative"],
  // purchase
  ordered: ["Pending", "warning"],
  received: ["Received", "positive"],
  late: ["Late", "negative"],
} as const satisfies Record<string, readonly [string, Tone]>

export type BadgeStatus = keyof typeof LABELS

const DOT: Record<Tone, string> = {
  neutral: "bg-fg-secondary",
  positive: "bg-positive",
  warning: "bg-warning",
  negative: "bg-negative",
  info: "bg-foreground",
  muted: "bg-muted-foreground/60",
}

/**
 * Quiet status: a coloured dot + sentence-case text inside a hairline tag.
 * The dot carries the meaning; the text stays neutral so a table of statuses
 * never turns into a rainbow.
 */
export function StatusBadge({
  status,
  label,
  className,
}: {
  status: BadgeStatus
  /** override the default text */
  label?: string
  className?: string
}) {
  const [text, tone] = LABELS[status]
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-md border border-border bg-transparent px-2 text-xs whitespace-nowrap",
        tone === "muted" ? "text-muted-foreground" : "text-fg-secondary",
        className,
      )}
    >
      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", DOT[tone])} />
      {label ?? text}
    </span>
  )
}

/** Same dot without the tag, for dense lists. */
export function StatusDot({ status, className }: { status: BadgeStatus; className?: string }) {
  const [, tone] = LABELS[status]
  return <span aria-hidden className={cn("inline-block size-1.5 shrink-0 rounded-full", DOT[tone], className)} />
}
