"use client"

import { addDays, format } from "date-fns"
import { useMemo, useState } from "react"
import { CalendarIcon, ListPlusIcon } from "lucide-react"
import { toast } from "sonner"
import { LineEditor, lineKey, toEditorLines, toLineItems, type EditorLine } from "@/components/kit/line-editor"
import { Mono } from "@/components/kit/misc"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { incomingQty, lowStockItems, orderTotals, suggestedReorder } from "@/lib/calc"
import { dateShort, inr, num } from "@/lib/format"
import { useInventory, useUI, type PurchaseDefaults } from "@/lib/store"
import { receiptSummary, unitsOf } from "./lib"

function noonOf(d: Date) {
  const x = new Date(d)
  x.setHours(12, 0, 0, 0)
  return x
}

export function NewPurchaseSheet({
  open,
  onOpenChange,
  defaults,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaults?: PurchaseDefaults
}) {
  // A fresh form every time the sheet opens, seeded from defaults
  const [session, setSession] = useState(0)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setSession((s) => s + 1)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[640px]">
        <PurchaseForm key={session} defaults={defaults} onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  )
}

function PurchaseForm({ defaults, onDone }: { defaults?: PurchaseDefaults; onDone: () => void }) {
  const suppliers = useInventory((s) => s.suppliers)
  const godowns = useInventory((s) => s.godowns)
  const items = useInventory((s) => s.items)
  const stock = useInventory((s) => s.stock)
  const purchaseOrders = useInventory((s) => s.purchaseOrders)
  const createPurchase = useInventory((s) => s.createPurchase)
  const openPanel = useUI((s) => s.openPanel)

  const leadFor = (id: string) => suppliers.find((s) => s.id === id)?.leadTimeDays ?? 5

  const [supplierId, setSupplierId] = useState(defaults?.supplierId ?? "")
  const [godownId, setGodownId] = useState(defaults?.godownId ?? "g-bho")
  const [expected, setExpected] = useState<Date>(() => noonOf(addDays(new Date(), leadFor(defaults?.supplierId ?? ""))))
  const [dateTouched, setDateTouched] = useState(false)
  const [calOpen, setCalOpen] = useState(false)
  const [lines, setLines] = useState<EditorLine[]>(() =>
    defaults?.lines?.length ? toEditorLines(defaults.lines) : [{ key: lineKey(), itemId: "", qty: 1, rate: 0 }],
  )
  const [note, setNote] = useState("")

  const supplier = suppliers.find((s) => s.id === supplierId)
  const godown = godowns.find((g) => g.id === godownId)
  const valid = toLineItems(lines).filter((l) => l.qty > 0)
  const totals = orderTotals(valid)

  const lowFromSupplier = useMemo(() => {
    if (!supplierId) return []
    return lowStockItems(stock, items)
      .filter(({ item }) => item.supplierId === supplierId)
      .map(({ item, qty }) => {
        const suggested = suggestedReorder(item, qty, incomingQty(purchaseOrders, item.id))
        return { item, qty: Math.ceil(suggested / 10) * 10 }
      })
      .filter((x) => x.qty > 0)
  }, [supplierId, stock, items, purchaseOrders])

  const pickSupplier = (id: string) => {
    setSupplierId(id)
    if (!dateTouched) setExpected(noonOf(addDays(new Date(), leadFor(id))))
  }

  const addLowStock = () => {
    const have = new Set(lines.map((l) => l.itemId).filter(Boolean))
    const toAdd = lowFromSupplier.filter((x) => !have.has(x.item.id))
    if (!toAdd.length) {
      toast(lowFromSupplier.length ? "Those items are already on this order" : `Nothing from ${supplier?.name ?? "this supplier"} needs reordering`, {
        description: lowFromSupplier.length ? undefined : "Every item is above its min level or already on order",
      })
      return
    }
    const kept = lines.filter((l) => l.itemId)
    setLines([...kept, ...toAdd.map((x) => ({ key: lineKey(), itemId: x.item.id, qty: x.qty, rate: x.item.cost }))])
  }

  const submit = (receiveNow: boolean) => {
    const res = createPurchase({
      supplierId,
      godownId,
      lines: valid,
      expectedDate: noonOf(expected).toISOString(),
      note: note.trim() || undefined,
      receiveNow,
    })
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    const po = res.data
    toast.success(receiveNow ? `Received ${po.number}` : `Placed ${po.number}`, {
      description: receiveNow
        ? receiptSummary(po, items, godowns)
        : `${num(unitsOf(po.lines))} units from ${supplier?.name ?? "supplier"} · due ${dateShort(po.expectedDate)}`,
      action: { label: "View", onClick: () => openPanel({ type: "purchase", id: po.id }) },
    })
    onDone()
  }

  const canSubmit = Boolean(supplierId && godownId && valid.length)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <>
      <div className="border-b border-border px-6 pt-5 pb-4 pr-12">
        <SheetTitle className="text-lg">New purchase order</SheetTitle>
        <SheetDescription>Stock is added to the godown when the order is received</SheetDescription>
      </div>

      <div className="scroll-quiet flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="po-supplier" className="text-xs font-normal text-muted-foreground">
              Supplier
            </Label>
            <Select value={supplierId} onValueChange={pickSupplier}>
              <SelectTrigger id="po-supplier" className="h-9 w-full">
                <SelectValue placeholder="Choose supplier" />
              </SelectTrigger>
              <SelectContent position="popper">
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                    <span className="text-xs text-muted-foreground in-data-[slot=select-trigger]:hidden">{s.category}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="po-godown" className="text-xs font-normal text-muted-foreground">
              Receive into
            </Label>
            <Select value={godownId} onValueChange={setGodownId}>
              <SelectTrigger id="po-godown" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {godowns.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                    <Mono className="in-data-[slot=select-trigger]:hidden">{g.code}</Mono>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-xs font-normal text-muted-foreground">Expected</Label>
            <Popover open={calOpen} onOpenChange={setCalOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex h-9 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-left text-sm transition-colors outline-none hover:border-foreground/20 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 data-[state=open]:border-ring dark:bg-input/30"
                >
                  <CalendarIcon className="size-4 text-muted-foreground" strokeWidth={1.5} />
                  <span className="flex-1 tabular">{format(expected, "EEE, d MMM yyyy")}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-1">
                <Calendar
                  mode="single"
                  selected={expected}
                  defaultMonth={expected}
                  disabled={{ before: today }}
                  onSelect={(d) => {
                    if (!d) return
                    setExpected(noonOf(d))
                    setDateTouched(true)
                    setCalOpen(false)
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex flex-col justify-end gap-1 pb-2 text-xs text-muted-foreground">
            {supplier
              ? `${supplier.name.split(" ")[0]} usually delivers in ${supplier.leadTimeDays} days`
              : "Pick a supplier to set the expected date from its lead time"}
          </div>
        </div>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium">Items</h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addLowStock}
              disabled={!supplierId}
              className="gap-1.5 text-fg-secondary"
            >
              <ListPlusIcon className="size-3.5" strokeWidth={1.5} />
              Add low stock items
              {lowFromSupplier.length ? <Mono className="ml-0.5">{lowFromSupplier.length}</Mono> : null}
            </Button>
          </div>
          <LineEditor lines={lines} onChange={setLines} rateFrom="cost" godownId={godownId} />
        </section>

        <section className="flex flex-col gap-2">
          <Label htmlFor="po-note" className="text-xs font-normal text-muted-foreground">
            Note
          </Label>
          <Textarea
            id="po-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Delivery instructions, rate agreed on call"
            className="min-h-16 resize-none"
          />
        </section>

        <section className="flex flex-col gap-2 rounded-xl border border-border bg-raised/40 px-4 py-3 text-sm">
          <div className="flex justify-between text-fg-secondary">
            <span>
              {num(totals.units)} units{godown ? ` into ${godown.name}` : ""}
            </span>
            <span className="font-mono tabular">{inr(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between text-fg-secondary">
            <span>GST 18%, input credit</span>
            <span className="font-mono tabular">{inr(totals.tax)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-border pt-2 text-foreground">
            <span>Total</span>
            <span className="font-mono font-medium tabular">{inr(totals.total)}</span>
          </div>
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-6 py-4">
        <Button variant="ghost" onClick={onDone} className="mr-auto text-fg-secondary">
          Cancel
        </Button>
        <Button variant="outline" disabled={!canSubmit} onClick={() => submit(true)}>
          Already received
        </Button>
        <Button disabled={!canSubmit} onClick={() => submit(false)}>
          Place order
        </Button>
      </div>
    </>
  )
}
