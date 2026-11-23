"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { CircleAlertIcon, CircleCheckIcon, FileTextIcon, TriangleAlertIcon, TruckIcon } from "lucide-react"
import { ConfirmDialog } from "@/components/kit/confirm"
import { HelpTip } from "@/components/kit/help"
import { LineEditor, toEditorLines, toLineItems, type EditorLine } from "@/components/kit/line-editor"
import { Mono } from "@/components/kit/misc"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { orderTotals, shortages } from "@/lib/calc"
import { inr } from "@/lib/format"
import { useInventory, useUI, type SaleDefaults } from "@/lib/store"
import type { Customer } from "@/lib/types"
import { ACTION_HINT, GLOSSARY } from "@/lib/words"
import { itemsText, qtyUnit, unitsText } from "./sale-words"
import { shipChanges } from "./use-sale-actions"

const MUMBAI_SIDE = new Set(["Thane", "Navi Mumbai", "Vashi"])
const godownFor = (c?: Customer) => (c && MUMBAI_SIDE.has(c.city) ? "g-bhi" : "g-bho")
const meaning = (term: string) => GLOSSARY.find((g) => g.term === term)?.meaning

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
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[660px]">
        <SaleForm key={session} defaults={defaults} onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  )
}

function SaleForm({ defaults, onDone }: { defaults?: SaleDefaults; onDone: () => void }) {
  const customers = useInventory((s) => s.customers)
  const godowns = useInventory((s) => s.godowns)
  const items = useInventory((s) => s.items)
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
  // errors show once the person tries to save, not while they are still filling in
  const [attempted, setAttempted] = useState(false)
  const [askShip, setAskShip] = useState(false)

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const lineItems = useMemo(() => toLineItems(lines), [lines])
  const totals = orderTotals(lineItems)
  const short = useMemo(() => shortages(stock, godownId, lineItems), [stock, godownId, lineItems])
  const godownName = godowns.find((g) => g.id === godownId)?.name ?? "this godown"
  const customer = customers.find((c) => c.id === customerId)
  const ready = Boolean(customerId) && lineItems.length > 0 && lineItems.every((l) => l.qty > 0)

  const customerError = !customerId ? "Pick a customer first." : null
  const zeroQty = lineItems.find((l) => !(l.qty > 0))
  const itemsError =
    lineItems.length === 0
      ? "Add at least one item. Press “Add item” and choose what they are buying."
      : zeroQty
        ? `Enter how many ${itemById.get(zeroQty.itemId)?.name ?? "items"} they want. It must be more than 0.`
        : null
  const canShip = ready && short.length === 0

  const submit = (status: "draft" | "confirmed" | "shipped") => {
    const r = createSale({ customerId, godownId, lines: lineItems, note: note.trim() || undefined, status })
    if (!r.ok) {
      toast.error("Could not create the sale", { description: r.error })
      return
    }
    const so = r.data
    const who = customer?.name ?? "the customer"
    const view = { label: "View", onClick: () => openPanel({ type: "sale", id: so.id }) }
    if (status === "shipped") {
      toast.success("Sale created and shipped", {
        description: `${so.number} for ${who}. Stock went down by ${unitsText(lineItems, itemById)} in ${godownName} godown.`,
        action: view,
      })
    } else if (status === "confirmed") {
      toast.success("Sale created", {
        description: `${so.number} for ${who} is ready to ship. Stock has not changed yet.`,
        action: view,
      })
    } else {
      toast.success("Saved as draft", {
        description: `${so.number} is saved. Nothing changes until you confirm and ship it.`,
        action: view,
      })
    }
    onDone()
  }

  const trySave = (status: "draft" | "confirmed" | "shipped") => {
    if (!ready) {
      setAttempted(true)
      return
    }
    if (status === "shipped") {
      if (short.length) {
        setAttempted(true)
        return
      }
      setAskShip(true)
      return
    }
    submit(status)
  }

  return (
    <>
      <div className="flex flex-col gap-1 border-b border-border px-6 pt-5 pb-4">
        <Mono className="pr-10">Sale number SO-{counters.so}</Mono>
        <SheetTitle className="text-xl leading-tight font-semibold">New sale</SheetTitle>
        <SheetDescription className="text-[15px] text-fg-secondary">{ACTION_HINT.newSale}</SheetDescription>
      </div>

      <form
        id="new-sale"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          trySave("shipped")
        }}
        className="scroll-quiet flex flex-1 flex-col gap-8 overflow-y-auto px-6 py-6"
      >
        {/* 1. Customer */}
        <FormSection n={1} title="Who is buying?">
          <div className="flex flex-col gap-2">
            <Label htmlFor="sale-customer" className="text-[15px] font-medium text-foreground">
              Customer
            </Label>
            <Select
              value={customerId}
              onValueChange={(v) => {
                setCustomerId(v)
                if (!godownTouched) setGodownId(godownFor(customers.find((c) => c.id === v)))
              }}
            >
              <SelectTrigger
                id="sale-customer"
                className="w-full"
                aria-invalid={attempted && customerError ? true : undefined}
                aria-describedby="sale-customer-help"
              >
                <SelectValue placeholder="Choose a customer" />
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
            <div id="sale-customer-help">
              {attempted && customerError ? (
                <FieldError>{customerError}</FieldError>
              ) : customer ? (
                <p className="text-sm text-muted-foreground tabular">
                  {customer.city} · {customer.contact} · {customer.phone}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">The shop or contractor you are selling to.</p>
              )}
            </div>
          </div>
        </FormSection>

        {/* 2. Godown */}
        <FormSection
          n={2}
          title="Which godown are the items coming from?"
          help={<HelpTip label="What is a godown?">{meaning("Godown")}</HelpTip>}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="sale-godown" className="text-[15px] font-medium text-foreground">
              Godown
            </Label>
            <Select
              value={godownId}
              onValueChange={(v) => {
                setGodownId(v)
                setGodownTouched(true)
              }}
            >
              <SelectTrigger id="sale-godown" className="w-full sm:w-80" aria-describedby="sale-godown-help">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {godowns.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                    <span className="text-muted-foreground">{g.city}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p id="sale-godown-help" className="text-sm text-muted-foreground">
              Crate picks the godown closest to the customer. Change it if the items are kept somewhere else. Stock is checked here.
            </p>
          </div>
        </FormSection>

        {/* 3. Items */}
        <FormSection n={3} title="What are they buying?">
          <p className="text-sm text-muted-foreground">
            Add each item and how many. The price is filled in for you, before GST. You can change it.
          </p>
          <LineEditor lines={lines} onChange={setLines} rateFrom="price" godownId={godownId} checkStock />
          {attempted && itemsError ? <FieldError>{itemsError}</FieldError> : null}
          {short.length ? (
            <div className="flex flex-col gap-1.5 rounded-xl border border-warning/25 bg-warning-soft/50 p-3.5">
              {short.map((s) => {
                const it = itemById.get(s.itemId)
                return (
                  <p key={s.itemId} className="flex gap-2 text-sm text-foreground tabular">
                    <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-warning" strokeWidth={2} />
                    <span>
                      Not enough stock of <span className="font-medium">{it?.name ?? "this item"}</span> in {godownName} — only{" "}
                      {qtyUnit(s.have, it?.unit)} left (you need {qtyUnit(s.need, it?.unit)}).
                    </span>
                  </p>
                )
              })}
            </div>
          ) : null}
        </FormSection>

        {/* 4. Check and save */}
        <FormSection n={4} title="Check and save">
          <div className="flex flex-col gap-2">
            <Label htmlFor="sale-note" className="text-[15px] font-medium text-foreground">
              Note <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="sale-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Site address, delivery time, person to call on site"
              rows={2}
              className="text-[15px] md:text-[15px]"
            />
          </div>

          <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-raised/40 p-4">
            <SummaryRow label="Customer">
              {customer ? customer.name : <span className="text-muted-foreground">Not chosen yet</span>}
            </SummaryRow>
            <SummaryRow label="Going out from">{godownName} godown</SummaryRow>
            <SummaryRow label="Items">
              {lineItems.length ? itemsText(lineItems, itemById) : <span className="text-muted-foreground">None yet</span>}
            </SummaryRow>
            <div className="my-1 border-t border-border" />
            <SummaryRow label="Subtotal (before GST)">{inr(totals.subtotal)}</SummaryRow>
            <SummaryRow
              label={
                <span className="inline-flex items-center gap-1">
                  GST 18%
                  <HelpTip label="What is GST?">{meaning("GST")}</HelpTip>
                </span>
              }
            >
              {inr(totals.tax)}
            </SummaryRow>
            <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-border pt-3">
              <span className="text-base font-semibold text-foreground">Total to collect</span>
              <span className="text-2xl font-semibold text-foreground tabular">{inr(totals.total)}</span>
            </div>
          </div>

          <ul className="flex flex-col gap-2 text-sm text-fg-secondary">
            <SaveHint icon={TruckIcon} title="Create and ship now">
              {canShip
                ? `The items leave today. Stock goes down by ${unitsText(lineItems, itemById)}.`
                : short.length
                  ? `Not possible today: not enough stock in ${godownName}. Create and confirm it, and ship when the stock comes in.`
                  : "The items leave today and stock goes down."}
            </SaveHint>
            <SaveHint icon={CircleCheckIcon} title="Create and confirm">
              The customer has agreed. Ship it later from the Sales page.
            </SaveHint>
            <SaveHint icon={FileTextIcon} title="Save as draft">
              Keep it for later. Nothing changes.
            </SaveHint>
          </ul>
        </FormSection>
      </form>

      <div className="flex flex-col gap-3 border-t border-border px-6 py-4">
        {attempted && (customerError || itemsError) ? (
          <FieldError>
            {customerError && itemsError ? "Pick a customer and add items above, then try again." : (customerError ?? itemsError)}
          </FieldError>
        ) : null}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
          <Button variant="ghost" onClick={() => trySave("draft")} className="text-fg-secondary">
            Save as draft
          </Button>
          <Button variant="outline" onClick={() => trySave("confirmed")}>
            Create and confirm
          </Button>
          {ready && short.length ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  tabIndex={0}
                  className="order-first col-span-2 inline-flex rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:order-none"
                >
                  <Button disabled className="w-full">
                    <TruckIcon strokeWidth={1.75} />
                    Create and ship now
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">Not enough stock in {godownName}. Create and confirm it, and ship later.</TooltipContent>
            </Tooltip>
          ) : (
            <Button type="submit" form="new-sale" className="order-first col-span-2 sm:order-none">
              <TruckIcon strokeWidth={1.75} />
              Create and ship now
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={askShip}
        onOpenChange={setAskShip}
        title="Create and ship this sale?"
        description={`Do this when the items are leaving ${godownName} godown now. Stock goes down by ${unitsText(lineItems, itemById)}. ${customer?.name ?? "The customer"} will owe ${inr(totals.total)}.`}
        changes={shipChanges(lineItems, itemById, godownName)}
        confirmLabel="Yes, create and ship"
        onConfirm={() => submit("shipped")}
      />
    </>
  )
}

function FormSection({
  n,
  title,
  help,
  children,
}: {
  n: number
  title: string
  help?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {n}
        </span>
        <h3 className="text-base leading-snug font-semibold text-foreground">{title}</h3>
        {help}
      </div>
      <div className="flex flex-col gap-3 sm:pl-11">{children}</div>
    </section>
  )
}

function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-1.5 text-sm font-medium text-negative">
      <CircleAlertIcon className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
      <span>{children}</span>
    </p>
  )
}

function SummaryRow({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-[15px]">
      <span className="shrink-0 text-fg-secondary">{label}</span>
      <span className="min-w-0 text-right text-foreground tabular">{children}</span>
    </div>
  )
}

function SaveHint({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  title: string
  children: React.ReactNode
}) {
  return (
    <li className="flex gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
      <span>
        <span className="font-medium text-foreground">{title}:</span> {children}
      </span>
    </li>
  )
}
