import { stockStatus } from "@/lib/calc"
import { cn } from "@/lib/utils"

/**
 * A plain fill bar: how full the shelf is. Green when fine, amber when
 * running low, red when empty. The thin mark shows the minimum level.
 * Scale runs to 3x the minimum level.
 */
export function StockMeter({
  qty,
  min,
  size = "md",
  className,
}: {
  qty: number
  min: number
  /** kept for older callers, ignored */
  slots?: number
  size?: "sm" | "md"
  className?: string
}) {
  const status = stockStatus(qty, min)
  const scale = Math.max(min * 3, 1)
  const pct = qty <= 0 ? 0 : Math.max(4, Math.min(100, (qty / scale) * 100))
  const minPct = (min / scale) * 100
  return (
    <div
      role="meter"
      aria-valuenow={qty}
      aria-valuemin={0}
      aria-valuemax={scale}
      aria-label={`${qty} in stock, minimum ${min}`}
      className={cn("relative shrink-0 rounded-full bg-raised", size === "sm" ? "h-1.5 w-16" : "h-2 w-24", className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500",
          status === "ok" && "bg-positive",
          status === "low" && "bg-warning",
          status === "out" && "bg-negative",
        )}
        style={{ width: `${pct}%` }}
      />
      <span aria-hidden className="absolute -top-0.5 -bottom-0.5 w-0.5 rounded-full bg-foreground/35" style={{ left: `${minPct}%` }} />
    </div>
  )
}
