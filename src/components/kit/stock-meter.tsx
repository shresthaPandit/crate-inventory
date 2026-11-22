import { stockStatus } from "@/lib/calc"
import { cn } from "@/lib/utils"

/**
 * Crate's signature: the shelf meter. Ten slots, like bays on a rack.
 * The scale runs to 3× the min level; the tick marks the min level.
 * Filled slots are grey when healthy, amber when low, none when out.
 * Use it wherever a quantity is shown against its reorder point.
 */
export function StockMeter({
  qty,
  min,
  slots = 10,
  size = "md",
  className,
}: {
  qty: number
  min: number
  slots?: number
  size?: "sm" | "md"
  className?: string
}) {
  const status = stockStatus(qty, min)
  const scale = Math.max(min * 3, 1)
  const filled = qty <= 0 ? 0 : Math.max(1, Math.min(slots, Math.round((qty / scale) * slots)))
  const tickAt = Math.round((min / scale) * slots) // after this many slots
  const h = size === "sm" ? "h-2.5" : "h-3.5"
  const w = size === "sm" ? "w-[3px]" : "w-1"

  return (
    <div
      role="meter"
      aria-valuenow={qty}
      aria-valuemin={0}
      aria-valuemax={scale}
      aria-label={`${qty} on hand, min level ${min}`}
      className={cn("inline-flex items-center gap-[2px]", className)}
    >
      {Array.from({ length: slots }, (_, i) => (
        <span key={i} className="contents">
          {i === tickAt ? (
            <span aria-hidden className={cn("mx-[1px] w-px rounded-full bg-muted-foreground/70", size === "sm" ? "h-3.5" : "h-[18px]")} />
          ) : null}
          <span
            aria-hidden
            className={cn(
              "rounded-[1px] transition-colors duration-300",
              h,
              w,
              i < filled
                ? status === "low"
                  ? "bg-warning"
                  : status === "out"
                    ? "bg-negative"
                    : "bg-fg-secondary"
                : status === "out"
                  ? "bg-negative/20"
                  : "bg-foreground/10",
            )}
          />
        </span>
      ))}
    </div>
  )
}
