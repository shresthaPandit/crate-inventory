"use client"

import { AnimatePresence, motion } from "motion/react"
import Link from "next/link"
import { useMemo, useState } from "react"
import {
  ArrowRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  FileTextIcon,
  PackageIcon,
  TruckIcon,
  WalletIcon,
} from "lucide-react"
import { HelpTip, NextStep } from "@/components/kit/help"
import { ItemIcon } from "@/components/kit/misc"
import { EASE } from "@/components/kit/page"
import { Panel } from "@/components/kit/panel"
import { StatusBadge, TONE_PILL, type BadgeStatus, type Tone } from "@/components/kit/status-badge"
import { StockMeter } from "@/components/kit/stock-meter"
import { Button } from "@/components/ui/button"
import { incomingQty, isPurchaseOverdue, lowStockItems, orderTotals, shortages, suggestedReorder } from "@/lib/calc"
import { dateShort, inr } from "@/lib/format"
import { useInventory, useNow, useUI } from "@/lib/store"
import type { Item, PurchaseOrder } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ACTION, GLOSSARY } from "@/lib/words"
import { count, isAre, nameList, qty as qtyText } from "./plain"

/** How many "running low" rows to show before "Show more". Out-of-stock rows always show. */
const LOW_VISIBLE = 4

const MIN_LEVEL_MEANING = GLOSSARY.find((g) => g.term === "Minimum level")?.meaning

type Icon = React.ComponentType<{ className?: string; strokeWidth?: number }>

interface ItemTask {
  kind: "item"
  key: string
  item: Item
  qty: number
  incoming: number
  nextPO?: PurchaseOrder
  late: boolean
}

interface OrderTask {
  kind: "orders"
  key: string
  tone: Tone
  icon: Icon
  badge: BadgeStatus
  title: string
  text: string
  /** one order → open it; several → go to the list */
  single?: { type: "sale" | "purchase"; id: string }
  href: string
}

/**
 * Everything waiting on the person, as plain sentences with the button
 * right there. Most urgent first: red (act now), amber (soon), blue (daily work).
 */
