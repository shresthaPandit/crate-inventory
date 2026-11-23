"use client"

import { useCallback, useMemo, useState, type ComponentProps } from "react"
import { toast } from "sonner"
import type { ConfirmChange, ConfirmDialog } from "@/components/kit/confirm"
import { statusLabel } from "@/components/kit/status-badge"
import { orderTotals } from "@/lib/calc"
import { inr } from "@/lib/format"
import { useInventory } from "@/lib/store"
import type { Item, LineItem, SalesOrder } from "@/lib/types"
import { qtyUnit, unitsText } from "./sale-words"

/** Store actions for one sale, wrapped with toasts that say in plain words what changed. */
export function useSaleActions() {
  const shipSale = useInventory((s) => s.shipSale)
  const confirmSale = useInventory((s) => s.confirmSale)
  const markSalePaid = useInventory((s) => s.markSalePaid)
  const cancelSale = useInventory((s) => s.cancelSale)
  const godowns = useInventory((s) => s.godowns)
  const customers = useInventory((s) => s.customers)
  const items = useInventory((s) => s.items)

  return useMemo(() => {
    const godownName = (id: string) => godowns.find((g) => g.id === id)?.name ?? "the"
    const customerName = (id: string) => customers.find((c) => c.id === id)?.name ?? "the customer"
    const itemById = new Map(items.map((i) => [i.id, i]))

    return {
      ship(id: string) {
        const r = shipSale(id)
        if (!r.ok) {
          toast.error("Could not ship this order", { description: r.error })
          return false
        }
        toast.success("Order shipped", {
          description: `Stock went down by ${unitsText(r.data.lines, itemById)} in ${godownName(r.data.godownId)} godown.`,
        })
        return true
      },
      confirm(id: string) {
        const r = confirmSale(id)
        if (!r.ok) {
          toast.error("Could not confirm this order", { description: r.error })
          return false
        }
        toast.success("Order confirmed", {
          description: `${r.data.number} for ${customerName(r.data.customerId)} is ready to ship. Stock has not changed yet.`,
        })
        return true
      },
      markPaid(id: string) {
        const r = markSalePaid(id)
        if (!r.ok) {
          toast.error("Could not mark as paid", { description: r.error })
          return false
        }
        toast.success("Marked as paid", {
          description: `${inr(orderTotals(r.data.lines).total)} received from ${customerName(r.data.customerId)} for ${r.data.number}.`,
        })
        return true
      },
      cancel(id: string) {
        const r = cancelSale(id)
        if (!r.ok) {
          toast.error("Could not cancel this order", { description: r.error })
          return false
        }
        toast("Order cancelled", { description: `${r.data.number} is cancelled. Stock did not change.` })
        return true
      },
    }
  }, [shipSale, confirmSale, markSalePaid, cancelSale, godowns, customers, items])
}

/** One change row per line: "LED bulb 9W, B22 — Bhosari" / "−24 pcs". */
export function shipChanges(lines: LineItem[], itemById: Map<string, Item>, godownName: string): ConfirmChange[] {
  return lines.map((l) => {
    const it = itemById.get(l.itemId)
    return {
      label: `${it?.name ?? "Item"} — ${godownName}`,
      value: `−${qtyUnit(l.qty, it?.unit)}`,
      direction: "down" as const,
    }
  })
}

export type SaleStep = "confirm" | "ship" | "markPaid" | "cancel"

type ConfirmProps = ComponentProps<typeof ConfirmDialog>

/**
 * The confirm-before-you-change step for sales, shared by the list rows and the
 * sale drawer. Call `ask("ship", order)`, and render `<ConfirmDialog {...dialog} />`.
 * The order is kept as it was when asked, so the dialog text stays put while it closes.
 */
export function useSaleConfirm() {
  const actions = useSaleActions()
  const items = useInventory((s) => s.items)
  const godowns = useInventory((s) => s.godowns)
  const customers = useInventory((s) => s.customers)
  const [request, setRequest] = useState<{ step: SaleStep; order: SalesOrder } | null>(null)
  const [open, setOpen] = useState(false)

  const ask = useCallback((step: SaleStep, order: SalesOrder) => {
    setRequest({ step, order })
    setOpen(true)
  }, [])

  const content = useMemo(() => {
    if (!request) return null
    const { step, order } = request
    const itemById = new Map(items.map((i) => [i.id, i]))
    const godown = godowns.find((g) => g.id === order.godownId)?.name ?? "the godown"
    const customer = customers.find((c) => c.id === order.customerId)?.name ?? "the customer"
    const total = orderTotals(order.lines).total

    const byStep: Record<SaleStep, Omit<ConfirmProps, "open" | "onOpenChange" | "onConfirm">> = {
      confirm: {
        title: "Confirm this order?",
        description: `Do this when ${customer} has agreed to the order. It will be ready to ship. Nothing leaves stock until you ship it.`,
        changes: [
          { label: "Order", value: "Draft → Ready to ship", direction: "none" },
          { label: "Stock", value: "No change yet", direction: "none" },
        ],
        confirmLabel: "Yes, confirm order",
      },
      ship: {
        title: "Ship this order?",
        description: `Do this when the items have left ${godown} godown. Stock goes down by ${unitsText(order.lines, itemById)}. This cannot be undone.`,
        changes: shipChanges(order.lines, itemById, godown),
        confirmLabel: "Yes, ship order",
      },
      markPaid: {
        title: "Mark this order as paid?",
        description: `Do this when ${customer} has paid you the full amount for ${order.number}.`,
        changes: [
          { label: "Money received", value: `+${inr(total)}`, direction: "up" },
          { label: "Payment", value: `${statusLabel(order.payment)} → Paid`, direction: "none" },
        ],
        confirmLabel: "Yes, mark as paid",
      },
      cancel: {
        title: "Cancel this order?",
        description: `${order.number} for ${customer} will stay in your list as Cancelled. Nothing was shipped, so stock is not affected. You cannot undo this.`,
        changes: [
          { label: "Order", value: `${statusLabel(order.status)} → Cancelled`, direction: "none" },
          { label: "Stock", value: "No change", direction: "none" },
        ],
        confirmLabel: "Yes, cancel order",
        cancelLabel: "No, keep order",
        destructive: true,
      },
    }
    return byStep[step]
  }, [request, items, godowns, customers])

  const dialog: ConfirmProps = {
    title: "",
    confirmLabel: "",
    ...content,
    open: open && content !== null,
    onOpenChange: setOpen,
    onConfirm: () => {
      if (request) actions[request.step](request.order.id)
    },
  }

  return { ask, dialog, actions }
}
