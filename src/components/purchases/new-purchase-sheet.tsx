"use client"

import { addDays, format } from "date-fns"
import { useMemo, useState } from "react"
import { CalendarIcon, ListPlusIcon, TriangleAlertIcon } from "lucide-react"
import { toast } from "sonner"
import { ConfirmDialog, type ConfirmChange } from "@/components/kit/confirm"
import { HelpTip } from "@/components/kit/help"
import { LineEditor, lineKey, toEditorLines, toLineItems, type EditorLine } from "@/components/kit/line-editor"
import { Mono } from "@/components/kit/misc"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { incomingQty, lowStockItems, orderTotals, startOfDayMs, suggestedReorder } from "@/lib/calc"
import { inr } from "@/lib/format"
import { useInventory, useNow, useUI, type PurchaseDefaults } from "@/lib/store"
import type { Item, LineItem } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ACTION } from "@/lib/words"
import { itemsText, linesQtyText, meaningOf, signedQtyText } from "./lib"
import { Helper, Step } from "./form-parts"

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
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[680px]">
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
  const now = useNow()

  const leadFor = (id: string) => suppliers.find((s) => s.id === id)?.leadTimeDays ?? 5

  const [supplierId, setSupplierId] = useState(defaults?.supplierId ?? "")
  const [godownId, setGodownId] = useState(defaults?.godownId ?? "g-bho")
  const [expected, setExpected] = useState<Date>(() => noonOf(addDays(new Date(now), leadFor(defaults?.supplierId ?? ""))))
  const [dateTouched, setDateTouched] = useState(false)
  const [calOpen, setCalOpen] = useState(false)
  const [lines, setLines] = useState<EditorLine[]>(() =>
    defaults?.lines?.length ? toEditorLines(defaults.lines) : [{ key: lineKey(), itemId: "", qty: 1, rate: 0 }],
  )
  const [note, setNote] = useState("")
  // errors show only after the first try, so a fresh form is not covered in red
  const [tried, setTried] = useState(false)
  const [confirmReceive, setConfirmReceive] = useState(false)

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const supplier = suppliers.find((s) => s.id === supplierId)
  const godown = godowns.find((g) => g.id === godownId)
  const godownName = godown?.name ?? "the godown"
  const picked = toLineItems(lines)
  const valid = picked.filter((l) => l.qty > 0)
  const totals = orderTotals(valid)
  const qty = linesQtyText(valid, itemById)

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
  const onOrder = new Set(picked.map((l) => l.itemId))
  const lowNotAdded = lowFromSupplier.filter((x) => !onOrder.has(x.item.id))

  const errors = {
    supplier: supplierId ? null : "Choose the supplier you are buying from.",
    godown: godownId ? null : "Choose the godown where the goods should go.",
    items: !picked.length
      ? "Add at least one item. Press Add item and choose what you are buying."
      : picked.some((l) => l.qty <= 0)
        ? "Every item needs a quantity of 1 or more. Change the 0 or remove that line."
        : null,
  }
  const firstError = errors.supplier ?? errors.godown ?? errors.items

  const pickSupplier = (id: string) => {
    setSupplierId(id)
    if (!dateTouched) setExpected(noonOf(addDays(new Date(now), leadFor(id))))
  }

  const addLowStock = () => {
    if (!lowNotAdded.length) {
      toast(lowFromSupplier.length ? "Those items are already on this order" : `Nothing from ${supplier?.name ?? "this supplier"} is running low`, {
        description: lowFromSupplier.length ? undefined : "Every item is above its minimum level or already on the way.",
      })
      return
    }
    const kept = lines.filter((l) => l.itemId)
    setLines([...kept, ...lowNotAdded.map((x) => ({ key: lineKey(), itemId: x.item.id, qty: x.qty, rate: x.item.cost }))])
  }

  const check = () => {
    setTried(true)
    if (firstError) {
      toast.error("Some details are missing", { description: firstError })
      return false
    }
    return true
  }

  const create = (receiveNow: boolean) => {
    const res = createPurchase({
      supplierId,
      godownId,
      lines: valid,
      expectedDate: noonOf(expected).toISOString(),
      note: note.trim() || undefined,
      receiveNow,
    })
    if (!res.ok) {
      toast.error("Could not save the order", { description: res.error })
      return
    }
    const po = res.data
    const view = { label: ACTION.view, onClick: () => openPanel({ type: "purchase", id: po.id }) }
    if (receiveNow) {
      toast.success("Goods added to stock", {
        description: `Stock went up by ${qty} in ${godownName} godown.`,
        action: view,
      })
    } else {
      toast.success("Purchase order created", {
        description: `${po.number} to ${supplier?.name ?? "the supplier"}, expected ${format(expected, "d MMM")}. Stock goes up when you press Goods received.`,
        action: view,
      })
    }
    onDone()
  }

  const today = new Date(startOfDayMs(now))

  return (
    <>
      <div className="border-b border-border px-6 pt-5 pb-4 pr-12">
        <SheetTitle className="text-xl font-semibold">{ACTION.newPurchase}</SheetTitle>
        <SheetDescription className="text-[15px] text-fg-secondary">
          Make a list of what you are buying. Stock goes up later, when the goods arrive and you press Goods received.
        </SheetDescription>
      </div>

      <div className="scroll-quiet flex flex-1 flex-col gap-8 overflow-y-auto px-6 py-6">
        {/* 1 */}
        <Step n={1} title="Which supplier?" htmlFor="po-supplier" error={tried ? errors.supplier : null}>
          <Select value={supplierId} onValueChange={pickSupplier}>
            <SelectTrigger id="po-supplier" className="w-full" aria-invalid={(tried && !!errors.supplier) || undefined}>
              <SelectValue placeholder="Choose a supplier" />
            </SelectTrigger>
            <SelectContent position="popper">
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                  <span className="text-[13px] text-muted-foreground in-data-[slot=select-trigger]:hidden">{s.category}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Helper>
            {supplier
              ? `${supplier.contact} · ${supplier.phone} · usually delivers in ${supplier.leadTimeDays} days`
              : "The company you are buying from."}
          </Helper>
        </Step>

        {/* 2 */}
        <Step
          n={2}
          title="Deliver to which godown?"
          htmlFor="po-godown"
          help={<HelpTip label="What is a godown?">{meaningOf("Godown")}</HelpTip>}
          error={tried ? errors.godown : null}
        >
          <Select value={godownId} onValueChange={setGodownId}>
            <SelectTrigger id="po-godown" className="w-full" aria-invalid={(tried && !!errors.godown) || undefined}>
              <SelectValue placeholder="Choose a godown" />
            </SelectTrigger>
            <SelectContent position="popper">
              {godowns.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                  <Mono className="in-data-[slot=select-trigger]:hidden">{g.city}</Mono>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Helper>Stock goes up in this godown when you press Goods received.</Helper>
        </Step>

        {/* 3 */}
        <Step n={3} title="What are you ordering?" error={tried ? errors.items : null}>
          <Helper className="-mt-1">Choose each item and how many you need. The price is what you pay the supplier for one, before GST.</Helper>
          {supplier && lowNotAdded.length ? (
            <div className="flex flex-col gap-3 rounded-xl border border-warning/25 bg-warning-soft/50 p-3.5 sm:flex-row sm:items-center">
              <span className="flex min-w-0 flex-1 items-start gap-2.5 text-sm text-fg-secondary">
                <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-warning" strokeWidth={2} />
                <span>
                  {itemsText(lowNotAdded.length)} from {supplier.name} {lowNotAdded.length === 1 ? "is" : "are"} running low. Add{" "}
                  {lowNotAdded.length === 1 ? "it" : "them"} with a suggested quantity?
                </span>
              </span>
              <Button type="button" variant="outline" onClick={addLowStock} className="shrink-0">
                <ListPlusIcon strokeWidth={1.75} />
                Add low stock items
              </Button>
            </div>
          ) : null}
          <LineEditor lines={lines} onChange={setLines} rateFrom="cost" godownId={godownId} />
        </Step>

        {/* 4 */}
        <Step n={4} title="When should it arrive?">
          <Popover open={calOpen} onOpenChange={setCalOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`Expected date: ${format(expected, "EEEE, d MMMM yyyy")}. Change date`}
                className="flex h-10 w-full items-center gap-2.5 rounded-lg border border-input bg-card px-3 text-left text-[15px] shadow-xs transition-colors outline-none hover:border-foreground/25 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 data-[state=open]:border-ring sm:w-72"
              >
                <CalendarIcon className="size-[18px] text-muted-foreground" strokeWidth={1.75} />
                <span className="flex-1 tabular">{format(expected, "EEE, d MMM yyyy")}</span>
                <span className="text-sm text-primary-ink">Change</span>
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
          <Helper>
            {supplier
              ? `${supplier.name} usually takes ${supplier.leadTimeDays} days, so this date was filled in for you. Change it if they told you a different day.`
              : "Choose a supplier first. The date fills in from how long they usually take."}
          </Helper>
        </Step>

        {/* 5 */}
        <Step n={5} title="Check and save">
          <div className="flex flex-col gap-2">
            <Label htmlFor="po-note" className="text-sm font-medium text-fg-secondary">
              Note <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="po-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="For example: rate agreed on phone, deliver before noon"
              className="min-h-20 resize-none text-[15px]"
            />
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-border bg-raised/50 p-4">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Summary label="Supplier" value={supplier?.name ?? "Not chosen yet"} muted={!supplier} />
              <Summary label="Deliver to" value={godown ? `${godown.name} godown` : "Not chosen yet"} muted={!godown} />
              <Summary label="Items" value={valid.length ? `${itemsText(valid.length)} · ${qty}` : "None yet"} muted={!valid.length} />
              <Summary label="Expected" value={format(expected, "EEE, d MMM yyyy")} />
            </dl>
            <div className="flex flex-col gap-2 border-t border-border pt-3 text-[15px]">
              <div className="flex justify-between gap-4 text-fg-secondary">
                <span>Items total</span>
                <span className="tabular">{inr(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between gap-4 text-fg-secondary">
                <span className="inline-flex items-center gap-1.5">
                  GST 18%
                  <HelpTip label="What is GST?">{meaningOf("GST")}</HelpTip>
                </span>
                <span className="tabular">{inr(totals.tax)}</span>
              </div>
              <div className="flex items-baseline justify-between gap-4 border-t border-border pt-2.5 text-foreground">
                <span className="font-semibold">Total to pay</span>
                <span className="text-xl font-semibold tabular">{inr(totals.total)}</span>
              </div>
            </div>
          </div>
          <Helper>
            Stock does not change now. Crate keeps this order so you can track it. Send it to the supplier by phone or WhatsApp as
            usual. If the goods are already in the godown, press Goods already arrived instead.
          </Helper>
        </Step>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
        <Button variant="ghost" onClick={onDone} className="text-fg-secondary sm:mr-auto">
          Close
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            if (check()) setConfirmReceive(true)
          }}
        >
          Goods already arrived
        </Button>
        <Button
          onClick={() => {
            if (check()) create(false)
          }}
        >
          Create purchase order
        </Button>
      </div>

      <ConfirmDialog
        open={confirmReceive}
        onOpenChange={setConfirmReceive}
        title="Add these goods to stock now?"
        description={`Use this only if the goods from ${supplier?.name ?? "the supplier"} are already in ${godownName} godown. The order is saved as received and stock goes up by ${qty}.`}
        changes={receiveChanges(valid, itemById, godownName)}
        confirmLabel="Yes, add to stock"
        cancelLabel="Go back"
        onConfirm={() => create(true)}
      />
    </>
  )
}

const MAX_LINES = 5

function receiveChanges(lines: LineItem[], itemById: Map<string, Item>, godownName: string): ConfirmChange[] {
  const shown = lines.length > MAX_LINES ? lines.slice(0, MAX_LINES - 1) : lines
  const rest = lines.slice(shown.length)
  const rows: ConfirmChange[] = shown.map((l) => {
    const item = itemById.get(l.itemId)
    return { label: `${item?.name ?? "Item"} — into ${godownName}`, value: signedQtyText(l.qty, item?.unit), direction: "up" }
  })
  if (rest.length) {
    rows.push({ label: `${itemsText(rest.length)} more — into ${godownName}`, value: `+${linesQtyText(rest, itemById)}`, direction: "up" })
  }
  return rows
}

function Summary({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className={cn("truncate text-[15px] font-medium", muted ? "text-muted-foreground" : "text-foreground")}>{value}</dd>
    </div>
  )
}