export function AttentionPanel({ className }: { className?: string }) {
  const stock = useInventory((s) => s.stock)
  const items = useInventory((s) => s.items)
  const salesOrders = useInventory((s) => s.salesOrders)
  const purchaseOrders = useInventory((s) => s.purchaseOrders)
  const customers = useInventory((s) => s.customers)
  const suppliers = useInventory((s) => s.suppliers)
  const now = useNow(60_000)
  const [showAllLow, setShowAllLow] = useState(false)

  const { out, low, latePOs, latePay, toShip, drafts } = useMemo(() => {
    const customerName = (id: string) => customers.find((c) => c.id === id)?.name ?? "a customer"
    const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? "a supplier"

    // Items at or below their minimum level, emptiest first (same list and order as before)
    const itemTasks: ItemTask[] = lowStockItems(stock, items).map(({ item, qty }) => {
      const incoming = incomingQty(purchaseOrders, item.id)
      const nextPO = purchaseOrders
        .filter((po) => po.status === "ordered" && po.lines.some((l) => l.itemId === item.id))
        .sort((a, b) => (a.expectedDate < b.expectedDate ? -1 : 1))[0]
      return { kind: "item", key: item.id, item, qty, incoming, nextPO, late: nextPO ? isPurchaseOverdue(nextPO, now) : false }
    })

    // Supplier orders that should have arrived by now
    const late = purchaseOrders.filter((po) => isPurchaseOverdue(po, now))
    const latePOs: OrderTask | null = late.length
      ? {
          kind: "orders",
          key: "late-pos",
          tone: "negative",
          icon: TruckIcon,
          badge: "late",
          title: `${count(late.length, "supplier order")} ${isAre(late.length)} late`,
          text: `Waiting on ${nameList(late.map((po) => supplierName(po.supplierId)))}. Call them, or press “${ACTION.receivePurchase}” when the goods arrive.`,
          single: late.length === 1 ? { type: "purchase", id: late[0].id } : undefined,
          href: "/purchases?status=late",
        }
      : null

    // Customers who have not paid on time
    const unpaidLate = salesOrders.filter((so) => so.payment === "overdue" && so.status !== "cancelled")
    const owed = unpaidLate.reduce((s, so) => s + orderTotals(so.lines).total, 0)
    const latePay: OrderTask | null = unpaidLate.length
      ? {
          kind: "orders",
          key: "late-pay",
          tone: "negative",
          icon: WalletIcon,
          badge: "overdue",
          title: `${count(unpaidLate.length, "payment")} ${isAre(unpaidLate.length)} late`,
          text: `${inr(owed)} to collect from ${nameList(unpaidLate.map((so) => customerName(so.customerId)))}. The money was due before today.`,
          single: unpaidLate.length === 1 ? { type: "sale", id: unpaidLate[0].id } : undefined,
          href: "/sales?payment=overdue",
        }
      : null

    // Sales confirmed and waiting to leave the godown
    const ready = salesOrders.filter((so) => so.status === "confirmed")
    const blocked = ready.filter((so) => shortages(stock, so.godownId, so.lines).length > 0).length
    const toShip: OrderTask | null = ready.length
      ? {
          kind: "orders",
          key: "to-ship",
          tone: "info",
          icon: PackageIcon,
          badge: "confirmed",
          title: `${count(ready.length, "sale")} ${isAre(ready.length)} ready to ship`,
          text:
            `Pack the items, then press “${ACTION.shipSale}”. Stock goes down when you ship.` +
            (blocked ? ` ${count(blocked, "order")} ${blocked === 1 ? "needs" : "need"} more stock in the godown first.` : ""),
          single: ready.length === 1 ? { type: "sale", id: ready[0].id } : undefined,
          href: "/sales?status=confirmed",
        }
      : null

    // Sales saved as drafts, not yet confirmed
    const draftList = salesOrders.filter((so) => so.status === "draft")
    const drafts: OrderTask | null = draftList.length
      ? {
          kind: "orders",
          key: "drafts",
          tone: "neutral",
          icon: FileTextIcon,
          badge: "draft",
          title: `${count(draftList.length, "sale")} ${isAre(draftList.length)} still a draft`,
          text: `Press “${ACTION.confirmSale}” when the customer says yes. Then it is ready to ship.`,
          single: draftList.length === 1 ? { type: "sale", id: draftList[0].id } : undefined,
          href: "/sales?status=draft",
        }
      : null

    return {
      out: itemTasks.filter((t) => t.qty <= 0),
      low: itemTasks.filter((t) => t.qty > 0),
      latePOs,
      latePay,
      toShip,
      drafts,
    }
  }, [stock, items, salesOrders, purchaseOrders, customers, suppliers, now])

  const lowShown = showAllLow ? low : low.slice(0, LOW_VISIBLE)
  const lowHidden = low.length - lowShown.length
  const total = out.length + low.length + [latePOs, latePay, toShip, drafts].filter(Boolean).length
  const firstItemKey = (out[0] ?? low[0])?.key

  const rows: (ItemTask | OrderTask)[] = [
    ...out,
    ...(latePOs ? [latePOs] : []),
    ...(latePay ? [latePay] : []),
    ...lowShown,
  ]
  const after: OrderTask[] = [toShip, drafts].filter((t): t is OrderTask => t !== null)

  return (
    <Panel
      className={className}
      title="Needs your attention"
      description="Things to do today, most urgent first. Use the button on each line."
      action={
        total > 0 ? (
          <span className="inline-flex h-7 items-center rounded-full bg-warning-soft px-3 text-[13px] font-semibold text-warning tabular">
            {count(total, "thing")} to do
          </span>
        ) : null
      }
      flush
    >
      {total === 0 ? (
        <div className="px-5 pb-5">
          <NextStep tone="positive" title="All good — nothing needs your attention right now">
            Every item is above its minimum level and no order is waiting on you. New jobs show up here by themselves.
          </NextStep>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border border-t border-border">
          <AnimatePresence initial={false}>
            {rows.map((t) =>
              t.kind === "item" ? (
                <Row key={t.key}>
                  <ItemRow task={t} explainMin={t.key === firstItemKey} />
                </Row>
              ) : (
                <Row key={t.key}>
                  <OrderRow task={t} />
                </Row>
              ),
            )}
            {low.length > LOW_VISIBLE ? (
              <Row key="toggle-low">
                <div className="px-5 py-2">
                  <Button variant="ghost" className="w-full justify-center text-primary-ink sm:w-auto" onClick={() => setShowAllLow((v) => !v)}>
                    {showAllLow ? (
                      <>
                        <ChevronUpIcon />
                        Show fewer items
                      </>
                    ) : (
                      <>
                        <ChevronDownIcon />
                        Show {count(lowHidden, "more item")} running low
                      </>
                    )}
                  </Button>
                </div>
              </Row>
            ) : null}
            {after.map((t) => (
              <Row key={t.key}>
                <OrderRow task={t} />
              </Row>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </Panel>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.2, ease: EASE } }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      {children}
    </motion.li>
  )
}

/** "LED bulb 9W, B22 — Running low. 120 pcs left, minimum level 400 pcs." + Order more / View */
function ItemRow({ task, explainMin }: { task: ItemTask; explainMin: boolean }) {
  const { item, qty, incoming, nextPO, late } = task
  const openPanel = useUI((s) => s.openPanel)
  const openComposer = useUI((s) => s.openComposer)
  const isOut = qty <= 0
  const onTheWay = incoming > 0

  const orderMore = () =>
    openComposer({
      type: "purchase",
      defaults: {
        supplierId: item.supplierId,
        godownId: "g-bho",
        lines: [{ itemId: item.id, qty: suggestedReorder(item, qty, incoming), rate: item.cost }],
      },
    })

  return (
    <div className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
      <div className="flex min-w-0 flex-1 gap-3">
        <ItemIcon category={item.category} />
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-[15px] leading-snug font-semibold text-foreground">{item.name}</p>
            <StatusBadge status={isOut ? "out" : "low"} />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fg-secondary">
            <StockMeter qty={qty} min={item.minLevel} size="sm" />
            <span className="inline-flex flex-wrap items-center gap-x-1">
              <span className={cn(isOut && "font-medium text-negative")}>
                {isOut ? "None left in any godown" : `Only ${qtyText(qty, item.unit)} left`}
              </span>
              <span>· minimum {qtyText(item.minLevel, item.unit)}</span>
              {explainMin && MIN_LEVEL_MEANING ? (
                <HelpTip label="What is the minimum level?">
                  <span className="font-medium text-foreground">Minimum level.</span> {MIN_LEVEL_MEANING}
                </HelpTip>
              ) : null}
            </span>
          </div>
          {onTheWay ? (
            <p className={cn("text-sm", late ? "text-negative" : "text-fg-secondary")}>
              {qtyText(incoming, item.unit)} already ordered
              {nextPO ? (late ? `, but the order is late (was due ${dateShort(nextPO.expectedDate)})` : `, arriving ${dateShort(nextPO.expectedDate)}`) : ""}.
            </p>
          ) : null}
        </div>
      </div>
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:pl-[52px] lg:flex lg:pl-0">
        {onTheWay && nextPO ? (
          <Button variant="outline" onClick={() => openPanel({ type: "purchase", id: nextPO.id })}>
            <TruckIcon />
            See order
          </Button>
        ) : (
          <Button onClick={orderMore}>
            <TruckIcon />
            {ACTION.reorder}
          </Button>
        )}
        <Button variant="outline" onClick={() => openPanel({ type: "item", id: item.id })}>
          {ACTION.view}
        </Button>
      </div>
    </div>
  )
}

/** "3 sales are ready to ship" + one button that goes there. */
function OrderRow({ task }: { task: OrderTask }) {
  const openPanel = useUI((s) => s.openPanel)
  const single = task.single
  return (
    <div className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
      <div className="flex min-w-0 flex-1 gap-3">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg", TONE_PILL[task.tone])}>
          <task.icon className="size-5" strokeWidth={1.75} />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-[15px] leading-snug font-semibold text-foreground">{task.title}</p>
            <StatusBadge status={task.badge} />
          </div>
          <p className="text-sm leading-relaxed text-fg-secondary">{task.text}</p>
        </div>
      </div>
      <div className="flex shrink-0 sm:pl-[52px] lg:pl-0">
        {single ? (
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => openPanel(single)}>
            View order
            <ArrowRightIcon />
          </Button>
        ) : (
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href={task.href}>
              See orders
              <ArrowRightIcon />
            </Link>
          </Button>
        )}
      </div>
    </div>
  )
}
