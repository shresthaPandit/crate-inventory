"use client"

import { AnimatePresence, motion } from "motion/react"
import { useMemo } from "react"
import { TriangleAlertIcon } from "lucide-react"
import { BinLabel, EmptyState, Field, Mono } from "@/components/kit/misc"
import { EASE } from "@/components/kit/page"
import { StatusBadge } from "@/components/kit/status-badge"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { orderTotals, shortages } from "@/lib/calc"
import { date, dateTime, inr, num } from "@/lib/format"
import { useInventory, useUI } from "@/lib/store"
import type { SalesOrder } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useSaleActions } from "./use-sale-actions"

export function SaleSheet({ id, open, onOpenChange }: { id: string | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const order = useInventory((s) => (id ? s.salesOrders.find((o) => o.id === id) : undefined))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[560px]">
        {order ? (
          <SaleDetail order={order} onClose={() => onOpenChange(false)} />
        ) : (
          <>
            <SheetTitle className="sr-only">Sales order</SheetTitle>
            <SheetDescription className="sr-only">This order could not be found</SheetDescription>
            <EmptyState title="Order not found" description="It may have been removed when the sample data was reset" className="my-auto" />
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function SaleDetail({ order, onClose }: { order: SalesOrder; onClose: () => void }) {
  const customers = useInventory((s) => s.customers)
  const godowns = useInventory((s) => s.godowns)
  const items = useInventory((s) => s.items)
  const stock = useInventory((s) => s.stock)
  const openPanel = useUI((s) => s.openPanel)
  const openComposer = useUI((s) => s.openComposer)
  const actions = useSaleActions()

  const customer = customers.find((c) => c.id === order.customerId)
  const godown = godowns.find((g) => g.id === order.godownId)
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const totals = orderTotals(order.lines)

  const isOpen = order.status === "draft" || order.status === "confirmed"
  const short = useMemo(
    () => (isOpen ? shortages(stock, order.godownId, order.lines) : []),
    [isOpen, stock, order.godownId, order.lines],
  )
  const canPay = order.status === "shipped" && order.payment !== "paid"

  const raisePO = () => {
    const first = itemById.get(short[0].itemId)
    if (!first) return
    const lines = short
      .filter((s) => itemById.get(s.itemId)?.supplierId === first.supplierId)
      .map((s) => {
        const it = itemById.get(s.itemId)!
        return { itemId: s.itemId, qty: Math.ceil((s.need - s.have) / 10) * 10, rate: it.cost }
      })
    openComposer({ type: "purchase", defaults: { supplierId: first.supplierId, godownId: order.godownId, lines } })
  }

  const steps: { label: string; at?: string; done: boolean; tone?: "negative" }[] =
    order.status === "cancelled"
      ? [
          { label: "Created", at: order.date, done: true },
          { label: "Cancelled", done: true, tone: "negative" },
        ]
      : [
          { label: "Created", at: order.date, done: true },
          { label: "Confirmed", done: order.status === "confirmed" || order.status === "shipped" },
          { label: "Shipped", at: order.shippedAt, done: order.status === "shipped" },
          { label: "Paid", at: order.paidAt, done: order.payment === "paid" },
        ]

  return (
    <>
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-border px-6 pt-5 pb-4">
        <div className="flex items-center gap-2 pr-8">
          <Mono className="text-fg-secondary">{order.number}</Mono>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={order.status}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="inline-flex"
            >
              <StatusBadge status={order.status} />
            </motion.span>
          </AnimatePresence>
          {order.status !== "cancelled" ? (
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={order.payment}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25, ease: EASE }}
                className="inline-flex"
              >
                <StatusBadge status={order.payment} />
              </motion.span>
            </AnimatePresence>
          ) : null}
        </div>
        <div className="flex flex-col gap-1">
          <SheetTitle className="text-xl leading-tight font-medium">{customer?.name ?? "Unknown customer"}</SheetTitle>
          <SheetDescription className="tabular">
            {num(totals.units)} units · {inr(totals.total)} incl GST
          </SheetDescription>
        </div>
      </div>

      {/* Body */}
      <div className="scroll-quiet flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
        <AnimatePresence initial={false}>
          {short.length ? (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning/5 p-4"
            >
              <div className="flex items-start gap-2.5">
                <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-warning" strokeWidth={1.5} />
                <div className="flex flex-col gap-1">
                  <p className="text-sm text-foreground">Not enough stock at {godown?.name ?? "this godown"} to ship</p>
                  <ul className="flex flex-col gap-0.5">
                    {short.map((s) => (
                      <li key={s.itemId} className="text-sm text-fg-secondary tabular">
                        {itemById.get(s.itemId)?.name ?? "Item"}: need {num(s.need)}, {num(s.have)} at {godown?.name}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <Button variant="secondary" size="sm" className="w-fit" onClick={raisePO}>
                Raise purchase order
              </Button>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Customer */}
        <section className="flex flex-col gap-3 rounded-xl border border-border p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-sm text-foreground">{customer?.name}</span>
              <span className="text-xs text-muted-foreground">{customer?.city}</span>
            </div>
            <Mono>{customer?.gstin}</Mono>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact">{customer?.contact ?? "—"}</Field>
            <Field label="Phone">
              <span className="font-mono text-sm tabular">{customer?.phone ?? "—"}</span>
            </Field>
          </div>
        </section>

        {/* Facts */}
        <section className="grid grid-cols-2 gap-x-4 gap-y-4">
          <Field label="Order date">{dateTime(order.date)}</Field>
          <Field label="Due date">{date(order.dueDate)}</Field>
          <Field label="Ships from">
            {godown?.name} <span className="font-mono text-xs text-muted-foreground">{godown?.code}</span>
          </Field>
          {order.status === "shipped" ? (
            <Field label={order.paidAt ? "Paid" : "Shipped"}>{dateTime((order.paidAt ?? order.shippedAt)!)}</Field>
          ) : (
            <Field label="Shipped">
              <span className="text-muted-foreground">{order.status === "cancelled" ? "Never" : "Not yet"}</span>
            </Field>
          )}
        </section>

        {/* Lines */}
        <section className="flex flex-col gap-2">
          <h3 className="text-xs text-muted-foreground">Items</h3>
          <div className="flex flex-col rounded-xl border border-border">
            {order.lines.map((l, i) => {
              const it = itemById.get(l.itemId)
              return (
                <div key={`${l.itemId}-${i}`} className={cn("flex items-center gap-3 px-4 py-3", i > 0 && "border-t border-border")}>
                  {it ? <BinLabel category={it.category} /> : null}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <button
                      type="button"
                      onClick={() => openPanel({ type: "item", id: l.itemId })}
                      className="truncate text-left text-sm text-foreground underline-offset-4 transition-colors hover:underline focus-visible:underline focus-visible:outline-none"
                    >
                      {it?.name ?? "Unknown item"}
                    </button>
                    <span className="font-mono text-xs text-muted-foreground tabular">
                      {num(l.qty)} {it?.unit} × {inr(l.rate)}
                    </span>
                  </div>
                  <span className="font-mono text-sm text-foreground tabular">{inr(l.qty * l.rate)}</span>
                </div>
              )
            })}
          </div>
          <div className="flex flex-col gap-1.5 px-4 pt-2">
            <div className="flex justify-between text-sm text-fg-secondary">
              <span>Subtotal</span>
              <span className="font-mono tabular">{inr(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-fg-secondary">
              <span>GST 18%</span>
              <span className="font-mono tabular">{inr(totals.tax)}</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between border-t border-border pt-2.5">
              <span className="text-sm text-foreground">Total</span>
              <span className="font-mono text-lg font-medium text-foreground tabular">{inr(totals.total)}</span>
            </div>
          </div>
        </section>

        {/* Timeline */}
        <section className="flex flex-col gap-2">
          <h3 className="text-xs text-muted-foreground">Progress</h3>
          <ol className="flex flex-col">
            {steps.map((s, i) => (
              <li key={s.label} className="relative flex gap-3 pb-4 last:pb-0">
                {i < steps.length - 1 ? (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute top-3.5 left-[3.5px] h-[calc(100%-6px)] w-px transition-colors duration-300",
                      steps[i + 1].done ? "bg-fg-secondary/50" : "bg-border",
                    )}
                  />
                ) : null}
                <span
                  aria-hidden
                  className={cn(
                    "relative mt-1.5 size-2 shrink-0 rounded-full transition-colors duration-300",
                    s.tone === "negative" ? "bg-negative" : s.done ? "bg-foreground" : "border border-muted-foreground/50 bg-transparent",
                  )}
                />
                <div className="flex flex-1 items-baseline justify-between gap-3">
                  <span className={cn("text-sm", s.done ? "text-foreground" : "text-muted-foreground")}>{s.label}</span>
                  <span className="font-mono text-xs text-muted-foreground tabular">{s.at ? dateTime(s.at) : s.done ? "" : "Pending"}</span>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {order.note ? (
          <section className="flex flex-col gap-2">
            <h3 className="text-xs text-muted-foreground">Note</h3>
            <p className="rounded-xl border border-border bg-raised/40 px-4 py-3 text-sm text-fg-secondary">{order.note}</p>
          </section>
        ) : null}
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-6 py-4">
        {isOpen ? (
          <>
            <Button variant="ghost" className="mr-auto text-fg-secondary" onClick={() => actions.cancel(order.id)}>
              Cancel order
            </Button>
            {order.status === "draft" ? (
              <Button variant="secondary" onClick={() => actions.confirm(order.id)}>
                Confirm
              </Button>
            ) : null}
            {short.length ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0} className="inline-flex rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                    <Button disabled>Ship order</Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">Not enough stock at {godown?.name}</TooltipContent>
              </Tooltip>
            ) : (
              <Button onClick={() => actions.ship(order.id)}>Ship order</Button>
            )}
          </>
        ) : canPay ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button onClick={() => actions.markPaid(order.id)}>Mark paid</Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        )}
      </div>
    </>
  )
}
