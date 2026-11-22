"use client"

import { useState } from "react"
import { toast } from "sonner"
import { ItemPicker, NumberInput } from "@/components/kit/line-editor"
import { Segmented } from "@/components/kit/misc"
import { StockMeter } from "@/components/kit/stock-meter"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { onHand } from "@/lib/calc"
import { num } from "@/lib/format"
import { useInventory, type AdjustDefaults } from "@/lib/store"
import { cn } from "@/lib/utils"

const REASONS = [
  "Cycle count correction",
  "Damaged in handling",
  "Water damage",
  "Failed QC",
  "Sample issued",
  "Found during audit",
] as const

type Direction = "remove" | "add"

export function AdjustStockDialog({
  open,
  onOpenChange,
  defaults,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaults?: AdjustDefaults
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-[480px]">
        {/* content remounts on every open, so the form starts fresh */}
        <AdjustForm defaults={defaults} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function AdjustForm({ defaults, onDone }: { defaults?: AdjustDefaults; onDone: () => void }) {
  const items = useInventory((s) => s.items)
  const godowns = useInventory((s) => s.godowns)
  const stock = useInventory((s) => s.stock)
  const adjustStock = useInventory((s) => s.adjustStock)

  const [itemId, setItemId] = useState(defaults?.itemId ?? "")
  const [godownId, setGodownId] = useState(defaults?.godownId ?? "g-bho")
  const [direction, setDirection] = useState<Direction>("remove")
  const [qty, setQty] = useState(1)
  const [reason, setReason] = useState<string>(REASONS[0])
  const [note, setNote] = useState("")

  const item = items.find((i) => i.id === itemId)
  const godown = godowns.find((g) => g.id === godownId)
  const delta = direction === "add" ? qty : -qty
  const before = item ? onHand(stock, item.id, godownId) : 0
  const after = before + delta
  const totalBefore = item ? onHand(stock, item.id) : 0
  const totalAfter = totalBefore + delta
  const invalid = after < 0

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!item || !godown) return
    const fullReason = note.trim() ? `${reason} · ${note.trim()}` : reason
    const res = adjustStock({ itemId: item.id, godownId, qty: delta, reason: fullReason })
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success("Stock adjusted", {
      description: `${item.name} at ${godown.name}: ${num(before)} → ${num(after)}`,
    })
    onDone()
  }

  return (
    <form onSubmit={submit} className="flex flex-col">
      <div className="flex flex-col gap-1.5 px-5 pt-5 pb-4">
        <DialogTitle>Adjust stock</DialogTitle>
        <DialogDescription>Correct a count or write off damaged units. Every change goes into the ledger</DialogDescription>
      </div>

      <div className="flex flex-col gap-4 px-5 pb-5">
        <FieldBlock label="Item">
          <ItemPicker value={itemId} onChange={(it) => setItemId(it.id)} godownId={godownId} />
        </FieldBlock>

        <div className="grid grid-cols-2 gap-3">
          <FieldBlock label="Godown">
            <Select value={godownId} onValueChange={setGodownId}>
              <SelectTrigger className="h-9 w-full" aria-label="Godown">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {godowns.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldBlock>
          <FieldBlock label="Change">
            <Segmented<Direction>
              value={direction}
              onValueChange={setDirection}
              className="h-9 w-full [&>button]:flex-1 [&>button]:justify-center"
              items={[
                { value: "remove", label: "Remove" },
                { value: "add", label: "Add" },
              ]}
            />
          </FieldBlock>
        </div>

        <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3">
          <FieldBlock label="Quantity">
            <NumberInput value={qty} onChange={setQty} invalid={invalid} ariaLabel="Quantity" />
          </FieldBlock>
          <FieldBlock label="Reason">
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="h-9 w-full" aria-label="Reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldBlock>
        </div>

        <FieldBlock label="Note" hint="Optional">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Bay 4, carton torn"
            className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors outline-none placeholder:text-muted-foreground hover:border-foreground/20 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          />
        </FieldBlock>

        {/* Live preview */}
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-raised/40 px-3 py-3">
          {item && godown ? (
            <>
              <div className="flex min-w-0 flex-col gap-1 font-mono text-xs tabular">
                <span className={cn(invalid ? "text-negative" : "text-foreground")}>
                  {godown.name}: {num(before)} → {num(after)}
                </span>
                <span className="text-muted-foreground">
                  All godowns: {num(totalBefore)} → {num(Math.max(0, totalAfter))}
                </span>
              </div>
              <StockMeter qty={Math.max(0, totalAfter)} min={item.minLevel} size="sm" />
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Pick an item to preview the change</span>
          )}
        </div>
        {invalid && godown ? (
          <p className="-mt-2 text-xs text-negative">Only {num(before)} on hand at {godown.name}</p>
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={!item || qty <= 0 || invalid}>
          Adjust stock
        </Button>
      </div>
    </form>
  )
}

function FieldBlock({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="flex items-baseline justify-between text-xs text-muted-foreground">
        {label}
        {hint ? <span className="text-muted-foreground/70">{hint}</span> : null}
      </span>
      {children}
    </div>
  )
}
