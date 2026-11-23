"use client"

import { format } from "date-fns"
import { AnimatePresence } from "motion/react"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { BoxesIcon, CircleHelpIcon, PackageIcon, ShoppingCartIcon, TriangleAlertIcon } from "lucide-react"
import { toast } from "sonner"
import { Page } from "@/components/kit/page"
import { StatCard } from "@/components/kit/stat-card"
import { Button } from "@/components/ui/button"
import { lowStockItems, orderTotals, stockValue } from "@/lib/calc"
import { inr } from "@/lib/format"
import { useInventory, useNow } from "@/lib/store"
import { ActivityPanel } from "./activity-panel"
import { ArrivingPanel } from "./arriving-panel"
import { AttentionPanel } from "./attention-panel"
import { GodownsPanel, TopMoversPanel } from "./bottom-panels"
import { HowItWorksCard, readHowItWorksHidden, writeHowItWorksHidden } from "./how-it-works"
import { MovementChart } from "./movement-chart"
import { count, greeting, isAre } from "./plain"
import { QuickActions } from "./quick-actions"
import { DAY_MS } from "./use-now"

/** The person using the app (shown in the sidebar too). */
const FIRST_NAME = "Aarav"

function useKpis(now: number) {
  const items = useInventory((s) => s.items)
  const stock = useInventory((s) => s.stock)
  const salesOrders = useInventory((s) => s.salesOrders)

  return useMemo(() => {
    const d30 = now - 30 * DAY_MS
    const d60 = now - 60 * DAY_MS

    // Sales shipped (incl. GST): last 30 days and the 30 days before that
    let sales30 = 0
    let salesPrev = 0
    for (const so of salesOrders) {
      if (so.status !== "shipped" || !so.shippedAt) continue
      const t = new Date(so.shippedAt).getTime()
      if (t >= d30) sales30 += orderTotals(so.lines).total
      else if (t >= d60) salesPrev += orderTotals(so.lines).total
    }

    const low = lowStockItems(stock, items)
    const toShip = salesOrders.filter((o) => o.status === "confirmed")

    return {
      valueNow: stockValue(stock, items),
      sales30,
      salesPrev,
      lowCount: low.length,
      outCount: low.filter((l) => l.qty <= 0).length,
      toShip: toShip.length,
      toShipValue: toShip.reduce((s, o) => s + orderTotals(o.lines).total, 0),
      draftCount: salesOrders.filter((o) => o.status === "draft").length,
    }
  }, [items, stock, salesOrders, now])
}

/** "12% more than the 30 days before" in green, "8% less …" in red. */
function salesDelta(now: number, before: number) {
  if (!before) return undefined
  const change = Math.round(((now - before) / before) * 100)
  if (change > 0) return { text: `${change}% more than the 30 days before`, tone: "positive" as const }
  if (change < 0) return { text: `${-change}% less than the 30 days before`, tone: "negative" as const }
  return { text: "Same as the 30 days before", tone: "neutral" as const }
}

export function DashboardView() {
  const router = useRouter()
  const now = useNow(60_000)
  const k = useKpis(now)

  // The shell renders pages after mount, so reading the browser's choice here is safe.
  const [howHidden, setHowHidden] = useState(readHowItWorksHidden)
  const hideHow = () => {
    setHowHidden(true)
    writeHowItWorksHidden(true)
    toast("“How Crate works” is hidden", { description: "Press “Show how it works” at the top of Home, or Help, to read it again." })
  }
  const showHow = () => {
    setHowHidden(false)
    writeHowItWorksHidden(false)
  }

  return (
    <Page>
      <section
        aria-label="Welcome"
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#f58220] via-[#ea6c0f] to-[#d4560b] px-5 py-6 text-white shadow-[0_12px_32px_rgb(234_108_15/0.25)] sm:px-7 sm:py-7"
      >
        <div aria-hidden className="pointer-events-none absolute -top-20 -right-12 size-64 rounded-full bg-white/10" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 right-40 size-44 rounded-full bg-white/[0.07]" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1.5">
            <p className="text-sm font-medium text-white/85">{format(now, "EEEE, d MMMM yyyy")}</p>
            <h1 className="text-[26px] leading-tight font-semibold sm:text-[30px]">
              {greeting(now)}, {FIRST_NAME}
            </h1>
            <p className="max-w-xl text-[15px] leading-relaxed font-medium text-white/95">
              {k.lowCount || k.toShip
                ? `Today: ${count(k.lowCount, "item")} running low and ${count(k.toShip, "sale")} ready to ship. Start with “Needs your attention” below.`
                : "Everything looks good today. Nothing needs your attention."}
            </p>
          </div>
          {howHidden ? (
            <Button variant="outline" onClick={showHow} className="self-start border-white/40 bg-white/10 text-white shadow-none hover:bg-white/20 hover:text-white sm:self-auto">
              <CircleHelpIcon />
              Show how it works
            </Button>
          ) : null}
        </div>
      </section>

      <AnimatePresence initial={false}>{howHidden ? null : <HowItWorksCard key="how-it-works" onHide={hideHow} />}</AnimatePresence>

      <QuickActions />

      <section aria-label="Your shop in numbers" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Stock value"
          value={k.valueNow}
          kind="inr"
          icon={BoxesIcon}
          tone="neutral"
          footnote="What all the stock in your godowns cost you to buy"
          actionLabel="See stock"
          onClick={() => router.push("/stock")}
        />
        <StatCard
          label="Sales in the last 30 days"
          value={k.sales30}
          kind="inr"
          icon={ShoppingCartIcon}
          tone="positive"
          delta={salesDelta(k.sales30, k.salesPrev)}
          footnote={k.salesPrev ? undefined : "Shipped orders, tax included"}
          actionLabel="See sales"
          onClick={() => router.push("/sales")}
        />
        <StatCard
          label="Items running low"
          value={k.lowCount}
          icon={TriangleAlertIcon}
          tone={k.lowCount > 0 ? "warning" : "positive"}
          delta={k.outCount > 0 ? { text: `${k.outCount} ${isAre(k.outCount)} out of stock`, tone: "negative" } : undefined}
          footnote={k.lowCount > 0 ? "Order more soon" : "Every item is above its minimum level"}
          actionLabel="See items"
          onClick={() => router.push("/stock?status=low")}
        />
        <StatCard
          label="Orders to ship"
          value={k.toShip}
          icon={PackageIcon}
          tone="info"
          footnote={
            k.toShip > 0
              ? `${inr(k.toShipValue)} of goods ready to leave the godown`
              : k.draftCount > 0
                ? `Nothing ready yet. ${count(k.draftCount, "draft")} to confirm`
                : "Nothing is waiting to be shipped"
          }
          actionLabel="See orders"
          onClick={() => router.push("/sales?status=confirmed")}
        />
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-5">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-3">
          <AttentionPanel />
          <MovementChart />
        </div>
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
          <ArrivingPanel />
          <ActivityPanel />
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <TopMoversPanel />
        <GodownsPanel />
      </div>
    </Page>
  )
}
