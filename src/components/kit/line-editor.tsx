"use client"

import { AnimatePresence, motion } from "motion/react"
import { useMemo, useState } from "react"
import { ChevronDownIcon, MinusIcon, PackagePlusIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { onHand } from "@/lib/calc"
import { inr, num } from "@/lib/format"
import { useInventory } from "@/lib/store"
import type { Item, LineItem } from "@/lib/types"
import { cn } from "@/lib/utils"
import { BinLabel } from "./misc"
import { EASE } from "./page"

export interface EditorLine {
  key: string
  itemId: string
  qty: number
  rate: number
}

let k = 0
export const lineKey = () => `ln_${Date.now().toString(36)}_${(k++).toString(36)}`

export function toEditorLines(lines?: LineItem[]): EditorLine[] {
  return (lines ?? []).map((l) => ({ ...l, key: lineKey() }))
}

export function toLineItems(lines: EditorLine[]): LineItem[] {
  return lines.filter((l) => l.itemId).map(({ itemId, qty, rate }) => ({ itemId, qty, rate }))
}

const LABEL = "text-[13px] font-medium text-fg-secondary"

/* ------------------------------------------------------------------ */
/* Item picker: search by name or code, shows how many are in stock     */
/* ------------------------------------------------------------------ */
export function ItemPicker({
  value,
  onChange,
  godownId,
  exclude = [],
  className,
}: {
  value: string
  onChange: (item: Item) => void
  /** show stock at this godown; all godowns when omitted */
  godownId?: string
  exclude?: string[]
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const items = useInventory((s) => s.items)
  const stock = useInventory((s) => s.stock)
  const selected = items.find((i) => i.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={selected ? `Item: ${selected.name}. Change item` : "Choose an item"}
          className={cn(
            "flex h-11 w-full min-w-0 items-center gap-2.5 rounded-lg border border-input bg-card px-2 text-left text-[15px] shadow-xs transition-colors outline-none hover:border-foreground/25 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 data-[state=open]:border-ring",
            !selected && "border-dashed",
            className,
          )}
        >
          {selected ? (
            <>
              <BinLabel category={selected.category} size="sm" />
              <span className="min-w-0 flex-1 truncate">{selected.name}</span>
            </>
          ) : (
            <span className="flex-1 pl-1.5 text-muted-foreground">Choose an item…</span>
          )}
          <ChevronDownIcon className="mr-1 size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(460px,calc(100vw-32px))] p-0">
        <Command>
          <CommandInput placeholder="Search by item name or code…" className="text-[15px]" />
          <CommandList className="scroll-quiet max-h-80">
            <CommandEmpty>No item found. Try another word.</CommandEmpty>
            <CommandGroup>
              {items
                .filter((i) => i.id === value || !exclude.includes(i.id))
                .map((it) => {
                  const qty = onHand(stock, it.id, godownId)
                  return (
                    <CommandItem
                      key={it.id}
                      value={`${it.sku} ${it.name}`}
                      onSelect={() => {
                        onChange(it)
                        setOpen(false)
                      }}
                      className="gap-3 py-2"
                    >
                      <BinLabel category={it.category} size="sm" />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[15px]">{it.name}</span>
                        <span className="text-[13px] text-muted-foreground">Code {it.sku}</span>
                      </div>
                      <span className={cn("shrink-0 text-[13px] tabular", qty <= 0 ? "font-medium text-negative" : "text-muted-foreground")}>
                        {qty <= 0 ? "None in stock" : `${num(qty)} ${it.unit} in stock`}
                      </span>
                    </CommandItem>
                  )
                })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/* ------------------------------------------------------------------ */
/* Line editor used by the sale, purchase and move-stock forms.         */
/* One card per item: what, how many (with − / + buttons), price, total */
/* ------------------------------------------------------------------ */
export function LineEditor({
  lines,
  onChange,
  rateFrom,
  godownId,
  checkStock,
}: {
  lines: EditorLine[]
  onChange: (lines: EditorLine[]) => void
  /** which item price fills the rate when an item is picked; null hides price + total (moving stock) */
  rateFrom: "price" | "cost" | null
  /** godown whose stock is shown and checked */
  godownId?: string
  /** warn when the quantity is more than this godown has (sales, moving stock) */
  checkStock?: boolean
}) {
  const stock = useInventory((s) => s.stock)
  const items = useInventory((s) => s.items)
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])

  const update = (key: string, patch: Partial<EditorLine>) =>
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  const remove = (key: string) => onChange(lines.filter((l) => l.key !== key))
  const add = () => onChange([...lines, { key: lineKey(), itemId: "", qty: 1, rate: 0 }])

  const priceLabel = rateFrom === "price" ? "Selling price each" : "Buying price each"

  return (
    <div className="flex flex-col gap-3">
      {lines.length === 0 ? (
        <button
          type="button"
          onClick={add}
          className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-input bg-raised/40 px-4 py-8 text-center transition-colors hover:border-primary/40 hover:bg-accent"
        >
          <PackagePlusIcon className="size-7 text-primary-ink" strokeWidth={1.5} />
          <span className="text-[15px] font-medium text-foreground">No items yet</span>
          <span className="text-sm text-muted-foreground">Press here to add the first item.</span>
        </button>
      ) : null}

      <AnimatePresence initial={false}>
        {lines.map((l, idx) => {
          const item = byId.get(l.itemId)
          const have = item && godownId ? onHand(stock, item.id, godownId) : null
          const short = Boolean(checkStock && have !== null && l.qty > have)
          return (
            <motion.div
              key={l.key}
              layout="position"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.25, ease: EASE }}
              className={cn("rounded-xl border bg-card p-3 shadow-card sm:p-4", short ? "border-warning/50" : "border-border")}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">Item {idx + 1}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => remove(l.key)}
                  className="text-muted-foreground hover:bg-negative-soft hover:text-negative"
                >
                  <Trash2Icon strokeWidth={1.75} />
                  Remove
                </Button>
              </div>

              <div className={cn("grid gap-3", rateFrom ? "sm:grid-cols-[minmax(0,1fr)_152px_136px]" : "sm:grid-cols-[minmax(0,1fr)_152px]")}>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className={LABEL}>Item</span>
                  <ItemPicker
                    value={l.itemId}
                    godownId={godownId}
                    exclude={lines.map((x) => x.itemId).filter(Boolean)}
                    onChange={(it) =>
                      update(l.key, {
                        itemId: it.id,
                        rate: rateFrom ? it[rateFrom] : 0,
                      })
                    }
                  />
                </div>
                <div className={cn("grid gap-3", rateFrom ? "grid-cols-2 sm:contents" : "")}>
                  <div className="flex flex-col gap-1.5">
                    <span className={LABEL}>Quantity{item ? ` (${item.unit})` : ""}</span>
                    <QtyStepper value={l.qty} onChange={(v) => update(l.key, { qty: v })} invalid={short} />
                  </div>
                  {rateFrom ? (
                    <div className="flex flex-col gap-1.5">
                      <span className={LABEL}>{priceLabel}</span>
                      <NumberInput value={l.rate} onChange={(v) => update(l.key, { rate: v })} prefix="₹" ariaLabel={priceLabel} />
                    </div>
                  ) : null}
                </div>
              </div>

              {item || rateFrom ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border pt-3">
                  <p className={cn("text-sm", short ? "font-medium text-warning" : "text-muted-foreground")}>
                    {item && have !== null
                      ? short
                        ? `Only ${num(have)} ${item.unit} in this godown. Lower the quantity or move stock here first.`
                        : checkStock
                          ? `${num(have)} ${item.unit} in this godown`
                          : `You have ${num(have)} ${item.unit} in this godown now`
                      : item
                        ? `${num(onHand(stock, item.id))} ${item.unit} in all godowns`
                        : "Choose an item to see the stock"}
                  </p>
                  {rateFrom ? (
                    <p className="text-[15px] text-fg-secondary">
                      Total <span className="ml-1 font-semibold text-foreground tabular">{inr(l.qty * l.rate)}</span>
                    </p>
                  ) : null}
                </div>
              ) : null}
            </motion.div>
          )
        })}
      </AnimatePresence>

      {lines.length > 0 ? (
        <Button type="button" variant="outline" onClick={add} className="w-full border-dashed sm:w-fit">
          <PlusIcon strokeWidth={2} />
          Add another item
        </Button>
      ) : null}
    </div>
  )
}

