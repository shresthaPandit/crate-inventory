"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog, type ConfirmChange } from "@/components/kit/confirm"
import { useInventory, useUI } from "@/lib/store"
import type { Item, PurchaseOrder } from "@/lib/types"
import { ACTION } from "@/lib/words"
import { itemsText, linesQtyText, signedQtyText } from "./lib"

type Ask = { kind: "receive" | "cancel"; id: string; open: boolean }

/** Show at most this many item lines in the confirm box, then one "and N more" line. */
const MAX_LINES = 5

/**
 * "Goods received" and "Cancel order", each behind a confirm box that lists
 * exactly what will change. Used by the purchases list and the order drawer
 * so both ask the same question and show the same message afterwards.
 *
 *   const actions = usePurchaseActions()
 *   <Button onClick={() => actions.askReceive(po)}>Goods received</Button>
 *   {actions.dialog}
 */
export function usePurchaseActions({ showViewLink = true }: { showViewLink?: boolean } = {}) {
  const purchaseOrders = useInventory((s) => s.purchaseOrders)
  const suppliers = useInventory((s) => s.suppliers)
  const godowns = useInventory((s) => s.godowns)
  const items = useInventory((s) => s.items)
  const receivePurchase = useInventory((s) => s.receivePurchase)
  const cancelPurchase = useInventory((s) => s.cancelPurchase)
  const openPanel = useUI((s) => s.openPanel)

  // Keep the last order after closing so the box keeps its text while it fades out
  const [ask, setAsk] = useState<Ask | null>(null)

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const po = ask ? purchaseOrders.find((p) => p.id === ask.id) : undefined
  const supplierName = po ? (suppliers.find((s) => s.id === po.supplierId)?.name ?? "the supplier") : ""
  const godownName = po ? (godowns.find((g) => g.id === po.godownId)?.name ?? "the godown") : ""

  const askReceive = (order: PurchaseOrder) => setAsk({ kind: "receive", id: order.id, open: true })
  const askCancel = (order: PurchaseOrder) => setAsk({ kind: "cancel", id: order.id, open: true })

  const view = (order: PurchaseOrder) =>
    showViewLink ? { action: { label: ACTION.view, onClick: () => openPanel({ type: "purchase", id: order.id }) } } : {}

  const confirmReceive = () => {
    if (!po) return
    const res = receivePurchase(po.id)
    if (!res.ok) {
      toast.error("Could not mark the goods as received", { description: res.error })
      return
    }
    toast.success("Goods received", {
      description: `Stock went up by ${linesQtyText(po.lines, itemById)} in ${godownName} godown.`,
      ...view(po),
    })
  }

  const confirmCancel = () => {
    if (!po) return
    const res = cancelPurchase(po.id)
    if (!res.ok) {
      toast.error("Could not cancel the order", { description: res.error })
      return
    }
    toast("Order cancelled", {
      description: `Your order ${po.number} to ${supplierName} is cancelled. Stock did not change.`,
      ...view(po),
    })
  }

  let dialog: React.ReactNode = null
  if (ask && po) {
    if (ask.kind === "receive") {
      dialog = (
        <ConfirmDialog
          open={ask.open}
          onOpenChange={(open) => setAsk({ ...ask, open })}
          title={`Goods received from ${supplierName}?`}
          description={`Press this only when the goods have reached ${godownName} godown and you have counted them. The stock will go up by ${linesQtyText(po.lines, itemById)}.`}
          changes={receiveChanges(po, itemById, godownName)}
          confirmLabel="Yes, goods received"
          cancelLabel="Not yet"
          onConfirm={confirmReceive}
        />
      )
    } else {
      dialog = (
        <ConfirmDialog
          open={ask.open}
          onOpenChange={(open) => setAsk({ ...ask, open })}
          title={`Cancel your order to ${supplierName}?`}
          description={`Order ${po.number} will be marked cancelled. Nothing will be added to stock. Tell the supplier too, so they do not send the goods.`}
          changes={[
            {
              label: `Goods on the way to ${godownName}`,
              value: `−${linesQtyText(po.lines, itemById)}`,
              direction: "down",
            },
            { label: `Stock in ${godownName}`, value: "No change", direction: "none" },
          ]}
          confirmLabel="Yes, cancel order"
          cancelLabel="No, keep order"
          onConfirm={confirmCancel}
          destructive
        />
      )
    }
  }

  return { askReceive, askCancel, dialog }
}

function receiveChanges(po: PurchaseOrder, itemById: Map<string, Item>, godownName: string): ConfirmChange[] {
  const lines = po.lines.length > MAX_LINES ? po.lines.slice(0, MAX_LINES - 1) : po.lines
  const rest = po.lines.slice(lines.length)
  const rows: ConfirmChange[] = lines.map((l) => {
    const item = itemById.get(l.itemId)
    return {
      label: `${item?.name ?? "Item"} — into ${godownName}`,
      value: signedQtyText(l.qty, item?.unit),
      direction: "up",
    }
  })
  if (rest.length) {
    rows.push({
      label: `${itemsText(rest.length)} more — into ${godownName}`,
      value: `+${linesQtyText(rest, itemById)}`,
      direction: "up",
    })
  }
  return rows
}
