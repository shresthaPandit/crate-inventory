"use client"

import { format } from "date-fns"
import { AnimatePresence, motion } from "motion/react"
import { useMemo, useState } from "react"
import { BoxesIcon, ChartColumnIcon, DownloadIcon, ShoppingCartIcon, TruckIcon } from "lucide-react"
import { toast } from "sonner"
import { Segmented } from "@/components/kit/misc"
import { EASE, Page, PageHeader } from "@/components/kit/page"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { date } from "@/lib/format"
import { useNow } from "@/lib/store"
import { cn } from "@/lib/utils"
import { PurchaseReport } from "./purchase-report"
import { RANGE_OPTIONS, downloadCsv, getRange, toCsv, type RangeKey } from "./range"
import { SalesReport } from "./sales-report"
import { StockReport } from "./stock-report"
import { usePurchaseReport, useSalesReport, useStockReport } from "./use-reports"

type Tab = "sales" | "purchases" | "stock"

const TABS: { value: Tab; label: string; hint: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }[] = [
  { value: "sales", label: "Sales", hint: "What you sold", icon: ShoppingCartIcon },
  { value: "purchases", label: "Purchases", hint: "What you bought", icon: TruckIcon },
  { value: "stock", label: "Stock", hint: "What you have", icon: BoxesIcon },
]

const STATUS_TEXT = { ok: "In stock", low: "Running low", out: "Out of stock" } as const
const PO_STATE_TEXT = { received: "Received", ordered: "On the way", late: "Late", cancelled: "Cancelled" } as const

export function ReportsView() {
  const [tab, setTab] = useState<Tab>("sales")
  const [rangeKey, setRangeKey] = useState<RangeKey>("30d")
  const now = useNow()
  const range = useMemo(() => getRange(rangeKey, now), [rangeKey, now])

  const stock = useStockReport(range)
  const sales = useSalesReport(range)
  const purchases = usePurchaseReport(range)

  const exportCsv = () => {
    const stamp = format(new Date(), "yyyy-MM-dd")
    const filename = `crate-${tab}-report-${stamp}.csv`
    let headers: string[] = []
    let rows: (string | number)[][] = []
    if (tab === "stock") {
      headers = [
        "Item code",
        "Item",
        "Kind of item",
        "Unit",
        "At start of period",
        "Came in",
        "Went out",
        "Moved or corrected",
        "In stock now",
        "Minimum level",
        "Stock value (₹)",
        "Status",
      ]
      rows = stock.rows.map((r) => [
        r.item.sku,
        r.item.name,
        r.item.category,
        r.item.unit,
        r.opening,
        r.in,
        r.out,
        r.other,
        r.closing,
        r.item.minLevel,
        Math.round(r.value),
        STATUS_TEXT[r.status],
      ])
    } else if (tab === "sales") {
      headers = ["Item code", "Item", "Kind of item", "Quantity sold", "Sales before GST (₹)", "Profit (₹)", "Profit %"]
      rows = sales.byItem.map((r) => [
        r.item.sku,
        r.item.name,
        r.item.category,
        r.units,
        Math.round(r.revenue),
        Math.round(r.margin),
        r.revenue ? ((r.margin / r.revenue) * 100).toFixed(1) : "",
      ])
    } else {
      headers = ["Order number", "Supplier", "Ordered on", "Due on", "Arrived on", "Status", "Quantity", "Amount before GST (₹)"]
      rows = purchases.rows.map((r) => [
        r.po.number,
        r.supplier?.name ?? "",
        format(new Date(r.po.date), "yyyy-MM-dd"),
        format(new Date(r.po.expectedDate), "yyyy-MM-dd"),
        r.po.receivedAt ? format(new Date(r.po.receivedAt), "yyyy-MM-dd") : "",
        PO_STATE_TEXT[r.state],
        r.units,
        Math.round(r.amount),
      ])
    }
    if (!rows.length) {
      toast("Nothing to download", { description: "There is nothing in this report for this time period. Pick a longer period." })
      return
    }
    downloadCsv(filename, toCsv(headers, rows))
    toast.success("Report downloaded", {
      description: `${rows.length} rows saved as ${filename}. Open it in Excel.`,
    })
  }

  const current = TABS.find((t) => t.value === tab)!
  const rangeLabel = RANGE_OPTIONS.find((o) => o.value === rangeKey)?.label ?? ""

  return (
    <Page>
      <PageHeader
        icon={ChartColumnIcon}
        title="Reports"
        description="Totals for sales, purchases and stock. Pick a time period, read the summary, or download it for Excel."
        actions={
          <Button size="lg" onClick={exportCsv}>
            <DownloadIcon strokeWidth={1.75} />
            Download for Excel (CSV)
          </Button>
        }
      />

      <div className="flex flex-col gap-4">
        <div role="tablist" aria-label="Which report" className="grid grid-cols-3 gap-2 sm:gap-3">
          {TABS.map((t) => {
            const active = t.value === tab
            return (
              <button
                key={t.value}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setTab(t.value)}
                className={cn(
                  "flex min-h-14 items-center justify-center gap-2.5 rounded-xl border bg-card px-3 py-3 text-left shadow-card transition-[border-color,background-color,box-shadow] outline-none focus-visible:ring-3 focus-visible:ring-ring/40 sm:justify-start sm:px-4",
                  active ? "border-primary bg-accent ring-1 ring-primary" : "border-border hover:border-primary/40 hover:shadow-float",
                )}
              >
                <span
                  className={cn(
                    "hidden size-10 shrink-0 place-items-center rounded-xl sm:grid",
                    active ? "bg-primary text-primary-foreground" : "bg-raised text-fg-secondary",
                  )}
                >
                  <t.icon className="size-5" strokeWidth={1.75} />
                </span>
                <t.icon className={cn("size-5 shrink-0 sm:hidden", active ? "text-primary-ink" : "text-fg-secondary")} strokeWidth={1.75} />
                <span className="flex min-w-0 flex-col">
                  <span className={cn("text-base leading-tight font-semibold", active ? "text-primary-ink" : "text-foreground")}>{t.label}</span>
                  <span className="hidden text-[13px] text-muted-foreground sm:block">{t.hint}</span>
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <span className="text-[15px] font-medium text-foreground">Time period</span>
            <Segmented<RangeKey>
              className="hidden sm:inline-flex"
              value={rangeKey}
              onValueChange={setRangeKey}
              items={RANGE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />
            <Select value={rangeKey} onValueChange={(v) => setRangeKey(v as RangeKey)}>
              <SelectTrigger className="w-full sm:hidden" aria-label="Time period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANGE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-fg-secondary tabular">
            {current.label}, {rangeLabel.toLowerCase()}: {date(range.from)} to today
          </p>
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25, ease: EASE }}
        >
          {tab === "sales" ? <SalesReport data={sales} range={range} /> : null}
          {tab === "purchases" ? <PurchaseReport data={purchases} range={range} /> : null}
          {tab === "stock" ? <StockReport data={stock} range={range} /> : null}
        </motion.div>
      </AnimatePresence>
    </Page>
  )
}
