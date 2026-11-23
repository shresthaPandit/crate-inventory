import { addDays, differenceInCalendarDays, startOfDay, startOfMonth } from "date-fns"

export type RangeKey = "7d" | "30d" | "60d" | "month"

/** Shortest first. Each label says exactly which days are counted. */
export const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "month", label: "This month" },
  { value: "30d", label: "Last 30 days" },
  { value: "60d", label: "Last 60 days" },
]

export interface Range {
  key: RangeKey
  /** start of the first day, ms */
  from: number
  /** now, ms */
  to: number
  /** previous period of equal length, [prevFrom, prevTo) */
  prevFrom: number
  prevTo: number
  /** calendar days in the range, today included */
  days: number
  /** "the 30 days before", read as "12% more than the 30 days before" */
  compareLabel: string
  /** daily buckets up to a month, weekly beyond */
  bucket: "day" | "week"
}

export const DAY_MS = 86_400_000

export function getRange(key: RangeKey, now = Date.now()): Range {
  const today = startOfDay(now)
  const from = key === "month" ? startOfMonth(today) : addDays(today, -(key === "7d" ? 6 : key === "30d" ? 29 : 59))
  const days = differenceInCalendarDays(today, from) + 1
  const prevFrom = addDays(from, -days).getTime()
  return {
    key,
    from: from.getTime(),
    to: now,
    prevFrom,
    prevTo: from.getTime(),
    days,
    compareLabel: days === 1 ? "the day before" : `the ${days} days before`,
    bucket: days > 31 ? "week" : "day",
  }
}

export const inRange = (ms: number, from: number, to: number) => ms >= from && ms <= to
export const inPrev = (ms: number, r: Range) => ms >= r.prevFrom && ms < r.prevTo

/** Day-start timestamps from range start to today. */
export function rangeDays(r: Range) {
  return Array.from({ length: r.days }, (_, i) => addDays(r.from, i).getTime())
}

/* ------------------------------------------------------------------ */
/* CSV export                                                           */
/* ------------------------------------------------------------------ */

function escapeCsv(v: string | number | null | undefined) {
  const s = v === null || v === undefined ? "" : String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(headers: string[], rows: (string | number)[][]) {
  return [headers, ...rows].map((r) => r.map(escapeCsv).join(",")).join("\r\n")
}

export function downloadCsv(filename: string, csv: string) {
  // BOM so Excel reads ₹ and en-dashes as UTF-8
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
