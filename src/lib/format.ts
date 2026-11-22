import { format, formatDistanceToNowStrict, isToday, isYesterday } from "date-fns"

const inrFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 })
const numFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 })

/** ₹1,24,860 — whole rupees, Indian grouping. The one money format used everywhere. */
export function inr(n: number) {
  const sign = n < 0 ? "−" : ""
  return `${sign}₹${inrFmt.format(Math.abs(Math.round(n)))}`
}

/** ₹12.4L, ₹1.24Cr, ₹48.2K — for chart axes and tight spaces only. */
export function inrCompact(n: number) {
  const a = Math.abs(n)
  const sign = n < 0 ? "−" : ""
  if (a >= 1e7) return `${sign}₹${trim(a / 1e7, 2)}Cr`
  if (a >= 1e5) return `${sign}₹${trim(a / 1e5, 1)}L`
  if (a >= 1e3) return `${sign}₹${trim(a / 1e3, 1)}K`
  return `${sign}₹${Math.round(a)}`
}

function trim(n: number, digits: number) {
  return n.toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1")
}

export function num(n: number) {
  return numFmt.format(Math.round(n))
}

/** +12% / −4% */
export function pct(n: number, digits = 0) {
  const sign = n > 0 ? "+" : n < 0 ? "−" : ""
  return `${sign}${Math.abs(n).toFixed(digits)}%`
}

/** Signed quantity for the ledger: +48 / −12 */
export function signed(n: number) {
  if (n > 0) return `+${num(n)}`
  if (n < 0) return `−${num(Math.abs(n))}`
  return "0"
}

/** 23 Nov 2026 */
export function date(iso: string | number | Date) {
  return format(new Date(iso), "d MMM yyyy")
}

/** 23 Nov */
export function dateShort(iso: string | number | Date) {
  return format(new Date(iso), "d MMM")
}

/** 14:32 */
export function time(iso: string | number | Date) {
  return format(new Date(iso), "HH:mm")
}

/** Today, 14:32 · Yesterday, 09:10 · 21 Nov, 16:05 */
export function dateTime(iso: string | number | Date) {
  const d = new Date(iso)
  if (isToday(d)) return `Today, ${format(d, "HH:mm")}`
  if (isYesterday(d)) return `Yesterday, ${format(d, "HH:mm")}`
  return format(d, "d MMM, HH:mm")
}

/** 12 min ago · 3 h ago · 2 days ago */
export function ago(iso: string | number | Date) {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  if (diff < 60_000) return "just now"
  return formatDistanceToNowStrict(d, { addSuffix: true })
    .replace(" minutes", " min")
    .replace(" minute", " min")
    .replace(" hours", " h")
    .replace(" hour", " h")
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${num(n)} ${n === 1 ? one : many}`
}
