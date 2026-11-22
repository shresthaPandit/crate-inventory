"use client"

import { endOfDay } from "date-fns"
import { useMemo, useState } from "react"
import { FactoryIcon, PhoneIcon, PlusIcon } from "lucide-react"
import { BinLabel, EmptyState, Field, Mono, SearchInput } from "@/components/kit/misc"
import { Page, PageHeader } from "@/components/kit/page"
import { Panel } from "@/components/kit/panel"
import { StatusBadge } from "@/components/kit/status-badge"
import { StockMeter } from "@/components/kit/stock-meter"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { onHand, orderTotals } from "@/lib/calc"
import { dateShort, inr, num } from "@/lib/format"
import { useInventory, useUI } from "@/lib/store"
import type { PurchaseOrder, Supplier } from "@/lib/types"
import { nowMs, poBadge } from "@/components/purchases/lib"

const DAY = 86_400_000

interface SupplierRow {
  supplier: Supplier
  open: number
  purchased90: number
  onTime: number | null
  received: number
  orders: PurchaseOrder[]
}

export function SuppliersView() {
  const suppliers = useInventory((s) => s.suppliers)
  const purchaseOrders = useInventory((s) => s.purchaseOrders)
  const [q, setQ] = useState("")
  const [selected, setSelected] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const rows = useMemo<SupplierRow[]>(() => {
    const since = nowMs() - 90 * DAY
    return suppliers.map((supplier) => {
      const orders = purchaseOrders.filter((p) => p.supplierId === supplier.id)
      const received = orders.filter((p) => p.status === "received" && p.receivedAt)
      const onTimeCount = received.filter((p) => new Date(p.receivedAt!).getTime() <= endOfDay(new Date(p.expectedDate)).getTime()).length
      return {
        supplier,
        orders,
        open: orders.filter((p) => p.status === "ordered").length,
        purchased90: received
          .filter((p) => new Date(p.receivedAt!).getTime() >= since)
          .reduce((s, p) => s + orderTotals(p.lines).subtotal, 0),
        onTime: received.length ? Math.round((onTimeCount / received.length) * 100) : null,
        received: received.length,
      }
    })
  }, [suppliers, purchaseOrders])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter(({ supplier: s }) =>
      [s.name, s.city, s.category, s.contact].some((v) => v.toLowerCase().includes(needle)),
    )
  }, [rows, q])

  const openSupplier = (id: string) => {
    setSelected(id)
    setSheetOpen(true)
  }

  const current = rows.find((r) => r.supplier.id === selected)

  return (
    <Page>
      <PageHeader
        title="Suppliers"
        description="Six manufacturers supplying the three godowns"
        actions={<SearchInput value={q} onChange={setQ} />}
      />

      <Panel flush>
        {filtered.length === 0 ? (
          <EmptyState
            icon={FactoryIcon}
            title="No suppliers match"
            description="Search by name, city, category or contact"
            action={
              <Button variant="outline" onClick={() => setQ("")}>
                Clear search
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Supplier</TableHead>
                <TableHead className="hidden md:table-cell">Category</TableHead>
                <TableHead className="hidden lg:table-cell">Contact</TableHead>
                <TableHead className="text-right">Lead time</TableHead>
                <TableHead className="text-right">Open POs</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Purchased, last 90 days</TableHead>
                <TableHead className="hidden pr-5 lg:table-cell">On time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const s = r.supplier
                const open = () => openSupplier(s.id)
                return (
                  <TableRow
                    key={s.id}
                    tabIndex={0}
                    onClick={open}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") open()
                    }}
                    className="h-14 cursor-pointer outline-none focus-visible:bg-raised"
                  >
                    <TableCell className="max-w-[240px] pl-5">
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-foreground">{s.name}</span>
                        <span className="truncate text-xs text-muted-foreground">{s.city}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-fg-secondary md:table-cell">{s.category}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex flex-col">
                        <span className="text-fg-secondary">{s.contact}</span>
                        <span className="font-mono text-xs text-muted-foreground">{s.phone}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-fg-secondary tabular">{s.leadTimeDays} days</TableCell>
                    <TableCell className="text-right font-mono tabular">
                      {r.open ? <span className="text-foreground">{r.open}</span> : <span className="text-muted-foreground">0</span>}
                    </TableCell>
                    <TableCell className="hidden text-right font-mono text-foreground tabular sm:table-cell">{inr(r.purchased90)}</TableCell>
                    <TableCell className="hidden pr-5 lg:table-cell">
                      <OnTime value={r.onTime} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Panel>

      <SupplierSheet row={current} open={sheetOpen} onOpenChange={setSheetOpen} />
    </Page>
  )
}

function OnTime({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-muted-foreground">No receipts yet</span>
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-9 text-right font-mono text-sm text-fg-secondary tabular">{value}%</span>
      <span className="relative h-1 w-20 overflow-hidden rounded-full bg-foreground/10">
        <span
          className={value >= 85 ? "absolute inset-y-0 left-0 rounded-full bg-fg-secondary" : "absolute inset-y-0 left-0 rounded-full bg-warning"}
          style={{ width: `${value}%` }}
        />
      </span>
    </div>
  )
}

function SupplierSheet({
  row,
  open,
  onOpenChange,
}: {
  row: SupplierRow | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const items = useInventory((s) => s.items)
  const stock = useInventory((s) => s.stock)
  const openPanel = useUI((s) => s.openPanel)
  const openComposer = useUI((s) => s.openComposer)

  const supplied = useMemo(
    () => (row ? items.filter((i) => i.supplierId === row.supplier.id) : []),
    [items, row],
  )

  if (!row) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[560px]">
          <div className="border-b border-border px-6 pt-5 pb-4">
            <SheetTitle>Supplier not found</SheetTitle>
            <SheetDescription>Pick a supplier from the list</SheetDescription>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  const s = row.supplier
  const recent = row.orders.slice(0, 6)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[560px]">
        <div className="flex flex-col gap-1 border-b border-border px-6 pt-5 pb-4 pr-12">
          <SheetTitle className="text-lg">{s.name}</SheetTitle>
          <SheetDescription>
            {s.category} · {s.city}
          </SheetDescription>
        </div>

        <div className="scroll-quiet flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <Field label="Contact">{s.contact}</Field>
            <Field label="Phone">
              <a
                href={`tel:${s.phone.replace(/\s/g, "")}`}
                className="inline-flex items-center gap-1.5 font-mono text-sm text-fg-secondary transition-colors hover:text-foreground"
              >
                <PhoneIcon className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                {s.phone}
              </a>
            </Field>
            <Field label="Lead time">{s.leadTimeDays} days</Field>
            <Field label="On time">
              {row.onTime === null ? (
                <span className="text-muted-foreground">No receipts yet</span>
              ) : (
                <span className="tabular">
                  <span className="font-mono">{row.onTime}%</span>
                  <span className="text-muted-foreground"> of {num(row.received)} deliveries</span>
                </span>
              )}
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1 rounded-xl border border-border px-4 py-3">
              <span className="text-xs text-muted-foreground">Open orders</span>
              <span className="font-mono text-xl text-foreground tabular">{row.open}</span>
            </div>
            <div className="flex flex-col gap-1 rounded-xl border border-border px-4 py-3">
              <span className="text-xs text-muted-foreground">Purchased, last 90 days</span>
              <span className="font-mono text-xl text-foreground tabular">{inr(row.purchased90)}</span>
            </div>
          </div>

          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Items supplied</h3>
              <span className="text-xs text-muted-foreground">On hand, all godowns</span>
            </div>
            <div className="overflow-hidden rounded-xl border border-border">
              {supplied.map((it) => {
                const qty = onHand(stock, it.id)
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => {
                      onOpenChange(false)
                      openPanel({ type: "item", id: it.id })
                    }}
                    className="flex w-full items-center gap-3 border-b border-border px-4 py-2.5 text-left transition-colors outline-none last:border-b-0 hover:bg-raised/60 focus-visible:bg-raised"
                  >
                    <BinLabel category={it.category} size="sm" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm text-foreground">{it.name}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">{it.sku}</span>
                    </span>
                    <span className="font-mono text-xs text-fg-secondary tabular">
                      {num(qty)} <span className="text-muted-foreground">/ {num(it.minLevel)}</span>
                    </span>
                    <StockMeter qty={qty} min={it.minLevel} size="sm" />
                  </button>
                )
              })}
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Recent purchase orders</h3>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders yet</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border">
                {recent.map((po) => (
                  <button
                    key={po.id}
                    type="button"
                    onClick={() => {
                      onOpenChange(false)
                      openPanel({ type: "purchase", id: po.id })
                    }}
                    className="grid w-full grid-cols-[72px_minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-border px-4 py-2.5 text-left transition-colors outline-none last:border-b-0 hover:bg-raised/60 focus-visible:bg-raised"
                  >
                    <Mono className="text-fg-secondary">{po.number}</Mono>
                    <span className="truncate text-sm text-fg-secondary tabular">{dateShort(po.date)}</span>
                    <span className="font-mono text-sm text-foreground tabular">{inr(orderTotals(po.lines).subtotal)}</span>
                    <StatusBadge status={poBadge(po)} />
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="mr-auto text-fg-secondary">
            Close
          </Button>
          <Button
            className="gap-1.5 pr-3 pl-2.5"
            onClick={() => {
              onOpenChange(false)
              openComposer({ type: "purchase", defaults: { supplierId: s.id } })
            }}
          >
            <PlusIcon className="size-4" strokeWidth={1.75} />
            New purchase order
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
