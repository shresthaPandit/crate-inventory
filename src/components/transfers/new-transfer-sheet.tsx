"use client"

import { useMemo, useState } from "react"
import { ArrowDownIcon, ArrowRightIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react"
import { toast } from "sonner"
import { ConfirmDialog, type ConfirmChange } from "@/components/kit/confirm"
import { HelpTip } from "@/components/kit/help"
import { LineEditor, lineKey, type EditorLine } from "@/components/kit/line-editor"
import { Mono } from "@/components/kit/misc"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { onHand } from "@/lib/calc"
import { useInventory, useUI, type TransferDefaults } from "@/lib/store"
import type { Item, TransferLine } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ACTION } from "@/lib/words"
import { itemsText, linesQtyText, meaningOf, qtyText, signedQtyText } from "@/components/purchases/lib"
import { Helper, Step } from "@/components/purchases/form-parts"

export function NewTransferSheet({
  open,
  onOpenChange,
  defaults,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaults?: TransferDefaults
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
        <TransferForm key={session} defaults={defaults} onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  )
}

function TransferForm({ defaults, onDone }: { defaults?: TransferDefaults; onDone: () => void }) {
  const godowns = useInventory((s) => s.godowns)
  const items = useInventory((s) => s.items)
  const stock = useInventory((s) => s.stock)
  const createTransfer = useInventory((s) => s.createTransfer)
  const openPanel = useUI((s) => s.openPanel)

  const [from, setFrom] = useState(defaults?.fromGodownId ?? "g-bho")
  const [to, setTo] = useState(() => {
    const t = defaults?.toGodownId ?? "g-cha"
    return t === (defaults?.fromGodownId ?? "g-bho") ? (godowns.find((g) => g.id !== t)?.id ?? "g-cha") : t
  })
  const [lines, setLines] = useState<EditorLine[]>(() =>
    defaults?.lines?.length
      ? defaults.lines.map((l) => ({ key: lineKey(), itemId: l.itemId, qty: l.qty, rate: 0 }))
      : [{ key: lineKey(), itemId: "", qty: 1, rate: 0 }],
  )
  const [note, setNote] = useState("")
  // "missing" errors show only after the first try; wrong choices show straight away
  const [tried, setTried] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const fromName = godowns.find((g) => g.id === from)?.name ?? "godown"
  const toName = godowns.find((g) => g.id === to)?.name ?? "godown"

  const picked = lines.filter((l) => l.itemId)
  const valid = picked.filter((l) => l.qty > 0)
  const short = valid
    .map((l) => ({ line: l, item: itemById.get(l.itemId), have: onHand(stock, l.itemId, from) }))
    .filter((x) => x.line.qty > x.have)
  const qty = linesQtyText(valid, itemById)

  const sameGodown = from === to ? "This is the same godown as From. Choose the godown the stock should go to." : null
  const missing = !picked.length
    ? "Add at least one item to move. Press Add item and choose what you are sending."
    : picked.some((l) => l.qty <= 0)
      ? "Every item needs a quantity of 1 or more. Change the 0 or remove that line."
      : null
  const notEnough = short.length
    ? `Not enough stock in ${fromName}. ${short
        .map((x) => `${x.item?.name ?? "Item"}: only ${qtyText(x.have, x.item?.unit)}`)
        .join(", ")}. Lower the quantity.`
    : null
  const errors = { to: sameGodown, items: (tried ? missing : null) ?? notEnough }
  const blocking = sameGodown ?? missing ?? notEnough

  const swap = () => {
    setFrom(to)
    setTo(from)
  }

  const tryMove = () => {
    setTried(true)
    if (blocking) {
      toast.error("Please check the form", { description: blocking })
      return
    }
    setConfirming(true)
  }

  const move = () => {
    const res = createTransfer({
      fromGodownId: from,
      toGodownId: to,
      lines: valid.map((l) => ({ itemId: l.itemId, qty: l.qty })),
      note: note.trim() || undefined,
    })
    if (!res.ok) {
      toast.error("Could not move the stock", { description: res.error })
      return
    }
    toast.success("Stock moved", {
      description: `${qty} went from ${fromName} to ${toName}.`,
      action: { label: ACTION.view, onClick: () => openPanel({ type: "transfer", id: res.data.id }) },
    })
    onDone()
  }

  return (
    <>
      <div className="border-b border-border px-6 pt-5 pb-4 pr-12">
        <SheetTitle className="text-xl font-semibold">{ACTION.newTransfer}</SheetTitle>
        <SheetDescription className="text-[15px] text-fg-secondary">
          Send items from one godown to another. The total stock stays the same; it just changes place.
        </SheetDescription>
      </div>

      <div className="scroll-quiet flex flex-1 flex-col gap-8 overflow-y-auto px-6 py-6">
        {/* 1 */}
        <Step n={1} title="From which godown?" htmlFor="tr-from" help={<HelpTip label="What is a godown?">{meaningOf("Godown")}</HelpTip>}>
          <Select value={from} onValueChange={setFrom}>
            <SelectTrigger id="tr-from" className="w-full">
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
          <Helper>
            <ArrowDownIcon className="mr-1 inline size-3.5 text-negative" strokeWidth={2.25} />
            Stock goes down here.
          </Helper>
        </Step>

        <div className="-my-4 flex sm:pl-10">
          <Button type="button" variant="outline" onClick={swap} className="text-fg-secondary">
            <ArrowUpDownIcon strokeWidth={1.75} />
            Swap From and To
          </Button>
        </div>

        {/* 2 */}
        <Step n={2} title="To which godown?" htmlFor="tr-to" error={errors.to}>
          <Select value={to} onValueChange={setTo}>
            <SelectTrigger id="tr-to" className="w-full" aria-invalid={!!errors.to || undefined}>
              <SelectValue placeholder="Choose a godown" />
            </SelectTrigger>
            <SelectContent position="popper">
              {godowns.map((g) => (
                <SelectItem key={g.id} value={g.id} disabled={g.id === from}>
                  {g.name}
                  <Mono className="in-data-[slot=select-trigger]:hidden">{g.id === from ? "sending from here" : g.city}</Mono>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!errors.to ? (
            <Helper>
              <ArrowUpIcon className="mr-1 inline size-3.5 text-positive" strokeWidth={2.25} />
              Stock goes up here.
            </Helper>
          ) : null}
        </Step>

        {/* 3 */}
        <Step n={3} title="What are you moving?" error={errors.items}>
          <Helper className="-mt-1">
            Choose each item and how many to send. Under each item you can see how many are in {fromName} right now.
          </Helper>
          <LineEditor lines={lines} onChange={setLines} rateFrom={null} godownId={from} checkStock />
        </Step>

        {/* 4 */}
        <Step n={4} title="Check and move">
          <div className="flex flex-col gap-2">
            <Label htmlFor="tr-note" className="text-sm font-medium text-fg-secondary">
              Note <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="tr-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="For example: tempo number, who is carrying it, why"
              className="min-h-20 resize-none text-[15px]"
            />
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-border bg-raised/50 p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] font-semibold text-foreground">
              <span>{fromName}</span>
              <ArrowRightIcon aria-label="to" className="size-4 text-muted-foreground" strokeWidth={2} />
              <span className={cn(errors.to && "text-negative")}>{toName}</span>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div className="flex flex-col gap-0.5">
                <dt className="text-[13px] text-muted-foreground">Items</dt>
                <dd className={cn("text-[15px] font-medium", valid.length ? "text-foreground" : "text-muted-foreground")}>
                  {valid.length ? itemsText(valid.length) : "None yet"}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-[13px] text-muted-foreground">Quantity</dt>
                <dd className="text-[15px] font-medium text-foreground tabular">{valid.length ? qty : "—"}</dd>
              </div>
            </dl>
            <p className="border-t border-border pt-3 text-sm leading-relaxed text-fg-secondary">
              {valid.length
                ? `${fromName} goes down by ${qty}. ${toName} goes up by ${qty}. Your total stock stays the same.`
                : "Add items above to see what will change."}
            </p>
          </div>
        </Step>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
        <Button variant="ghost" onClick={onDone} className="text-fg-secondary sm:mr-auto">
          Close
        </Button>
        <Button onClick={tryMove}>{ACTION.newTransfer}</Button>
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Move ${qty} from ${fromName} to ${toName}?`}
        description="Press this when the items are leaving the godown. Stock goes down in one godown and up in the other. Your total stays the same."
        changes={moveChanges(valid, itemById, fromName, toName)}
        confirmLabel="Yes, move stock"
        onConfirm={move}
      />
    </>
  )
}

/** Show at most this many items in the confirm box (two rows each), then one "N more" pair. */
const MAX_ITEMS = 3

function moveChanges(lines: TransferLine[], itemById: Map<string, Item>, fromName: string, toName: string): ConfirmChange[] {
  const shown = lines.length > MAX_ITEMS ? lines.slice(0, MAX_ITEMS - 1) : lines
  const rest = lines.slice(shown.length)
  const rows: ConfirmChange[] = shown.flatMap((l) => {
    const item = itemById.get(l.itemId)
    const name = item?.name ?? "Item"
    return [
      { label: `${name} — ${fromName}`, value: signedQtyText(-l.qty, item?.unit), direction: "down" as const },
      { label: `${name} — ${toName}`, value: signedQtyText(l.qty, item?.unit), direction: "up" as const },
    ]
  })
  if (rest.length) {
    const restQty = linesQtyText(rest, itemById)
    rows.push(
      { label: `${itemsText(rest.length)} more — ${fromName}`, value: `−${restQty}`, direction: "down" },
      { label: `${itemsText(rest.length)} more — ${toName}`, value: `+${restQty}`, direction: "up" },
    )
  }
  return rows
}
