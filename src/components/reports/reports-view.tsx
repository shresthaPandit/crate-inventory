"use client"

import { format } from "date-fns"
import { AnimatePresence, motion } from "motion/react"
import { useMemo, useState } from "react"
import { DownloadIcon } from "lucide-react"
import { toast } from "sonner"
import { Segmented } from "@/components/kit/misc"
import { EASE, Page, PageHeader } from "@/components/kit/page"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { date } from "@/lib/format"
import { PurchaseReport } from "./purchase-report"
import { useNow } from "@/lib/store"
import { RANGE_OPTIONS, downloadCsv, getRange, toCsv, type RangeKey } from "./range"
import { SalesReport } from "./sales-report"
import { StockReport } from "./stock-report"
import { usePurchaseReport, useSalesReport, useStockReport } from "./use-reports"

type Tab = "stock" | "sales" | "purchases"

const STATUS_TEXT = { ok: "In stock", low: "Low stock", out: "Out of stock" } as const
const PO_STATE_TEXT = { received: "Received", ordered: "Pending", late: "Late", cancelled: "Cancelled" } as const

export function ReportsView() {
  const [tab, setTab] = useState<Tab>("stock")
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
      headers = ["SKU", "Item", "Category", "Unit", "Opening", "In", "Out", "Other", "Closing", "Min level", "Value (INR)", "Status"]
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
      headers = ["SKU", "Item", "Category", "Units sold", "Revenue ex GST (INR)", "Margin (INR)", "Margin %"]
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
      headers = ["PO", "Supplier", "Ordered", "Expected", "Received", "Status", "Units", "Amount ex GST (INR)"]
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
      toast("Nothing to export", { description: "This period has no rows in the table" })
      return
    }
    downloadCsv(filename, toCsv(headers, rows))
    toast.success(`Exported ${rows.length} rows`, { description: filename })
  }

  return (
    <Page>
      <PageHeader
        title="Reports"
        description="Stock, sales and purchasing for the period you pick"
        actions={
          <>
            <Select value={rangeKey} onValueChange={(v) => setRangeKey(v as RangeKey)}>
              <SelectTrigger className="w-[148px]" aria-label="Period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {RANGE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportCsv} className="gap-1.5">
              <DownloadIcon className="size-4" strokeWidth={1.5} />
              Export CSV
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented<Tab>
          value={tab}
          onValueChange={setTab}
          items={[
            { value: "stock", label: "Stock" },
            { value: "sales", label: "Sales" },
            { value: "purchases", label: "Purchases" },
          ]}
        />
        <p className="font-mono text-xs text-muted-foreground tabular">
          {date(range.from)} to {date(range.to)}
        </p>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25, ease: EASE }}
        >
          {tab === "stock" ? <StockReport data={stock} range={range} /> : null}
          {tab === "sales" ? <SalesReport data={sales} range={range} /> : null}
          {tab === "purchases" ? <PurchaseReport data={purchases} range={range} /> : null}
        </motion.div>
      </AnimatePresence>
    </Page>
  )
}
