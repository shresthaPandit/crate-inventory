"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { LineEditor, toEditorLines, toLineItems, type EditorLine } from "@/components/kit/line-editor"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { orderTotals, shortages } from "@/lib/calc"
import { inr, num } from "@/lib/format"
import { useInventory, useUI, type SaleDefaults } from "@/lib/store"
import type { Customer } from "@/lib/types"

const MUMBAI_SIDE = new Set(["Thane", "Navi Mumbai", "Vashi"])
const godownFor = (c?: Customer) => (c && MUMBAI_SIDE.has(c.city) ? "g-bhi" : "g-bho")

export function NewSaleSheet({
  open,
  onOpenChange,
  defaults,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaults?: SaleDefaults
}) {
  // New form state every time the sheet opens (adjusting state during render, not in an effect)
  const [session, setSession] = useState(0)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setSession((s) => s + 1)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[640px]">
        <SaleForm key={session} defaults={defaults} onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  )
}

function SaleForm({ defaults, onDone }: { defaults?: SaleDefaults; onDone: () => void }) {
  const customers = useInventory((s) => s.customers)
  const godowns = useInventory((s) => s.godowns)
  const stock = useInventory((s) => s.stock)
  const counters = useInventory((s) => s.counters)
  const createSale = useInventory((s) => s.createSale)
  const openPanel = useUI((s) => s.openPanel)

  const [customerId, setCustomerId] = useState(defaults?.customerId ?? "")
  const [godownId, setGodownId] = useState(
    () => defaults?.godownId ?? godownFor(customers.find((c) => c.id === defaults?.customerId)),
  )
  const [godownTouched, setGodownTouched] = useState(Boolean(defaults?.godownId))
  const [lines, setLines] = useState<EditorLine[]>(() => {
    const seeded = toEditorLines(defaults?.lines)
    return seeded.length ? seeded : toEditorLines([{ itemId: "", qty: 1, rate: 0 }])
  })
  const [note, setNote] = useState("")

  const lineItems = useMemo(() => toLineItems(lines), [lines])
  const totals = orderTotals(lineItems)
  const short = useMemo(() => shortages(stock, godownId, lineItems), [stock, godownId, lineItems])
  const godownName = godowns.find((g) => g.id === godownId)?.name ?? "godown"
  const customer = customers.find((c) => c.id === customerId)
  const ready = Boolean(customerId) && lineItems.length > 0 && lineItems.every((l) => l.qty > 0)

  const submit = (status: "draft" | "confirmed" | "shipped") => {
    const r = createSale({ customerId, godownId, lines: lineItems, note: note.trim() || undefined, status })
    if (!r.ok) {
      toast.error(r.error)
      return
    }
    const so = r.data
    const view = { label: "View", onClick: () => openPanel({ type: "sale", id: so.id }) }
    if (status === "shipped") {
      toast.success(`Shipped ${so.number}`, { description: `−${num(totals.units)} units from ${godownName}`, action: view })
    } else if (status === "confirmed") {
      toast.success(`Confirmed ${so.number}`, { description: `${inr(totals.total)} for ${customer?.name ?? "customer"}`, action: view })
    } else {
      toast.success(`Saved ${so.number} as draft`, { description: "No stock moves until it ships", action: view })
    }
    onDone()
  }

  return (
    <>
      <div className="flex flex-col gap-1 border-b border-border px-6 pt-5 pb-4">
        <span className="font-mono text-xs text-muted-foreground tabular">SO-{counters.so}</span>
        <SheetTitle className="text-xl leading-tight font-medium">New sales order</SheetTitle>
        <SheetDescription>Ship now to take the stock out of the godown, or keep it as a draft</SheetDescription>
      </div>

      <form
        id="new-sale"
        onSubmit={(e) => {
          e.preventDefault()
          if (ready && !short.length) submit("shipped")
        }}
        className="scroll-quiet flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-5"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
          <div className="flex flex-col gap-2">
            <Label htmlFor="sale-customer" className="text-xs font-normal text-muted-foreground">
              Customer
            </Label>
            <Select
              value={customerId}
              onValueChange={(v) => {
                setCustomerId(v)
                if (!godownTouched) setGodownId(godownFor(customers.find((c) => c.id === v)))
              }}
            >
              <SelectTrigger id="sale-customer" className="h-9 w-full">
                <SelectValue placeholder="Choose customer" />
              </SelectTrigger>
              <SelectContent position="popper" className="max-h-72">
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    <span className="text-muted-foreground">{c.city}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="sale-godown" className="text-xs font-normal text-muted-foreground">
              Ship from
            </Label>
            <Select
              value={godownId}
              onValueChange={(v) => {
                setGodownId(v)
                setGodownTouched(true)
              }}
            >
              <SelectTrigger id="sale-godown" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {godowns.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                    <span className="font-mono text-xs text-muted-foreground">{g.code}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <section className="flex flex-col gap-2">
          <h3 className="text-xs text-muted-foreground">Items</h3>
          <LineEditor lines={lines} onChange={setLines} rateFrom="price" godownId={godownId} checkStock />
        </section>

        <section className="flex flex-col gap-2">
          <Label htmlFor="sale-note" className="text-xs font-normal text-muted-foreground">
            Note
          </Label>
          <Textarea id="sale-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Site, delivery window, contact on site" rows={2} />
        </section>

        <section className="ml-auto flex w-full flex-col gap-1.5 rounded-xl border border-border bg-raised/40 p-4 sm:w-72">
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
        </section>
      </form>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-6 py-4">
        <span className="mr-auto text-xs text-muted-foreground tabular">
          {short.length ? `Short on ${short.length} ${short.length === 1 ? "item" : "items"} at ${godownName}` : `${num(totals.units)} units`}
        </span>
        <Button variant="ghost" disabled={!ready} onClick={() => submit("draft")}>
          Save draft
        </Button>
        <Button variant="secondary" disabled={!ready} onClick={() => submit("confirmed")}>
          Confirm
        </Button>
        {short.length && ready ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} className="inline-flex rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                <Button disabled>Create and ship</Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">Not enough stock at {godownName}. Confirm it and ship later</TooltipContent>
          </Tooltip>
        ) : (
          <Button type="submit" form="new-sale" disabled={!ready}>
            Create and ship
          </Button>
        )}
      </div>
    </>
  )
}
