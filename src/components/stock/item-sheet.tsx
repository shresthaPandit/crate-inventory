"use client"

import { useId, useMemo, useState } from "react"
import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts"
import {
  ArrowRightLeftIcon,
  ClipboardCheckIcon,
  PackageCheckIcon,
  ShoppingCartIcon,
  TruckIcon,
} from "lucide-react"
import { toast } from "sonner"
import { AnimatedNumber } from "@/components/kit/animated-number"
import { HelpTip, NextStep } from "@/components/kit/help"
import { ItemIcon } from "@/components/kit/misc"
import { StatusBadge, TONE_PILL, type Tone } from "@/components/kit/status-badge"
import { StockMeter } from "@/components/kit/stock-meter"
import { Button } from "@/components/ui/button"
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { committedQty, incomingQty, onHand, stockStatus, suggestedReorder } from "@/lib/calc"
import { dateShort, inr, num, signed } from "@/lib/format"
import { useInventory, useNow, useUI } from "@/lib/store"
import type { Item, Movement } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ACTION } from "@/lib/words"
import {
  godownMin,
  isOpenableRef,
  MAIN_GODOWN,
  meaning,
  openRef,
  qtyText,
  reorderQty,
  timeAgo,
  unitWord,
  useRefNames,
  type RefNames,
} from "./shared"

const DAY = 86_400_000
const HISTORY_PAGE = 15

