"use client"

import { AnimatePresence, motion } from "motion/react"
import { useMemo, useState } from "react"
import { ChevronsUpDownIcon, PlusIcon, XIcon } from "lucide-react"
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

/* ------------------------------------------------------------------ */
/* Item picker: searchable list showing SKU and on-hand at a godown     */
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
  /** show on-hand at this godown; all godowns when omitted */
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
          className={cn(
            "flex h-9 w-full min-w-0 items-center gap-2 rounded-lg border border-input bg-transparent px-2 text-left text-sm transition-colors outline-none hover:border-foreground/20 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 data-[state=open]:border-ring",
            className,
          )}
        >
          {selected ? (
            <>
              <BinLabel category={selected.category} size="sm" />
              <span className="min-w-0 flex-1 truncate">{selected.name}</span>
            </>
          ) : (
            <span className="flex-1 pl-1 text-muted-foreground">Choose item</span>
          )}
          <ChevronsUpDownIcon className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(420px,calc(100vw-32px))] p-0">
        <Command>
          <CommandInput placeholder="Search items or SKU" />
          <CommandList className="scroll-quiet max-h-72">
            <CommandEmpty>No item matches</CommandEmpty>
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
                      className="gap-2.5"
                    >
                      <BinLabel category={it.category} size="sm" />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate">{it.name}</span>
                        <span className="font-mono text-[11px] text-muted-foreground">{it.sku}</span>
                      </div>
                      <span className={cn("font-mono text-xs tabular", qty <= 0 ? "text-negative" : "text-muted-foreground")}>
                        {num(qty)} {it.unit}
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
/* Line editor used by the sale, purchase and transfer composers        */
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
  /** which item price fills the rate when an item is picked; null hides rate + amount (transfers) */
  rateFrom: "price" | "cost" | null
  /** godown whose on-hand is shown and checked */
  godownId?: string
  /** warn when qty exceeds what's on hand at godownId (sales, transfers) */
  checkStock?: boolean
}) {
  const stock = useInventory((s) => s.stock)
  const items = useInventory((s) => s.items)
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])

  const update = (key: string, patch: Partial<EditorLine>) =>
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  const remove = (key: string) => onChange(lines.filter((l) => l.key !== key))
  const add = () => onChange([...lines, { key: lineKey(), itemId: "", qty: 1, rate: 0 }])

  const cols = rateFrom ? "grid-cols-[minmax(0,1fr)_72px_88px_32px] sm:grid-cols-[minmax(0,1fr)_80px_96px_96px_32px]" : "grid-cols-[minmax(0,1fr)_88px_32px]"

  return (
    <div className="flex flex-col gap-2">
      <div className={cn("grid items-center gap-2 px-0.5 text-xs text-muted-foreground", cols)}>
        <span>Item</span>
        <span className="text-right">Qty</span>
        {rateFrom ? <span className="text-right">Rate</span> : null}
        {rateFrom ? <span className="hidden text-right sm:block">Amount</span> : null}
        <span />
      </div>
      <AnimatePresence initial={false}>
        {lines.map((l) => {
          const item = byId.get(l.itemId)
          const have = item && godownId ? onHand(stock, item.id, godownId) : null
          const short = checkStock && have !== null && l.qty > have
          return (
            <motion.div
              key={l.key}
              layout="position"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.25, ease: EASE }}
              className="flex flex-col gap-1"
            >
              <div className={cn("grid items-center gap-2", cols)}>
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
                <NumberInput value={l.qty} onChange={(v) => update(l.key, { qty: v })} invalid={short} ariaLabel="Quantity" />
                {rateFrom ? <NumberInput value={l.rate} onChange={(v) => update(l.key, { rate: v })} prefix="₹" ariaLabel="Rate" /> : null}
                {rateFrom ? (
                  <span className="hidden text-right font-mono text-sm text-fg-secondary tabular sm:block">{inr(l.qty * l.rate)}</span>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove line"
                  onClick={() => remove(l.key)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <XIcon className="size-4" strokeWidth={1.5} />
                </Button>
              </div>
              {item && have !== null ? (
                <p className={cn("pl-1 text-xs", short ? "text-warning" : "text-muted-foreground")}>
                  {short ? `Only ${num(have)} ${item.unit} on hand here` : `${num(have)} ${item.unit} on hand here`}
                </p>
              ) : null}
            </motion.div>
          )
        })}
      </AnimatePresence>
      <Button type="button" variant="ghost" onClick={add} className="w-fit gap-1.5 px-2 text-fg-secondary">
        <PlusIcon className="size-4" strokeWidth={1.5} />
        Add item
      </Button>
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
      {prefix ? <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-sm text-muted-foreground">{prefix}</span> : null}
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
          "h-9 w-full rounded-lg border border-input bg-transparent px-2 text-right font-mono text-sm tabular transition-colors outline-none hover:border-foreground/20 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
          prefix && "pl-5",
          invalid && "border-warning/60 focus-visible:border-warning focus-visible:ring-warning/20",
        )}
      />
    </div>
  )
}
