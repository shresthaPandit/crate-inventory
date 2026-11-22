"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import {
  ArrowLeftRightIcon,
  MoonIcon,
  ReceiptTextIcon,
  SlidersHorizontalIcon,
  TruckIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { BinLabel, Mono } from "@/components/kit/misc"
import {
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
import { ALL_NAV } from "./nav"

export function CommandMenu() {
  const router = useRouter()
  const { commandOpen: open, setCommandOpen: setOpen, openComposer, openPanel } = useUI()
  const items = useInventory((s) => s.items)
  const stock = useInventory((s) => s.stock)
  const salesOrders = useInventory((s) => s.salesOrders)
  const purchaseOrders = useInventory((s) => s.purchaseOrders)
  const customers = useInventory((s) => s.customers)
  const suppliers = useInventory((s) => s.suppliers)
  const { resolvedTheme, setTheme } = useTheme()

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
    <CommandDialog open={open} onOpenChange={setOpen} title="Jump to" description="Search pages, items and orders" className="sm:max-w-[560px]">
      <CommandInput placeholder="Search pages, items, orders" />
      <CommandList className="scroll-quiet max-h-[420px]">
        <CommandEmpty>Nothing matches that</CommandEmpty>
        <CommandGroup heading="Create">
          <CommandItem onSelect={() => run(() => openComposer({ type: "sale" }))}>
            <ReceiptTextIcon strokeWidth={1.5} />
            New sales order
          </CommandItem>
          <CommandItem onSelect={() => run(() => openComposer({ type: "purchase" }))}>
            <TruckIcon strokeWidth={1.5} />
            New purchase order
          </CommandItem>
          <CommandItem onSelect={() => run(() => openComposer({ type: "transfer" }))}>
            <ArrowLeftRightIcon strokeWidth={1.5} />
            New transfer
          </CommandItem>
          <CommandItem onSelect={() => run(() => openComposer({ type: "adjust" }))}>
            <SlidersHorizontalIcon strokeWidth={1.5} />
            Adjust stock
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Pages">
          {ALL_NAV.map((n) => (
            <CommandItem key={n.href} value={`page ${n.label}`} onSelect={() => run(() => router.push(n.href))}>
              <n.icon strokeWidth={1.5} />
              {n.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Items">
          {items.map((it) => (
            <CommandItem key={it.id} value={`${it.sku} ${it.name}`} onSelect={() => run(() => openPanel({ type: "item", id: it.id }))}>
              <BinLabel category={it.category} size="sm" />
              <span className="truncate">{it.name}</span>
              <CommandShortcut className="font-mono tracking-normal">{num(onHand(stock, it.id))}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Sales orders">
          {salesOrders.slice(0, 40).map((o) => (
            <CommandItem key={o.id} value={`${o.number} ${custName(o.customerId)}`} onSelect={() => run(() => openPanel({ type: "sale", id: o.id }))}>
              <Mono className="w-16">{o.number}</Mono>
              <span className="truncate">{custName(o.customerId)}</span>
              <CommandShortcut className="font-mono tracking-normal">{inr(orderTotals(o.lines).total)}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Purchase orders">
          {purchaseOrders.slice(0, 30).map((o) => (
            <CommandItem key={o.id} value={`${o.number} ${supName(o.supplierId)}`} onSelect={() => run(() => openPanel({ type: "purchase", id: o.id }))}>
              <Mono className="w-16">{o.number}</Mono>
              <span className="truncate">{supName(o.supplierId)}</span>
              <CommandShortcut className="font-mono tracking-normal">{inr(orderTotals(o.lines).subtotal)}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Preferences">
          <CommandItem onSelect={() => run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}>
            <MoonIcon strokeWidth={1.5} />
            Toggle theme
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
