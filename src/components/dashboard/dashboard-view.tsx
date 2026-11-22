"use client"

import { format } from "date-fns"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo } from "react"
import { ArrowUpRightIcon } from "lucide-react"
import { Page, PageHeader } from "@/components/kit/page"
import { StatCard } from "@/components/kit/stat-card"
import { Button } from "@/components/ui/button"
import { isPurchaseOverdue, orderTotals, stockValue } from "@/lib/calc"
import { inr, pct } from "@/lib/format"
import { useInventory } from "@/lib/store"
import { ActivityPanel } from "./activity-panel"
import { ArrivingPanel } from "./arriving-panel"
import { GodownsPanel, TopMoversPanel } from "./bottom-panels"
import { LowStockPanel } from "./low-stock-panel"
import { MovementChart } from "./movement-chart"
import { DAY_MS, useNow } from "./use-now"

function change(now: number, then: number) {
  if (!then) return 0
  return ((now - then) / then) * 100
}

function useKpis() {
  const items = useInventory((s) => s.items)
  const stock = useInventory((s) => s.stock)
  const movements = useInventory((s) => s.movements)
  const salesOrders = useInventory((s) => s.salesOrders)
  const purchaseOrders = useInventory((s) => s.purchaseOrders)
  const now = useNow(60_000)

  return useMemo(() => {
    const d30 = now - 30 * DAY_MS
    const d60 = now - 60 * DAY_MS

    // Stock value now, and rebuilt as it stood 30 days ago by unwinding the ledger
    const cost = new Map(items.map((i) => [i.id, i.cost]))
    const valueNow = stockValue(stock, items)
    let delta30 = 0
    for (const m of movements) {
      if (new Date(m.date).getTime() >= d30) delta30 += m.qty * (cost.get(m.itemId) ?? 0)
    }
    const valueThen = valueNow - delta30

    // Sales shipped (incl. GST)
    let sales30 = 0
    let salesPrev = 0
    for (const so of salesOrders) {
      if (so.status !== "shipped" || !so.shippedAt) continue
      const t = new Date(so.shippedAt).getTime()
      if (t >= d30) sales30 += orderTotals(so.lines).total
      else if (t >= d60) salesPrev += orderTotals(so.lines).total
    }

    const openSales = salesOrders.filter((o) => o.status === "draft" || o.status === "confirmed")
    const openSalesValue = openSales.reduce((s, o) => s + orderTotals(o.lines).total, 0)
    const pendingPOs = purchaseOrders.filter((p) => p.status === "ordered")
    const latePOs = pendingPOs.filter((p) => isPurchaseOverdue(p, now)).length

    return {
      valueNow,
      valueChange: change(valueNow, valueThen),
      sales30,
      salesChange: change(sales30, salesPrev),
      openSales: openSales.length,
      openSalesValue,
      draftCount: openSales.filter((o) => o.status === "draft").length,
      pendingPOs: pendingPOs.length,
      latePOs,
    }
  }, [items, stock, movements, salesOrders, purchaseOrders, now])
}

export function DashboardView() {
  const router = useRouter()
  const k = useKpis()
  const title = format(new Date(), "EEEE, d MMMM")

  return (
    <Page>
      <PageHeader
        title={title}
        description="Deccan Electric Supply · 3 godowns"
        actions={
          <Button asChild variant="ghost" className="gap-1.5 text-fg-secondary">
            <Link href="/reports">
              Reports
              <ArrowUpRightIcon className="size-4" strokeWidth={1.5} />
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Stock value"
          value={k.valueNow}
          kind="inr"
          emphasis
          delta={{ text: `${pct(k.valueChange)} vs 30 days ago`, tone: "neutral" }}
          onClick={() => router.push("/stock")}
        />
        <StatCard
          label="Sales, last 30 days"
          value={k.sales30}
          kind="inr"
          delta={{
            text: `${pct(k.salesChange)} vs previous 30 days`,
            tone: k.salesChange > 0 ? "positive" : k.salesChange < 0 ? "negative" : "neutral",
          }}
          onClick={() => router.push("/sales")}
        />
        <StatCard
          label="Open sales orders"
          value={k.openSales}
          footnote={`${inr(k.openSalesValue)} · ${k.draftCount} draft`}
          onClick={() => router.push("/sales")}
        />
        <StatCard
          label="Pending purchases"
          value={k.pendingPOs}
          delta={
            k.latePOs > 0
              ? { text: `${k.latePOs} late`, tone: "negative" }
              : { text: "none late", tone: "neutral" }
          }
          onClick={() => router.push("/purchases")}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <MovementChart className="lg:col-span-2" />
        <LowStockPanel />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ActivityPanel className="lg:col-span-2" />
        <ArrivingPanel />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TopMoversPanel />
        <GodownsPanel />
      </div>
    </Page>
  )
}
