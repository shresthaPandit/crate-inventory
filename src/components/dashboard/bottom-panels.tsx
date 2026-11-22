"use client"

import { motion } from "motion/react"
import { useRouter } from "next/navigation"
import { useMemo } from "react"
import { BinLabel, Mono } from "@/components/kit/misc"
import { EASE } from "@/components/kit/page"
import { Panel } from "@/components/kit/panel"
import { inr, num } from "@/lib/format"
import { useInventory, useUI } from "@/lib/store"
import { DAY_MS, useNow } from "./use-now"

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
    <Panel className={className} title="Top movers" description="By sales value, last 30 days, before GST" bodyClassName="px-3 pb-3">
      <ol className="flex flex-col">
        {rows.map(({ item, value, units, share }, i) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => openPanel({ type: "item", id: item.id })}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors outline-none hover:bg-raised/60 focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <Mono className="w-4 shrink-0 text-right">{i + 1}</Mono>
              <BinLabel category={item.category} size="sm" />
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="flex items-baseline gap-3">
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">{item.name}</span>
                  <span className="shrink-0 font-mono text-sm text-foreground tabular">{inr(value)}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/[0.06]">
                    <motion.span
                      className="block h-full origin-left rounded-full bg-fg-secondary/70"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: share }}
                      transition={{ duration: 0.6, ease: EASE }}
                    />
                  </span>
                  <span className="w-20 shrink-0 text-right font-mono text-xs text-muted-foreground tabular">
                    {num(units)} {item.unit}
                  </span>
                </span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </Panel>
  )
}

/** Per-godown units, value, fill against capacity and items out there. */
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
    <Panel className={className} title="Godowns" description="Units on hand against rack capacity" bodyClassName="px-3 pb-3">
      <ul className="flex flex-col">
        {rows.map(({ g, units, value, out, fill }) => (
          <li key={g.id}>
            <button
              type="button"
              onClick={() => router.push("/godowns")}
              className="flex w-full flex-col gap-2.5 rounded-lg px-2 py-3 text-left transition-colors outline-none hover:bg-raised/60 focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <span className="flex items-baseline gap-3">
                <span className="text-sm text-foreground">{g.name}</span>
                <Mono>{g.code}</Mono>
                <span className="ml-auto font-mono text-sm text-foreground tabular">{inr(value)}</span>
              </span>
              <span className="flex items-center gap-3">
                <span className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/[0.06]">
                  <motion.span
                    className="block h-full origin-left rounded-full bg-fg-secondary/70"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: fill }}
                    transition={{ duration: 0.6, ease: EASE }}
                  />
                </span>
                <span className="w-28 shrink-0 text-right font-mono text-xs text-muted-foreground tabular">
                  {num(units)} / {num(g.capacity)}
                </span>
              </span>
              <span className="flex items-center gap-3 text-xs">
                <span className="text-muted-foreground">{g.manager}</span>
                {out > 0 ? (
                  <span className="ml-auto text-warning">
                    {out} {out === 1 ? "item" : "items"} out here
                  </span>
                ) : (
                  <span className="ml-auto text-muted-foreground">All items stocked</span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
