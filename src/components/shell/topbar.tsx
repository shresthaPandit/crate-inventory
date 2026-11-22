"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useMemo } from "react"
import {
  ArrowLeftRightIcon,
  BellIcon,
  ChevronRightIcon,
  MenuIcon,
  PlusIcon,
  ReceiptTextIcon,
  SlidersHorizontalIcon,
  TruckIcon,
} from "lucide-react"
import { BinLabel, Keycap } from "@/components/kit/misc"
import { StockMeter } from "@/components/kit/stock-meter"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { lowStockItems } from "@/lib/calc"
import { num } from "@/lib/format"
import { useInventory, useMounted, useUI } from "@/lib/store"
import { navFor } from "./nav"
import { SidebarContent } from "./sidebar"

export function NewMenu({ align = "end" }: { align?: "start" | "end" }) {
  const openComposer = useUI((s) => s.openComposer)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="default" className="gap-1.5 pr-3 pl-2.5">
          <PlusIcon className="size-4" strokeWidth={1.75} />
          New
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56">
        <DropdownMenuItem onSelect={() => openComposer({ type: "sale" })} className="gap-2">
          <ReceiptTextIcon className="size-4" strokeWidth={1.5} />
          Sales order
          <DropdownMenuShortcut>S</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openComposer({ type: "purchase" })} className="gap-2">
          <TruckIcon className="size-4" strokeWidth={1.5} />
          Purchase order
          <DropdownMenuShortcut>P</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openComposer({ type: "transfer" })} className="gap-2">
          <ArrowLeftRightIcon className="size-4" strokeWidth={1.5} />
          Transfer
          <DropdownMenuShortcut>T</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openComposer({ type: "adjust" })} className="gap-2">
          <SlidersHorizontalIcon className="size-4" strokeWidth={1.5} />
          Stock adjustment
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Alerts() {
  const mounted = useMounted()
  const stock = useInventory((s) => s.stock)
  const items = useInventory((s) => s.items)
  const openPanel = useUI((s) => s.openPanel)
  const low = useMemo(() => (mounted ? lowStockItems(stock, items) : []), [mounted, stock, items])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`${low.length} stock alerts`} className="relative text-muted-foreground hover:text-foreground">
          <BellIcon className="size-4" strokeWidth={1.5} />
          {low.length ? <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-warning" /> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <p className="text-sm font-medium">Stock alerts</p>
          <span className="font-mono text-xs text-muted-foreground tabular">{low.length}</span>
        </div>
        <div className="scroll-quiet max-h-80 overflow-y-auto px-1 pb-1">
          {low.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Everything is above its min level</p>
          ) : (
            low.map(({ item, qty }) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openPanel({ type: "item", id: item.id })}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-raised"
              >
                <BinLabel category={item.category} size="sm" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm">{item.name}</span>
                  <span className="font-mono text-xs text-muted-foreground tabular">
                    {num(qty)} of {num(item.minLevel)} min
                  </span>
                </div>
                <StockMeter qty={qty} min={item.minLevel} size="sm" slots={6} />
              </button>
            ))
          )}
        </div>
        <div className="border-t border-border p-1">
          <Link href="/stock?status=low" className="flex h-8 items-center justify-center rounded-lg text-sm text-fg-secondary transition-colors hover:bg-raised hover:text-foreground">
            Open stock list
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function Topbar() {
  const pathname = usePathname()
  const current = navFor(pathname)
  const { mobileNavOpen, setMobileNavOpen, setCommandOpen } = useUI()

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      <Button variant="ghost" size="icon" className="-ml-1.5 lg:hidden" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}>
        <MenuIcon className="size-4" strokeWidth={1.5} />
      </Button>
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-[280px] bg-sidebar p-0 sm:max-w-[280px]" showCloseButton={false}>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
        <span className="hidden text-muted-foreground sm:inline">{current?.group ?? "Overview"}</span>
        <ChevronRightIcon className="hidden size-3.5 text-muted-foreground/60 sm:inline" strokeWidth={1.5} />
        <span className="truncate text-foreground">{current?.label ?? "Dashboard"}</span>
      </nav>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          className="hidden h-8 items-center gap-2 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:bg-raised hover:text-foreground md:flex"
        >
          Jump to
          <Keycap>Ctrl K</Keycap>
        </button>
        <Alerts />
        <NewMenu />
      </div>
    </header>
  )
}