export function ItemSheet({
  id,
  open,
  onOpenChange,
}: {
  id: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const items = useInventory((s) => s.items)
  const item = id ? items.find((i) => i.id === id) : undefined

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[640px]">
        {item ? (
          <ItemSheetBody key={item.id} item={item} />
        ) : (
          <div className="px-6 pt-6 pb-5">
            <SheetTitle className="text-lg font-semibold">Item not found</SheetTitle>
            <SheetDescription className="text-[15px]">This item is no longer in your list.</SheetDescription>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function ItemSheetBody({ item }: { item: Item }) {
  const stock = useInventory((s) => s.stock)
  const godowns = useInventory((s) => s.godowns)
  const suppliers = useInventory((s) => s.suppliers)
  const purchaseOrders = useInventory((s) => s.purchaseOrders)
  const salesOrders = useInventory((s) => s.salesOrders)
  const movements = useInventory((s) => s.movements)
  const updateItem = useInventory((s) => s.updateItem)
  const openComposer = useUI((s) => s.openComposer)
  const now = useNow()

  const total = onHand(stock, item.id)
  const status = stockStatus(total, item.minLevel)
  const incoming = useMemo(() => incomingQty(purchaseOrders, item.id), [purchaseOrders, item.id])
  const committed = useMemo(() => committedQty(salesOrders, item.id), [salesOrders, item.id])
  const supplier = suppliers.find((s) => s.id === item.supplierId)
  const reorder = reorderQty(item, total, incoming)
  const needMore = suggestedReorder(item, total, incoming) > 0
  const u = (n: number) => qtyText(n, item.unit)
  const each = unitWord(1, item.unit)

  const orderMore = () =>
    openComposer({
      type: "purchase",
      defaults: {
        supplierId: supplier ? item.supplierId : undefined,
        godownId: MAIN_GODOWN,
        lines: [{ itemId: item.id, qty: reorder, rate: item.cost }],
      },
    })
  const correctCount = (godownId?: string) => openComposer({ type: "adjust", defaults: { itemId: item.id, godownId } })
  const moveStock = (fromGodownId?: string) =>
    openComposer({ type: "transfer", defaults: { fromGodownId, lines: [{ itemId: item.id, qty: 1 }] } })

  const fromSupplier = supplier ? ` from ${supplier.name}` : ""
  const orderButton = (
    <Button onClick={orderMore}>
      <TruckIcon strokeWidth={1.75} />
      {ACTION.reorder}
    </Button>
  )

  const free = Math.max(0, total - committed)
  const profit = item.price - item.cost
  const profitPct = item.price > 0 ? Math.round((profit / item.price) * 100) : 0

  return (
    <>
      {/* Header */}
      <div className="flex items-start gap-4 border-b border-border px-5 pt-6 pr-14 pb-5 sm:px-6">
        <ItemIcon category={item.category} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <SheetTitle className="text-xl leading-snug font-semibold">{item.name}</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            Item code {item.sku} · {item.category}
          </SheetDescription>
          <StatusBadge status={status} className="mt-1.5 w-fit" />
        </div>
      </div>

      {/* Body */}
      <div className="scroll-quiet flex flex-1 flex-col gap-8 overflow-y-auto px-5 py-6 sm:px-6">
        {/* What to do next */}
        {status === "out" ? (
          <NextStep tone="negative" title="Out of stock: none left in any godown." action={orderButton}>
            You cannot ship this item until more arrives.{" "}
            {incoming ? `${u(incoming)} already on the way. ` : ""}
            Order about {u(reorder)}
            {fromSupplier}.
          </NextStep>
        ) : status === "low" ? (
          <NextStep
            tone="warning"
            title={`Running low: ${u(total)} left, minimum is ${num(item.minLevel)}.`}
            action={orderButton}
          >
            {needMore
              ? `Order about ${num(reorder)} more${fromSupplier}.${incoming ? ` ${u(incoming)} already on the way.` : ""}`
              : `${u(incoming)} already on the way, which should be enough.`}
          </NextStep>
        ) : (
          <NextStep tone="positive" title="You have enough">
            {u(total)} in stock. Crate will mark it Running low when it drops to {u(item.minLevel)}.
          </NextStep>
        )}

        {/* How much */}
        <Section title="How much you have">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Tile label="In stock" value={total} unit={unitWord(total, item.unit)} />
            <Tile
              label="Booked for orders"
              value={committed}
              unit={unitWord(committed, item.unit)}
              help="Items on customer orders that are ready to ship but have not left yet. They stay in stock until you press “Ship order”."
            />
            <Tile
              label="On the way"
              value={incoming}
              unit={unitWord(incoming, item.unit)}
              help="Items you ordered from suppliers that have not arrived yet. Stock goes up when you press “Goods received”."
            />
          </div>
          {committed > total ? (
            <p className="text-[15px] text-warning">
              Customers have booked {u(committed - total)} more than you have. Order more before you ship.
            </p>
          ) : (
            <p className="text-[15px] text-fg-secondary">
              You can still promise <span className="font-semibold text-foreground">{u(free)}</span> to new customers.
            </p>
          )}
        </Section>

        {/* Where */}
        <Section title="Where it is" help={meaning("Godown")} helpLabel="What is a godown?">
          <ul className="flex flex-col gap-2">
            {godowns.map((g) => {
              const qty = onHand(stock, item.id, g.id)
              const min = godownMin(item.minLevel, g.id)
              const st = stockStatus(qty, min)
              return (
                <li
                  key={g.id}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-[15px] font-medium text-foreground">
                      {g.name} <span className="font-normal text-muted-foreground">· {g.city}</span>
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="whitespace-nowrap">
                        <span className="text-lg font-semibold text-foreground tabular">{num(qty)}</span>{" "}
                        <span className="text-[13px] text-muted-foreground">{unitWord(qty, item.unit)}</span>
                      </span>
                      <StockMeter qty={qty} min={min} />
                    </div>
                    <span
                      className={cn(
                        "text-[13px]",
                        st === "out" ? "text-negative" : st === "low" ? "text-warning" : "text-muted-foreground",
                      )}
                    >
                      {st === "out" ? "None here" : st === "low" ? `Low here. Minimum here is ${u(min)}` : `Minimum here is ${u(min)}`}
                    </span>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 sm:flex-none"
                      disabled={qty <= 0}
                      onClick={() => moveStock(g.id)}
                    >
                      <ArrowRightLeftIcon strokeWidth={1.75} />
                      {ACTION.newTransfer}
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => correctCount(g.id)}>
                      <ClipboardCheckIcon strokeWidth={1.75} />
                      Correct count
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        </Section>

        {/* Price */}
        <Section title="Price">
          <dl className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="flex flex-col gap-1 rounded-xl border border-border p-4">
              <dt className="text-[13px] text-muted-foreground">Buying cost</dt>
              <dd className="text-lg font-semibold text-foreground tabular">{inr(item.cost)}</dd>
              <dd className="text-[13px] text-muted-foreground">per {each}</dd>
            </div>
            <div className="flex flex-col gap-1 rounded-xl border border-border p-4">
              <dt className="flex items-center gap-1 text-[13px] text-muted-foreground">
                Selling price
                <HelpTip label="What is GST?">{meaning("GST")}</HelpTip>
              </dt>
              <dd className="text-lg font-semibold text-foreground tabular">{inr(item.price)}</dd>
              <dd className="text-[13px] text-muted-foreground">per {each}, before GST</dd>
            </div>
          </dl>
          <p className="text-[15px] text-fg-secondary">
            {profit > 0 ? (
              <>
                You earn <span className="font-semibold text-positive">{inr(profit)}</span> on each {each} you sell. That is{" "}
                {profitPct}% of the selling price.
              </>
            ) : (
              "At these prices you earn nothing on this item."
            )}
          </p>
          {supplier ? (
            <p className="text-sm text-muted-foreground">
              Usually bought from <span className="text-fg-secondary">{supplier.name}</span>. Delivery takes about{" "}
              {supplier.leadTimeDays} days.
            </p>
          ) : null}
        </Section>

        {/* Minimum level */}
        <MinLevelEditor
          item={item}
          onSave={(next) => {
            const before = item.minLevel
            updateItem(item.id, { minLevel: next })
            toast.success("Minimum level saved", {
              description: `${item.name}: now ${u(next)} (was ${num(before)}). Crate will warn you when stock drops to this.`,
            })
          }}
        />

        {/* Chart */}
        <Section
          title="Stock over the last 60 days"
          description="How many you had at the end of each day. The dashed line is the minimum level."
        >
          <HistoryChart item={item} total={total} now={now} />
        </Section>

        {/* History */}
        <StockHistory item={item} movements={movements} now={now} />
      </div>

      {/* Footer */}
      <div className="flex flex-col gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
        <Button variant="outline" onClick={() => correctCount()}>
          <ClipboardCheckIcon strokeWidth={1.75} />
          {ACTION.adjust}
        </Button>
        <Button onClick={orderMore}>
          <TruckIcon strokeWidth={1.75} />
          {ACTION.reorder}
        </Button>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Layout pieces                                                        */
/* ------------------------------------------------------------------ */

function Section({
  title,
  description,
  help,
  helpLabel,
  children,
}: {
  title: string
  description?: string
  help?: string
  helpLabel?: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="flex items-center gap-1.5 text-base font-semibold text-foreground">
          {title}
          {help ? <HelpTip label={helpLabel}>{help}</HelpTip> : null}
        </h3>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

function Tile({ label, value, unit, help }: { label: string; value: number; unit: string; help?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-xl border border-border bg-card p-3 sm:p-4">
      <span className="flex items-start gap-1 text-[13px] leading-snug text-muted-foreground">
        {label}
        {help ? <HelpTip label={`What does ${label.toLowerCase()} mean?`}>{help}</HelpTip> : null}
      </span>
      <span className="flex flex-wrap items-baseline gap-x-1">
        <AnimatedNumber value={value} className="text-[22px] leading-tight font-semibold text-foreground sm:text-2xl" />
        <span className="text-[13px] text-muted-foreground">{unit}</span>
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Minimum level: the number that decides "Running low"                 */
/* ------------------------------------------------------------------ */
function MinLevelEditor({ item, onSave }: { item: Item; onSave: (next: number) => void }) {
  const id = useId()
  const [draft, setDraft] = useState(String(item.minLevel))
  const value = draft === "" ? NaN : Number(draft)
  const invalid = !Number.isFinite(value) || value <= 0
  const changed = value !== item.minLevel

  return (
    <Section title="Minimum level" help={meaning("Minimum level")} helpLabel="What is the minimum level?">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!invalid && changed) onSave(value)
        }}
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor={id} className="text-[13px] font-medium text-fg-secondary">
            Minimum for all godowns together
          </label>
          <div className="flex items-center gap-2">
            <Input
              id={id}
              inputMode="numeric"
              value={draft}
              aria-invalid={invalid || undefined}
              onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
              onFocus={(e) => e.currentTarget.select()}
              className="w-32 text-right text-[15px] tabular md:text-[15px]"
            />
            <span className="text-[15px] text-muted-foreground">{unitWord(Number.isFinite(value) ? value : 0, item.unit)}</span>
          </div>
        </div>
        <Button type="submit" variant="outline" disabled={invalid || !changed}>
          Save minimum level
        </Button>
      </form>
      {invalid ? (
        <p className="text-[13px] text-negative">Type a number above 0.</p>
      ) : (
        <p className="text-[13px] text-muted-foreground">
          When stock in all godowns drops to this number, Crate marks the item Running low and shows it on Home.
        </p>
      )}
    </Section>
  )
}

/* ------------------------------------------------------------------ */
/* Stock history as plain sentences                                     */
/* ------------------------------------------------------------------ */

type Kind = "sale" | "purchase" | "move" | "fix"

const KIND: Record<Kind, { Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; tone: Tone }> = {
  sale: { Icon: ShoppingCartIcon, tone: "info" },
  purchase: { Icon: PackageCheckIcon, tone: "positive" },
  move: { Icon: ArrowRightLeftIcon, tone: "neutral" },
  fix: { Icon: ClipboardCheckIcon, tone: "warning" },
}

const REF_LABEL: Record<string, string> = {
  SO: "Sale",
  PO: "Supplier order",
  TR: "Stock move",
  ADJ: "Correction",
}

function refLabel(ref: string) {
  return `${REF_LABEL[ref.split("-")[0]] ?? "Ref"} ${ref}`
}

function describe(m: Movement, item: Item, names: RefNames): { kind: Kind; text: string; place: string } {
  const q = qtyText(Math.abs(m.qty), item.unit)
  const here = names.godown(m.godownId)
  switch (m.type) {
    case "sale":
      return { kind: "sale", text: `Sold ${q} to ${names.customerOf(m.ref)}`, place: `From ${here}` }
    case "purchase":
      return { kind: "purchase", text: `Received ${q} from ${names.supplierOf(m.ref)}`, place: `Into ${here}` }
    case "transfer_out": {
      const t = names.transferOf(m.ref)
      return { kind: "move", text: `Moved ${q} from ${t?.from ?? here} to ${t?.to ?? "another godown"}`, place: "Total stays the same" }
    }
    case "transfer_in": {
      const t = names.transferOf(m.ref)
      return { kind: "move", text: `Moved ${q} into ${here}${t ? ` from ${t.from}` : ""}`, place: "Total stays the same" }
    }
    case "adjustment":
      return {
        kind: "fix",
        text: `Count corrected: ${q} ${m.qty < 0 ? "less" : "more"} at ${here}`,
        place: m.note ? `Reason: ${m.note}` : "Stock correction",
      }
  }
}

function StockHistory({ item, movements, now }: { item: Item; movements: Movement[]; now: number }) {
  const names = useRefNames()
  const [shown, setShown] = useState(HISTORY_PAGE)

  // one entry per event: a move between godowns writes an "out" and an "in" row; show it once
  const entries = useMemo(() => {
    const mine = movements.filter((m) => m.itemId === item.id)
    const movedOut = new Set(mine.filter((m) => m.type === "transfer_out").map((m) => m.ref))
    return mine.filter((m) => !(m.type === "transfer_in" && movedOut.has(m.ref)))
  }, [movements, item.id])

  return (
    <Section
      title="Stock history"
      description={
        entries.length
          ? `Everything that changed this item's stock, newest first. ${entries.length > shown ? `Showing ${num(shown)} of ${num(entries.length)}.` : ""}`
          : undefined
      }
    >
      {entries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-[15px] text-muted-foreground">
          Nothing has changed this item&apos;s stock yet. Sales, goods received, moves and corrections will show here.
        </p>
      ) : (
        <>
          <ul className="flex flex-col rounded-xl border border-border bg-card">
            {entries.slice(0, shown).map((m) => {
              const d = describe(m, item, names)
              const k = KIND[d.kind]
              const moved = m.type === "transfer_in" || m.type === "transfer_out"
              return (
                <li key={m.id} className="flex items-start gap-3 border-b border-border px-4 py-3.5 last:border-0">
                  <span className={cn("mt-0.5 grid size-9 shrink-0 place-items-center rounded-full", TONE_PILL[k.tone])}>
                    <k.Icon className="size-[18px]" strokeWidth={1.75} />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <p className="text-[15px] leading-snug text-foreground">{d.text}</p>
                    <p className="text-[13px] text-muted-foreground">{d.place}</p>
                    <p className="flex flex-wrap items-center gap-x-1.5 text-[13px] text-muted-foreground">
                      <span>{timeAgo(m.date, now)}</span>
                      <span aria-hidden>·</span>
                      {isOpenableRef(m.ref) ? (
                        <button
                          type="button"
                          onClick={() => openRef(m.ref)}
                          className="rounded font-medium text-primary-ink underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                        >
                          {refLabel(m.ref)}
                        </button>
                      ) : (
                        <span>{refLabel(m.ref)}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
                    {moved ? (
                      <span className="text-[15px] font-semibold text-fg-secondary tabular">{num(Math.abs(m.qty))}</span>
                    ) : (
                      <span className={cn("text-[15px] font-semibold tabular", m.qty > 0 ? "text-positive" : "text-foreground")}>
                        {signed(m.qty)}
                      </span>
                    )}
                    {moved ? null : <span className="text-[13px] text-muted-foreground tabular">{num(m.balanceAfter)} left</span>}
                  </div>
                </li>
              )
            })}
          </ul>
          {entries.length > shown ? (
            <Button variant="outline" className="self-start" onClick={() => setShown((n) => n + 30)}>
              Show older history
            </Button>
          ) : null}
        </>
      )}
    </Section>
  )
}

/* ------------------------------------------------------------------ */
/* Stock over time: end-of-day balance for the last 60 days, rebuilt    */
/* from the ledger (current total minus every movement after that day). */
/* ------------------------------------------------------------------ */

const chartConfig = {
  balance: { label: "In stock", color: "var(--chart-1)" },
} satisfies ChartConfig

const TICK = { fontSize: 12, fill: "var(--muted-foreground)" }

function HistoryChart({ item, total, now }: { item: Item; total: number; now: number }) {
  const movements = useInventory((s) => s.movements)

  const data = useMemo(() => {
    const mine = movements.filter((m) => m.itemId === item.id).map((m) => ({ t: new Date(m.date).getTime(), qty: m.qty }))
    const today = new Date(now)
    today.setHours(23, 59, 59, 999)
    const end = today.getTime()
    const points: { t: number; label: string; balance: number }[] = []
    for (let d = 59; d >= 0; d--) {
      const dayEnd = end - d * DAY
      const after = mine.reduce((s, m) => (m.t > dayEnd ? s + m.qty : s), 0)
      points.push({ t: dayEnd, label: dateShort(dayEnd), balance: Math.max(0, total - after) })
    }
    return points
  }, [movements, item.id, total, now])

  const max = Math.max(item.minLevel, ...data.map((d) => d.balance))
  const gradientId = `hist-${item.id}`

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-[190px] w-full">
      <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-balance)" stopOpacity={0.18} />
            <stop offset="100%" stopColor="var(--color-balance)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={40}
          tickMargin={8}
          tick={TICK}
        />
        <YAxis
          width={44}
          tickLine={false}
          axisLine={false}
          domain={[0, Math.ceil(max * 1.15)]}
          tickFormatter={(v: number) => num(v)}
          tick={TICK}
        />
        <ReferenceLine
          y={item.minLevel}
          stroke="var(--warning)"
          strokeOpacity={0.8}
          strokeDasharray="4 4"
          label={{ value: "Minimum", position: "insideTopRight", fill: "var(--muted-foreground)", fontSize: 12 }}
        />
        <ChartTooltip
          cursor={{ stroke: "var(--border)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const p = payload[0].payload as { label: string; balance: number }
            return (
              <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-float">
                <p className="text-[13px] text-muted-foreground">{p.label}</p>
                <p className="text-[15px] font-medium text-foreground tabular">{qtyText(p.balance, item.unit)} in stock</p>
              </div>
            )
          }}
        />
        <Area
          type="stepAfter"
          dataKey="balance"
          stroke="var(--color-balance)"
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          isAnimationActive={false}
          activeDot={{ r: 3.5, strokeWidth: 0, fill: "var(--color-balance)" }}
        />
      </AreaChart>
    </ChartContainer>
  )
}
