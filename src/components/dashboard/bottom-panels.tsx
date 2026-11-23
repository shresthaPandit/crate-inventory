"use client"

import { motion } from "motion/react"
import { useRouter } from "next/navigation"
import { useMemo } from "react"
import { ChevronRightIcon, CircleCheckIcon, TriangleAlertIcon } from "lucide-react"
import { HelpTip } from "@/components/kit/help"
import { ItemIcon } from "@/components/kit/misc"
import { EASE } from "@/components/kit/page"
import { Panel } from "@/components/kit/panel"
import { inr, num } from "@/lib/format"
import { useInventory, useNow, useUI } from "@/lib/store"
import { GLOSSARY } from "@/lib/words"
import { count, qty } from "./plain"
import { DAY_MS } from "./use-now"

const GODOWN_MEANING = GLOSSARY.find((g) => g.term === "Godown")?.meaning

/** Top 6 items by sales value shipped in the last 30 days. */
export function TopMoversPanel({ className }: { className?: string }) {
  const salesOrders = useInventory((s) => s.salesOrders)
  const items = useInventory((s) => s.items)
  const openPanel = useUI((s) => s.openPanel)
  const now = useNow(60_000)

  const rows = useMemo(() => {
    const from = now - 30 * DAY_MS
    const agg = new Map<string, { value: number; units: number }>()
    for (const so of salesOrders) {
      if (so.status !== "shipped" || !so.shippedAt) continue
      if (new Date(so.shippedAt).getTime() < from) continue
      for (const l of so.lines) {
        const cur = agg.get(l.itemId) ?? { value: 0, units: 0 }
        cur.value += l.qty * l.rate
        cur.units += l.qty
        agg.set(l.itemId, cur)
      }
    }
    const list = [...agg.entries()]
      .map(([itemId, v]) => ({ item: items.find((i) => i.id === itemId), ...v }))
      .filter((r): r is { item: NonNullable<typeof r.item>; value: number; units: number } => Boolean(r.item))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
    const max = list[0]?.value ?? 1
    return list.map((r) => ({ ...r, share: r.value / max }))
  }, [salesOrders, items, now])

  return (
    <Panel
      className={className}
      title="Best sellers"
      description="Items that brought in the most money in the last 30 days, before tax."
      flush
    >
      {rows.length === 0 ? (
        <p className="border-t border-border px-5 py-6 text-[15px] text-muted-foreground">No sales shipped in the last 30 days yet.</p>
      ) : (
        <ol className="flex flex-col divide-y divide-border border-t border-border">
          {rows.map(({ item, value, units, share }, i) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => openPanel({ type: "item", id: item.id })}
                className="group flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors outline-none hover:bg-raised/60 focus-visible:bg-raised/60 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
              >
                <span className="w-5 shrink-0 text-right text-[15px] font-semibold text-muted-foreground tabular">{i + 1}</span>
                <ItemIcon category={item.category} size="sm" />
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="flex items-baseline gap-3">
                    <span className="min-w-0 flex-1 truncate text-[15px] text-foreground">{item.name}</span>
                    <span className="shrink-0 text-[15px] font-medium text-foreground tabular">{inr(value)}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-raised">
                      <motion.span
                        className="block h-full origin-left rounded-full bg-[var(--chart-2)]"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: share }}
                        transition={{ duration: 0.6, ease: EASE }}
                      />
                    </span>
                    <span className="shrink-0 text-right text-[13px] text-muted-foreground tabular">{qty(units, item.unit)} sold</span>
                  </span>
                </span>
                <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-muted-foreground group-hover:text-primary-ink" strokeWidth={2} />
              </button>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}

/** Per-godown stock value, how full it is, and how many items are missing there. */
export function GodownsPanel({ className }: { className?: string }) {
  const router = useRouter()
  const godowns = useInventory((s) => s.godowns)
  const items = useInventory((s) => s.items)
  const stock = useInventory((s) => s.stock)

  const rows = useMemo(
    () =>
      godowns.map((g) => {
        let units = 0
        let value = 0
        let out = 0
        for (const it of items) {
          const q = stock[it.id]?.[g.id] ?? 0
          units += q
          value += q * it.cost
          if (q <= 0) out++
        }
        return { g, units, value, out, fill: Math.min(1, units / g.capacity) }
      }),
    [godowns, items, stock],
  )

  return (
    <Panel
      className={className}
      title={
        <span className="inline-flex items-center gap-1.5">
          Your godowns
          {GODOWN_MEANING ? (
            <HelpTip label="What is a godown?">
              <span className="font-medium text-foreground">Godown.</span> {GODOWN_MEANING}
            </HelpTip>
          ) : null}
        </span>
      }
      description="What each godown holds and how full it is."
      flush
    >
      <ul className="flex flex-col divide-y divide-border border-t border-border">
        {rows.map(({ g, units, value, out, fill }) => (
          <li key={g.id}>
            <button
              type="button"
              onClick={() => router.push("/godowns")}
              className="group flex w-full items-center gap-3 px-5 py-4 text-left transition-colors outline-none hover:bg-raised/60 focus-visible:bg-raised/60 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-2">
                <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <span className="text-[15px] font-semibold text-foreground">
                    {g.name} <span className="font-normal text-muted-foreground">· {g.city}</span>
                  </span>
                  <span className="text-[15px] text-foreground tabular">{inr(value)} of stock</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-raised">
                    <motion.span
                      className="block h-full origin-left rounded-full bg-[var(--chart-3)]"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: fill }}
                      transition={{ duration: 0.6, ease: EASE }}
                    />
                  </span>
                  <span className="shrink-0 text-[13px] text-muted-foreground tabular">{Math.round(fill * 100)}% full</span>
                </span>
                <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[13px]">
                  <span className="text-muted-foreground">
                    {num(units)} of {num(g.capacity)} units of space · {g.manager} looks after it
                  </span>
                  {out > 0 ? (
                    <span className="inline-flex items-center gap-1 font-medium text-warning">
                      <TriangleAlertIcon className="size-3.5" strokeWidth={2} />
                      {count(out, "item")} out of stock here
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-positive">
                      <CircleCheckIcon className="size-3.5" strokeWidth={2} />
                      Every item in stock
                    </span>
                  )}
                </span>
              </span>
              <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-muted-foreground group-hover:text-primary-ink" strokeWidth={2} />
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
