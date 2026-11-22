"use client"

import { useMemo } from "react"
import { toast } from "sonner"
import { orderTotals } from "@/lib/calc"
import { inr, num } from "@/lib/format"
import { useInventory } from "@/lib/store"

/** Store actions for one sales order, wrapped with toasts that say what changed in stock. */
export function useSaleActions() {
  const shipSale = useInventory((s) => s.shipSale)
  const confirmSale = useInventory((s) => s.confirmSale)
  const markSalePaid = useInventory((s) => s.markSalePaid)
  const cancelSale = useInventory((s) => s.cancelSale)
  const godowns = useInventory((s) => s.godowns)
  const customers = useInventory((s) => s.customers)

  return useMemo(() => {
    const godownName = (id: string) => godowns.find((g) => g.id === id)?.name ?? "godown"
    const customerName = (id: string) => customers.find((c) => c.id === id)?.name ?? "customer"

    return {
      ship(id: string) {
        const r = shipSale(id)
        if (!r.ok) {
          toast.error(r.error)
          return false
        }
        const t = orderTotals(r.data.lines)
        toast.success(`Shipped ${r.data.number}`, {
          description: `−${num(t.units)} units from ${godownName(r.data.godownId)}`,
        })
        return true
      },
      confirm(id: string) {
        const r = confirmSale(id)
        if (!r.ok) {
          toast.error(r.error)
          return false
        }
        toast.success(`Confirmed ${r.data.number}`, {
          description: `${inr(orderTotals(r.data.lines).total)} for ${customerName(r.data.customerId)}`,
        })
        return true
      },
      markPaid(id: string) {
        const r = markSalePaid(id)
        if (!r.ok) {
          toast.error(r.error)
          return false
        }
        toast.success(`${r.data.number} marked paid`, {
          description: `${inr(orderTotals(r.data.lines).total)} from ${customerName(r.data.customerId)}`,
        })
        return true
      },
      cancel(id: string) {
        const r = cancelSale(id)
        if (!r.ok) {
          toast.error(r.error)
          return false
        }
        toast(`Cancelled ${r.data.number}`, { description: "No stock was moved" })
        return true
      },
    }
  }, [shipSale, confirmSale, markSalePaid, cancelSale, godowns, customers])
}
