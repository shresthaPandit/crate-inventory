/* Date and name helpers shared by the Home panels. For the current time, use `useNow` from "@/lib/store". */

export const DAY_MS = 86_400_000

export function dayStart(ms: number) {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** "LED panel 15W, round, cool white" → "LED panel 15W" for sentences, toasts and tight rows. */
export function shortName(name: string) {
  return name.split(",")[0]
}
