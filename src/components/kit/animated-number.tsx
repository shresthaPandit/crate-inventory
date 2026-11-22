"use client"

import NumberFlow, { type Format } from "@number-flow/react"
import { cn } from "@/lib/utils"

/**
 * A number that tweens when it changes (e.g. stock drops after a sale ships).
 * `kind="inr"` renders ₹ with Indian grouping, whole rupees.
 */
export function AnimatedNumber({
  value,
  kind = "number",
  className,
}: {
  value: number
  kind?: "number" | "inr" | "percent"
  className?: string
}) {
  const format: Format =
    kind === "inr"
      ? { style: "currency", currency: "INR", maximumFractionDigits: 0 }
      : kind === "percent"
        ? { style: "percent", maximumFractionDigits: 0 }
        : { maximumFractionDigits: 0 }
  return (
    <NumberFlow
      value={kind === "percent" ? value / 100 : Math.round(value)}
      locales="en-IN"
      format={format}
      className={cn("tabular", className)}
      transformTiming={{ duration: 500, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}
      spinTiming={{ duration: 500, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}
    />
  )
}
