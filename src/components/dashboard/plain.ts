import { differenceInCalendarDays, formatDistanceStrict } from "date-fns"
import { dateShort, num } from "@/lib/format"
import type { Unit } from "@/lib/types"

/* Small helpers that turn numbers and dates into everyday words for Home. */

const UNIT_WORDS: Record<Unit, [one: string, many: string]> = {
  pcs: ["pc", "pcs"],
  coil: ["coil", "coils"],
  box: ["box", "boxes"],
}

/** 24 pcs · 1 coil · 3 boxes */
export function qty(n: number, unit: Unit) {
  const [one, many] = UNIT_WORDS[unit]
  return `${num(n)} ${Math.abs(n) === 1 ? one : many}`
}

/** "1 sale" / "3 sales" (number first, so it reads as a sentence). */
export function count(n: number, one: string, many = `${one}s`) {
  return `${num(n)} ${n === 1 ? one : many}`
}

/** "is" / "are" to go with a count. */
export function isAre(n: number) {
  return n === 1 ? "is" : "are"
}

/** "just now" · "5 minutes ago" · "2 hours ago" · "3 days ago". Pure: pass the current time in. */
export function since(iso: string, now: number) {
  const t = new Date(iso).getTime()
  if (now - t < 60_000) return "just now"
  return formatDistanceStrict(t, now, { addSuffix: true })
}

/** Good morning / afternoon / evening, from the hour of `now`. */
export function greeting(now: number) {
  const h = new Date(now).getHours()
  if (h < 12) return "Good morning"
  if (h < 17) return "Good afternoon"
  return "Good evening"
}

/**
 * When a supplier order should arrive, in words:
 * "Arriving today" · "Arriving tomorrow" · "Arriving in 3 days, 26 Nov" · "2 days late, was due 21 Nov"
 */
export function arrivalText(expectedIso: string, now: number): { text: string; late: boolean } {
  const d = differenceInCalendarDays(new Date(expectedIso), new Date(now))
  const day = dateShort(expectedIso)
  if (d < 0) return { text: `${-d} ${d === -1 ? "day" : "days"} late, was due ${day}`, late: true }
  if (d === 0) return { text: "Arriving today", late: false }
  if (d === 1) return { text: "Arriving tomorrow", late: false }
  return { text: `Arriving in ${d} days, ${day}`, late: false }
}

/** "A" · "A and B" · "A, B and 3 more" */
export function nameList(names: string[], max = 2) {
  const unique = [...new Set(names)]
  if (unique.length <= 1) return unique[0] ?? ""
  if (unique.length <= max) return `${unique.slice(0, -1).join(", ")} and ${unique[unique.length - 1]}`
  const rest = unique.length - max
  return `${unique.slice(0, max).join(", ")} and ${rest} more`
}
