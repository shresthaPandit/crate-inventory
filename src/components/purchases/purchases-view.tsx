"use client"

import { AnimatePresence, motion } from "motion/react"
import { useMemo, useState } from "react"
import { PlusIcon, TruckIcon } from "lucide-react"
import { toast } from "sonner"
import { Mono, EmptyState, SearchInput, Segmented } from "@/components/kit/misc"
import { EASE, Page, PageHeader, Stagger, StaggerItem } from "@/components/kit/page"
import { Panel } from "@/components/kit/panel"
import { StatCard } from "@/components/kit/stat-card"
import { StatusBadge } from "@/components/kit/status-badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { isPurchaseOverdue, orderTotals, startOfDayMs } from "@/lib/calc"
import { dateShort, inr, num, plural } from "@/lib/format"
import { useInventory, useUI } from "@/lib/store"
import type { PurchaseOrder } from "@/lib/types"
import { cn } from "@/lib/utils"
import { expectedHint, HINT_CLASS, nowMs, poBadge, receiptSummary, unitsOf } from "./lib"

type StatusFilter = "all" | "ordered" | "received" | "cancelled"

const DAY = 86_400_000
const PAGE = 25

export function PurchasesView() {
  const purchaseOrders = useInventory((s) => s.purchaseOrders)
  const suppliers = useInventory((s) => s.suppliers)
  const godowns = useInventory((s) => s.godowns)
  const items = useInventory((s) => s.items)
  const receivePurchase = useInventory((s) => s.receivePurchase)
  const openPanel = useUI((s) => s.openPanel)
  const openComposer = useUI((s) => s.openComposer)

  const [status, setStatus] = useState<StatusFilter>("all")
  const [supplierId, setSupplierId] = useState("all")
  const [godownId, setGodownId] = useState("all")
  const [q, setQ] = useState("")
  const [limit, setLimit] = useState(PAGE)

  const supplierById = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers])
  const godownById = useMemo(() => new Map(godowns.map((g) => [g.id, g])), [godowns])
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])

  const stats = useMemo(() => {
    const now = nowMs()
    const pending = purchaseOrders.filter((p) => p.status === "ordered")
    const late = pending.filter((p) => isPurchaseOverdue(p, now))
    const received30 = purchaseOrders.filter(
      (p) => p.status === "received" && p.receivedAt && new Date(p.receivedAt).getTime() >= now - 30 * DAY,
    )
    const today0 = startOfDayMs(now)
    const next = pending
      .filter((p) => new Date(p.expectedDate).getTime() >= today0)
      .sort((a, b) => (a.expectedDate < b.expectedDate ? -1 : 1))[0]
    return {
      pending: pending.length,
      pendingValue: pending.reduce((s, p) => s + orderTotals(p.lines).subtotal, 0),
      late: late.length,
      received30: received30.reduce((s, p) => s + orderTotals(p.lines).subtotal, 0),
      received30Count: received30.length,
      next,
    }
  }, [purchaseOrders])

  const counts = useMemo(
    () => ({
      all: purchaseOrders.length,
      ordered: purchaseOrders.filter((p) => p.status === "ordered").length,
      received: purchaseOrders.filter((p) => p.status === "received").length,
      cancelled: purchaseOrders.filter((p) => p.status === "cancelled").length,
    }),
    [purchaseOrders],
  )

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return purchaseOrders.filter((p) => {
      if (status !== "all" && p.status !== status) return false
      if (supplierId !== "all" && p.supplierId !== supplierId) return false
      if (godownId !== "all" && p.godownId !== godownId) return false
      if (!needle) return true
      const sup = supplierById.get(p.supplierId)?.name.toLowerCase() ?? ""
      if (p.number.toLowerCase().includes(needle) || sup.includes(needle)) return true
      return p.lines.some((l) => {
        const it = itemById.get(l.itemId)
        return it ? it.name.toLowerCase().includes(needle) || it.sku.toLowerCase().includes(needle) : false
      })
    })
  }, [purchaseOrders, status, supplierId, godownId, q, supplierById, itemById])

  const visible = filtered.slice(0, limit)
  const filtersActive = status !== "all" || supplierId !== "all" || godownId !== "all" || q !== ""

  const receive = (po: PurchaseOrder) => {
    const res = receivePurchase(po.id)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success(`Received ${po.number}`, {
      description: receiptSummary(po, items, godowns),
      action: { label: "View", onClick: () => openPanel({ type: "purchase", id: po.id }) },
    })
  }

  const nextSupplier = stats.next ? supplierById.get(stats.next.supplierId)?.name : undefined
  const nextHint = stats.next ? expectedHint(stats.next) : null

  return (
    <Page>
      <PageHeader
        title="Purchases"
        description="Orders to suppliers. Receiving an order adds its stock to the godown"
        actions={
          <Button onClick={() => openComposer({ type: "purchase" })} className="gap-1.5 pr-3 pl-2.5">
            <PlusIcon className="size-4" strokeWidth={1.75} />
            New purchase order
          </Button>
        }
      />

      <Stagger className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StaggerItem>
          <StatCard
            label="Pending"
            value={stats.pending}
            suffix={stats.pending === 1 ? "order" : "orders"}
            footnote={`${inr(stats.pendingValue)} on order`}
            onClick={() => setStatus("ordered")}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label="Late"
            value={stats.late}
            suffix={stats.late === 1 ? "order" : "orders"}
            delta={stats.late > 0 ? { text: "Past expected date", tone: "negative" } : undefined}
            footnote={stats.late === 0 ? "All on schedule" : undefined}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label="Received, last 30 days"
            value={stats.received30}
            kind="inr"
            footnote={plural(stats.received30Count, "order")}
          />
        </StaggerItem>
        <StaggerItem>
          <div className="flex min-h-[132px] flex-col justify-between gap-6 rounded-xl border border-border bg-card p-5">
            <div className="text-sm text-fg-secondary">Next arrival</div>
            {stats.next ? (
              <button
                type="button"
                onClick={() => openPanel({ type: "purchase", id: stats.next!.id })}
                className="flex flex-col gap-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-[30px] leading-none font-medium tracking-[-0.02em] text-foreground tabular">
                    {dateShort(stats.next.expectedDate)}
                  </span>
                  {nextHint ? <span className={cn("text-sm", HINT_CLASS[nextHint.tone])}>{nextHint.text}</span> : null}
                </div>
                <span className="truncate text-xs text-muted-foreground">
                  {stats.next.number} · {nextSupplier}
                </span>
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <span className="text-[30px] leading-none font-medium text-muted-foreground">None due</span>
                <span className="text-xs text-muted-foreground">No open orders ahead</span>
              </div>
            )}
          </div>
        </StaggerItem>
      </Stagger>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <Segmented<StatusFilter>
          value={status}
          onValueChange={(v) => {
            setStatus(v)
            setLimit(PAGE)
          }}
          items={[
            { value: "all", label: "All", count: counts.all },
            { value: "ordered", label: "Pending", count: counts.ordered },
            { value: "received", label: "Received", count: counts.received },
            { value: "cancelled", label: "Cancelled", count: counts.cancelled },
          ]}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <Select value={supplierId} onValueChange={(v) => { setSupplierId(v); setLimit(PAGE) }}>
            <SelectTrigger className="w-full sm:w-52" aria-label="Supplier">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="end">
              <SelectItem value="all">All suppliers</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={godownId} onValueChange={(v) => { setGodownId(v); setLimit(PAGE) }}>
            <SelectTrigger className="w-full sm:w-40" aria-label="Godown">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="end">
              <SelectItem value="all">All godowns</SelectItem>
              {godowns.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <SearchInput value={q} onChange={(v) => { setQ(v); setLimit(PAGE) }} />
        </div>
      </div>

      <Panel flush>
        {filtered.length === 0 ? (
          <EmptyState
            icon={TruckIcon}
            title={filtersActive ? "No purchase orders match" : "No purchase orders yet"}
            description={filtersActive ? "Try another status, supplier or search" : "Raise one to bring stock into a godown"}
            action={
              filtersActive ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setStatus("all")
                    setSupplierId("all")
                    setGodownId("all")
                    setQ("")
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button onClick={() => openComposer({ type: "purchase" })}>New purchase order</Button>
              )
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-5">PO</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="hidden md:table-cell">Godown</TableHead>
                  <TableHead className="hidden lg:table-cell">Ordered</TableHead>
                  <TableHead>Expected</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Units</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden w-24 pr-5 sm:table-cell">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((po) => {
                  const sup = supplierById.get(po.supplierId)
                  const hint = expectedHint(po)
                  const open = () => openPanel({ type: "purchase", id: po.id })
                  return (
                    <TableRow
                      key={po.id}
                      tabIndex={0}
                      onClick={open}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") open()
                      }}
                      className="h-14 cursor-pointer outline-none focus-visible:bg-raised"
                    >
                      <TableCell className="pl-5">
                        <Mono className="text-fg-secondary">{po.number}</Mono>
                      </TableCell>
                      <TableCell className="max-w-[220px]">
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-foreground">{sup?.name}</span>
                          <span className="truncate text-xs text-muted-foreground">{sup?.city}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-fg-secondary md:table-cell">{godownById.get(po.godownId)?.name}</TableCell>
                      <TableCell className="hidden text-fg-secondary tabular lg:table-cell">{dateShort(po.date)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-fg-secondary tabular">{dateShort(po.expectedDate)}</span>
                          {hint ? <span className={cn("text-xs", HINT_CLASS[hint.tone])}>{hint.text}</span> : null}
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-right font-mono text-fg-secondary tabular md:table-cell">
                        {num(unitsOf(po.lines))}
                      </TableCell>
                      <TableCell className="text-right font-mono text-foreground tabular">{inr(orderTotals(po.lines).subtotal)}</TableCell>
                      <TableCell>
                        <AnimatePresence mode="popLayout" initial={false}>
                          <motion.span
                            key={poBadge(po)}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.25, ease: EASE }}
                            className="inline-flex"
                          >
                            <StatusBadge status={poBadge(po)} />
                          </motion.span>
                        </AnimatePresence>
                      </TableCell>
                      <TableCell className="hidden pr-5 text-right sm:table-cell">
                        <AnimatePresence initial={false}>
                          {po.status === "ordered" ? (
                            <motion.span
                              key="receive"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.18, ease: EASE }}
                              className="inline-flex"
                            >
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  receive(po)
                                }}
                                onKeyDown={(e) => e.stopPropagation()}
                              >
                                Receive
                              </Button>
                            </motion.span>
                          ) : null}
                        </AnimatePresence>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
              <span className="tabular">
                {num(visible.length)} of {num(filtered.length)}
              </span>
              {filtered.length > limit ? (
                <Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + PAGE)} className="text-fg-secondary">
                  Show {Math.min(PAGE, filtered.length - limit)} more
                </Button>
              ) : null}
            </div>
          </>
        )}
      </Panel>
    </Page>
  )
}
