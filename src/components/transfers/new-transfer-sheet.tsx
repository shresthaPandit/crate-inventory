"use client"

import { useState } from "react"
import { ArrowLeftRightIcon } from "lucide-react"
import { toast } from "sonner"
import { LineEditor, lineKey, type EditorLine } from "@/components/kit/line-editor"
import { Mono } from "@/components/kit/misc"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { onHand } from "@/lib/calc"
import { num } from "@/lib/format"
import { useInventory, useUI, type TransferDefaults } from "@/lib/store"

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
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[640px]">
        <TransferForm key={session} defaults={defaults} onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  )
}

function TransferForm({ defaults, onDone }: { defaults?: TransferDefaults; onDone: () => void }) {
  const godowns = useInventory((s) => s.godowns)
  const stock = useInventory((s) => s.stock)
  const createTransfer = useInventory((s) => s.createTransfer)
  const openPanel = useUI((s) => s.openPanel)

  const [from, setFrom] = useState(defaults?.fromGodownId ?? "g-bho")
  const [to, setTo] = useState(() => {
    const t = defaults?.toGodownId ?? "g-cha"
    return t === (defaults?.fromGodownId ?? "g-bho") ? godowns.find((g) => g.id !== t)?.id ?? "g-cha" : t
  })
  const [lines, setLines] = useState<EditorLine[]>(() =>
    defaults?.lines?.length
      ? defaults.lines.map((l) => ({ key: lineKey(), itemId: l.itemId, qty: l.qty, rate: 0 }))
      : [{ key: lineKey(), itemId: "", qty: 1, rate: 0 }],
  )
  const [note, setNote] = useState("")

  const fromName = godowns.find((g) => g.id === from)?.name ?? "godown"
  const toName = godowns.find((g) => g.id === to)?.name ?? "godown"

  const valid = lines.filter((l) => l.itemId && l.qty > 0)
  const short = valid.some((l) => l.qty > onHand(stock, l.itemId, from))
  const units = valid.reduce((s, l) => s + l.qty, 0)

  const pickFrom = (id: string) => {
    if (id === to) setTo(from)
    setFrom(id)
  }
  const pickTo = (id: string) => {
    if (id === from) setFrom(to)
    setTo(id)
  }
  const swap = () => {
    setFrom(to)
    setTo(from)
  }

  const submit = () => {
    const res = createTransfer({
      fromGodownId: from,
      toGodownId: to,
      lines: valid.map((l) => ({ itemId: l.itemId, qty: l.qty })),
      note: note.trim() || undefined,
    })
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success(`Moved ${num(units)} units`, {
      description: `${fromName} to ${toName} · ${res.data.number}`,
      action: { label: "View", onClick: () => openPanel({ type: "transfer", id: res.data.id }) },
    })
    onDone()
  }

  const godownSelect = (id: string, value: string, onChange: (v: string) => void, label: string) => (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <Label htmlFor={id} className="text-xs font-normal text-muted-foreground">
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="h-9 w-full">
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
  )

  return (
    <>
      <div className="border-b border-border px-6 pt-5 pb-4 pr-12">
        <SheetTitle className="text-lg">New transfer</SheetTitle>
        <SheetDescription>Moves stock between godowns. The total on hand stays the same</SheetDescription>
      </div>

      <div className="scroll-quiet flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
        <div className="flex items-end gap-2">
          {godownSelect("tr-from", from, pickFrom, "From")}
          <Button type="button" variant="outline" size="icon" onClick={swap} aria-label="Swap godowns" className="mb-0.5 size-8 shrink-0">
            <ArrowLeftRightIcon className="size-4 text-muted-foreground" strokeWidth={1.5} />
          </Button>
          {godownSelect("tr-to", to, pickTo, "To")}
        </div>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Items</h3>
            <span className="text-xs text-muted-foreground">On hand shown for {fromName}</span>
          </div>
          <LineEditor lines={lines} onChange={setLines} rateFrom={null} godownId={from} checkStock />
        </section>

        <section className="flex flex-col gap-2">
          <Label htmlFor="tr-note" className="text-xs font-normal text-muted-foreground">
            Note
          </Label>
          <Textarea
            id="tr-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reason, vehicle number"
            className="min-h-16 resize-none"
          />
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-6 py-4">
        <span className="mr-auto text-xs text-muted-foreground tabular">
          {short ? <span className="text-warning">Not enough stock at {fromName}</span> : `${num(units)} units, ${fromName} to ${toName}`}
        </span>
        <Button variant="ghost" onClick={onDone} className="text-fg-secondary">
          Cancel
        </Button>
        <Button disabled={!valid.length || short || from === to} onClick={submit}>
          Move stock
        </Button>
      </div>
    </>
  )
}
