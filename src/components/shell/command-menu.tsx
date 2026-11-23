"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { CircleHelpIcon } from "lucide-react"
import { QUICK_ACTIONS } from "@/components/kit/actions"
import { BinLabel, Mono } from "@/components/kit/misc"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command"
import { onHand, orderTotals } from "@/lib/calc"
import { inr, num } from "@/lib/format"
import { useInventory, useUI } from "@/lib/store"
import { useHelp } from "./help-sheet"
import { ALL_NAV } from "./nav"

export function CommandMenu() {
  const router = useRouter()
  const { commandOpen: open, setCommandOpen: setOpen, openComposer, openPanel } = useUI()
  const openHelp = useHelp((s) => s.setOpen)
  const items = useInventory((s) => s.items)
  const stock = useInventory((s) => s.stock)
  const salesOrders = useInventory((s) => s.salesOrders)
  const purchaseOrders = useInventory((s) => s.purchaseOrders)
  const customers = useInventory((s) => s.customers)
  const suppliers = useInventory((s) => s.suppliers)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(!useUI.getState().commandOpen)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [setOpen])

  const run = (fn: () => void) => {
    setOpen(false)
    // let the dialog close before opening a sheet
    setTimeout(fn, 60)
  }

  const custName = (id: string) => customers.find((c) => c.id === id)?.name ?? ""
  const supName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? ""

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Find an item, customer, order or page" className="sm:max-w-[600px]">
      <Command>
        <CommandInput placeholder="Type an item name, customer or order number…" className="text-[15px]" />
        <CommandList className="scroll-quiet max-h-[460px]">
          <CommandEmpty>Nothing found. Try fewer letters, or a different word.</CommandEmpty>
          <CommandGroup heading="Do something">
            {QUICK_ACTIONS.map((a) => (
              <CommandItem key={a.type} value={`do ${a.label} ${a.hint}`} onSelect={() => run(() => openComposer({ type: a.type }))} className="py-2.5">
                <a.icon strokeWidth={1.75} />
                {a.label}
              </CommandItem>
            ))}
            <CommandItem value="help how crate works guide" onSelect={() => run(() => openHelp(true))} className="py-2.5">
              <CircleHelpIcon strokeWidth={1.75} />
              How Crate works
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="Go to page">
            {ALL_NAV.map((n) => (
              <CommandItem key={n.href} value={`page ${n.label} ${n.hint}`} onSelect={() => run(() => router.push(n.href))} className="py-2.5">
                <n.icon strokeWidth={1.75} />
                {n.label}
                <span className="text-[13px] text-muted-foreground">{n.hint}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Items">
            {items.map((it) => (
              <CommandItem key={it.id} value={`${it.sku} ${it.name}`} onSelect={() => run(() => openPanel({ type: "item", id: it.id }))}>
                <BinLabel category={it.category} size="sm" />
                <span className="truncate">{it.name}</span>
                <CommandShortcut className="tracking-normal tabular">{num(onHand(stock, it.id))} in stock</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Sales">
            {salesOrders.slice(0, 40).map((o) => (
              <CommandItem key={o.id} value={`${o.number} ${custName(o.customerId)}`} onSelect={() => run(() => openPanel({ type: "sale", id: o.id }))}>
                <Mono className="w-20">{o.number}</Mono>
                <span className="truncate">{custName(o.customerId)}</span>
                <CommandShortcut className="tracking-normal tabular">{inr(orderTotals(o.lines).total)}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Purchases">
            {purchaseOrders.slice(0, 30).map((o) => (
              <CommandItem key={o.id} value={`${o.number} ${supName(o.supplierId)}`} onSelect={() => run(() => openPanel({ type: "purchase", id: o.id }))}>
                <Mono className="w-20">{o.number}</Mono>
                <span className="truncate">{supName(o.supplierId)}</span>
                <CommandShortcut className="tracking-normal tabular">{inr(orderTotals(o.lines).subtotal)}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
