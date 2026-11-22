"use client"

import { NewPurchaseSheet } from "@/components/purchases/new-purchase-sheet"
import { PurchaseSheet } from "@/components/purchases/purchase-sheet"
import { NewSaleSheet } from "@/components/sales/new-sale-sheet"
import { SaleSheet } from "@/components/sales/sale-sheet"
import { AdjustStockDialog } from "@/components/stock/adjust-stock-dialog"
import { ItemSheet } from "@/components/stock/item-sheet"
import { NewTransferSheet } from "@/components/transfers/new-transfer-sheet"
import { TransferSheet } from "@/components/transfers/transfer-sheet"
import { useUI, type Composer, type Panel } from "@/lib/store"

/**
 * Every drawer and composer lives here, mounted once in the shell.
 * Screens open them through useUI().openPanel / openComposer.
 * The store keeps the last id per type so a sheet keeps its content
 * while it animates closed.
 */
export function GlobalSheets() {
  const panel = useUI((s) => s.panel)
  const lastPanel = useUI((s) => s.lastPanel)
  const closePanel = useUI((s) => s.closePanel)
  const composer = useUI((s) => s.composer)
  const lastComposer = useUI((s) => s.lastComposer)
  const closeComposer = useUI((s) => s.closeComposer)

  const panelProps = (type: Panel["type"]) => ({
    id: lastPanel[type] ?? null,
    open: panel?.type === type,
    onOpenChange: (o: boolean) => {
      if (!o) closePanel()
    },
  })
  const composerProps = (type: Composer["type"]) => ({
    open: composer?.type === type,
    onOpenChange: (o: boolean) => {
      if (!o) closeComposer()
    },
  })

  return (
    <>
      <ItemSheet {...panelProps("item")} />
      <SaleSheet {...panelProps("sale")} />
      <PurchaseSheet {...panelProps("purchase")} />
      <TransferSheet {...panelProps("transfer")} />

      <NewSaleSheet {...composerProps("sale")} defaults={lastComposer.sale?.defaults} />
      <NewPurchaseSheet {...composerProps("purchase")} defaults={lastComposer.purchase?.defaults} />
      <NewTransferSheet {...composerProps("transfer")} defaults={lastComposer.transfer?.defaults} />
      <AdjustStockDialog {...composerProps("adjust")} defaults={lastComposer.adjust?.defaults} />
    </>
  )
}
