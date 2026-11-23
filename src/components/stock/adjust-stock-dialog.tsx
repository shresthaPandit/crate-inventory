"use client"

import { useId, useState } from "react"
import { ArrowDownIcon, ArrowUpIcon, CircleCheckIcon } from "lucide-react"
import { toast } from "sonner"
import { ConfirmDialog, type ConfirmChange } from "@/components/kit/confirm"
import { HelpTip } from "@/components/kit/help"
import { ItemPicker } from "@/components/kit/line-editor"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { onHand } from "@/lib/calc"
import { num } from "@/lib/format"
import { useInventory, type AdjustDefaults } from "@/lib/store"
import { cn } from "@/lib/utils"
import { ACTION } from "@/lib/words"
import { MAIN_GODOWN, meaning, qtyText, unitWord } from "./shared"

/** Why the shelf count differs from Crate's, in plain words. Saved as the reason on the stock history entry. */
const REASONS = ["Damaged", "Lost or missing", "Found extra", "Counting mistake", "Other"] as const

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
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-[520px]">
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

  const ids = { godown: useId(), counted: useId(), reason: useId(), note: useId() }

  const [itemId, setItemId] = useState(defaults?.itemId ?? "")
  const [godownId, setGodownId] = useState(defaults?.godownId ?? MAIN_GODOWN)
  const [counted, setCounted] = useState("")
  const [reason, setReason] = useState("")
  const [note, setNote] = useState("")
  const [tried, setTried] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const item = items.find((i) => i.id === itemId)
  const godown = godowns.find((g) => g.id === godownId)
  const before = item ? onHand(stock, item.id, godownId) : 0
  const totalBefore = item ? onHand(stock, item.id) : 0
  const countedQty = counted === "" ? null : Number(counted)
  const delta = countedQty === null ? 0 : countedQty - before
  const u = (n: number) => (item ? qtyText(n, item.unit) : num(n))

  const errors = {
    item: !item ? "Choose the item you counted." : null,
    counted: countedQty === null ? "Type how many you counted. Type 0 if the shelf is empty." : null,
    reason: !reason ? "Choose why the count is different." : null,
  }
  const same = countedQty !== null && delta === 0
  const hasError = Boolean(errors.item || errors.counted || errors.reason)

  // a new item or godown means a new shelf: start the count again
  const pickItem = (id: string) => {
    setItemId(id)
    setCounted("")
  }
  const pickGodown = (id: string) => {
    setGodownId(id)
    setCounted("")
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (hasError || same || !item || !godown) return
    setConfirming(true)
  }

  const save = () => {
    if (!item || !godown || countedQty === null) return
    const fullReason = note.trim() ? `${reason} · ${note.trim()}` : reason
    const res = adjustStock({ itemId: item.id, godownId, qty: delta, reason: fullReason })
    if (!res.ok) {
      toast.error("Could not save the correction", { description: res.error })
      return
    }
    toast.success("Stock count corrected", {
      description: `${item.name} at ${godown.name} is now ${u(countedQty)} (${u(Math.abs(delta))} ${delta < 0 ? "less" : "more"} than before).`,
    })
    onDone()
  }

  const direction: ConfirmChange["direction"] = delta < 0 ? "down" : "up"
  const changes: ConfirmChange[] =
    item && godown && countedQty !== null
      ? [
          { label: `${godown.name} godown`, value: `${num(before)} → ${u(countedQty)}`, direction },
          { label: "All godowns together", value: `${num(totalBefore)} → ${u(totalBefore + delta)}`, direction },
          { label: "Reason", value: reason, direction: "none" },
        ]
      : []

  return (
    <>
      <form onSubmit={submit} noValidate className="flex flex-col">
        <div className="flex flex-col gap-2 px-5 pt-6 pr-12 pb-5 sm:px-6">
          <DialogTitle className="text-lg leading-snug font-semibold">{ACTION.adjust}</DialogTitle>
          <DialogDescription className="text-[15px] leading-relaxed text-fg-secondary">
            Use this after you count the shelf. Crate will change the number to what you counted.
          </DialogDescription>
        </div>

        <div className="flex flex-col gap-6 px-5 pb-6 sm:px-6">
          {/* 1. Item */}
          <Step n={1} title="Which item did you count?">
            <ItemPicker value={itemId} onChange={(it) => pickItem(it.id)} godownId={godownId} className="h-11 text-[15px]" />
            <FieldError show={tried} message={errors.item} />
          </Step>

          {/* 2. Godown */}
          <Step
            n={2}
            title="Which godown?"
            htmlFor={ids.godown}
            help={<HelpTip label="What is a godown?">{meaning("Godown")}</HelpTip>}
          >
            <Select value={godownId} onValueChange={pickGodown}>
              <SelectTrigger id={ids.godown} className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {godowns.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name} · {g.city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Step>

          {/* 3. Count */}
          <Step n={3} title="How many are on the shelf?">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5 rounded-xl bg-raised px-4 py-3">
                <span className="text-[13px] text-muted-foreground">Crate says</span>
                <span className="text-[22px] leading-tight font-semibold text-foreground tabular">
                  {item ? num(before) : "—"}{" "}
                  {item ? <span className="text-[15px] font-normal text-muted-foreground">{unitWord(before, item.unit)}</span> : null}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={ids.counted} className="text-[13px] font-medium text-fg-secondary">
                  You counted
                </label>
                <div className="relative">
                  <Input
                    id={ids.counted}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="0"
                    value={counted}
                    disabled={!item}
                    aria-invalid={(tried && Boolean(errors.counted)) || undefined}
                    onChange={(e) => setCounted(e.target.value.replace(/[^\d]/g, ""))}
                    className="h-12 pr-14 text-right text-xl font-semibold tabular md:text-xl"
                  />
                  {item ? (
                    <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[15px] text-muted-foreground">
                      {unitWord(countedQty ?? 0, item.unit)}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            {!item ? (
              <p className="text-[13px] text-muted-foreground">Choose the item first.</p>
            ) : countedQty === null ? (
              <FieldError show={tried} message={errors.counted} />
            ) : same ? (
              <p className="flex items-center gap-2 rounded-lg bg-positive-soft px-3 py-2.5 text-[15px] text-positive">
                <CircleCheckIcon className="size-4 shrink-0" strokeWidth={2} />
                Same as Crate&apos;s count. There is nothing to correct.
              </p>
            ) : (
              <p
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2.5 text-[15px] font-medium",
                  delta < 0 ? "bg-negative-soft text-negative" : "bg-positive-soft text-positive",
                )}
              >
                {delta < 0 ? (
                  <ArrowDownIcon className="size-4 shrink-0" strokeWidth={2.25} />
                ) : (
                  <ArrowUpIcon className="size-4 shrink-0" strokeWidth={2.25} />
                )}
                {u(Math.abs(delta))} {delta < 0 ? "less" : "more"} than Crate&apos;s count
              </p>
            )}
          </Step>

          {/* 4. Reason */}
          <Step n={4} title="Why is it different?" htmlFor={ids.reason}>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger
                id={ids.reason}
                className="h-11 w-full"
                aria-invalid={(tried && Boolean(errors.reason)) || undefined}
              >
                <SelectValue placeholder="Choose a reason" />
              </SelectTrigger>
              <SelectContent position="popper">
                {REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError show={tried} message={errors.reason} />
            <div className="flex flex-col gap-1.5 pt-1">
              <label htmlFor={ids.note} className="text-[13px] font-medium text-fg-secondary">
                Note <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <Input
                id={ids.note}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="For example: carton torn in bay 4"
                className="md:text-[15px]"
              />
            </div>
          </Step>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" disabled={same}>
            Save correction
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Save this stock correction?"
        description={
          item && godown && countedQty !== null
            ? `Crate will change ${item.name} at ${godown.name} from ${u(before)} to ${u(countedQty)}.`
            : undefined
        }
        changes={changes}
        confirmLabel="Yes, save correction"
        onConfirm={save}
      />
    </>
  )
}

function Step({
  n,
  title,
  htmlFor,
  help,
  children,
}: {
  n: number
  title: string
  htmlFor?: string
  help?: React.ReactNode
  children: React.ReactNode
}) {
  const Title = htmlFor ? "label" : "span"
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2.5">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-[13px] font-semibold text-primary-foreground">
          {n}
        </span>
        <Title {...(htmlFor ? { htmlFor } : {})} className="text-base font-semibold text-foreground">
          {title}
        </Title>
        {help}
      </div>
      {children}
    </section>
  )
}

function FieldError({ show, message }: { show: boolean; message: string | null }) {
  if (!show || !message) return null
  return <p className="text-[13px] font-medium text-negative">{message}</p>
}
