import {
  BanIcon,
  CircleCheckIcon,
  CircleXIcon,
  ClockIcon,
  FileTextIcon,
  PackageCheckIcon,
  PackageIcon,
  TriangleAlertIcon,
  TruckIcon,
  WalletIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

export type Tone = "neutral" | "positive" | "warning" | "negative" | "info" | "muted"

type Icon = React.ComponentType<{ className?: string; strokeWidth?: number }>

/**
 * Every status in plain words, with a colour that means the same thing
 * everywhere: green = done or fine, amber = needs attention soon,
 * red = act now, blue = waiting on the next step, grey = nothing to do.
 */
const LABELS = {
  // stock
  ok: ["In stock", "positive", CircleCheckIcon],
  low: ["Running low", "warning", TriangleAlertIcon],
  out: ["Out of stock", "negative", CircleXIcon],
  // sales
  draft: ["Draft", "muted", FileTextIcon],
  confirmed: ["Ready to ship", "info", PackageIcon],
  shipped: ["Shipped", "positive", TruckIcon],
  cancelled: ["Cancelled", "muted", BanIcon],
  // payment
  unpaid: ["Not paid yet", "neutral", WalletIcon],
  paid: ["Paid", "positive", CircleCheckIcon],
  overdue: ["Payment late", "negative", TriangleAlertIcon],
  // purchase
  ordered: ["On the way", "info", ClockIcon],
  received: ["Received", "positive", PackageCheckIcon],
  late: ["Late", "negative", TriangleAlertIcon],
} as const satisfies Record<string, readonly [string, Tone, Icon]>

export type BadgeStatus = keyof typeof LABELS

export const TONE_PILL: Record<Tone, string> = {
  neutral: "bg-raised text-fg-secondary",
  positive: "bg-positive-soft text-positive",
  warning: "bg-warning-soft text-warning",
  negative: "bg-negative-soft text-negative",
  info: "bg-info-soft text-info",
  muted: "bg-raised text-muted-foreground",
}

const DOT: Record<Tone, string> = {
  neutral: "bg-fg-secondary",
  positive: "bg-positive",
  warning: "bg-warning",
  negative: "bg-negative",
  info: "bg-info",
  muted: "bg-muted-foreground/60",
}

export function statusLabel(status: BadgeStatus) {
  return LABELS[status][0]
}

export function statusTone(status: BadgeStatus): Tone {
  return LABELS[status][1]
}

/** Soft coloured pill: icon + plain words. */
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
  const [text, tone, Icon] = LABELS[status]
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium whitespace-nowrap",
        TONE_PILL[tone],
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" strokeWidth={2} />
      {label ?? text}
    </span>
  )
}

/** Just the coloured dot, for very dense lists. */
export function StatusDot({ status, className }: { status: BadgeStatus; className?: string }) {
  const [, tone] = LABELS[status]
  return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full", DOT[tone], className)} />
}