/** Quantity with big − and + buttons, for people who prefer tapping to typing. */
export function QtyStepper({
  value,
  onChange,
  invalid,
  min = 1,
  className,
}: {
  value: number
  onChange: (v: number) => void
  invalid?: boolean
  min?: number
  className?: string
}) {
  const btn =
    "grid size-10 shrink-0 place-items-center text-fg-secondary transition-colors hover:bg-raised hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
  return (
    <div
      className={cn(
        "flex h-11 items-stretch overflow-hidden rounded-lg border border-input bg-card shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/25",
        invalid && "border-warning focus-within:border-warning focus-within:ring-warning/20",
        className,
      )}
    >
      <button type="button" aria-label="One less" className={cn(btn, "h-full")} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
        <MinusIcon className="size-4" strokeWidth={2} />
      </button>
      <input
        inputMode="numeric"
        aria-label="Quantity"
        aria-invalid={invalid || undefined}
        value={Number.isFinite(value) ? String(value) : ""}
        onChange={(e) => {
          const v = Number(e.target.value.replace(/[^\d]/g, ""))
          onChange(Number.isFinite(v) ? v : 0)
        }}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full min-w-0 border-x border-input bg-transparent text-center text-[15px] font-semibold tabular outline-none"
      />
      <button type="button" aria-label="One more" className={cn(btn, "h-full")} onClick={() => onChange(value + 1)}>
        <PlusIcon className="size-4" strokeWidth={2} />
      </button>
    </div>
  )
}

export function NumberInput({
  value,
  onChange,
  prefix,
  invalid,
  ariaLabel,
  className,
}: {
  value: number
  onChange: (v: number) => void
  prefix?: string
  invalid?: boolean
  ariaLabel?: string
  className?: string
}) {
  return (
    <div className={cn("relative", className)}>
      {prefix ? <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[15px] text-muted-foreground">{prefix}</span> : null}
      <input
        inputMode="numeric"
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        value={Number.isFinite(value) ? String(value) : ""}
        onChange={(e) => {
          const v = Number(e.target.value.replace(/[^\d]/g, ""))
          onChange(Number.isFinite(v) ? v : 0)
        }}
        onFocus={(e) => e.currentTarget.select()}
        className={cn(
          "h-11 w-full rounded-lg border border-input bg-card px-3 text-right text-[15px] shadow-xs tabular transition-colors outline-none hover:border-foreground/25 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25",
          prefix && "pl-7",
          invalid && "border-warning focus-visible:border-warning focus-visible:ring-warning/20",
        )}
      />
    </div>
  )
}
