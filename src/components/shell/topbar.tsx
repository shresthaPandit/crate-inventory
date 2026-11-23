"use client"

import Link from "next/link"
import { useMemo } from "react"
import { BellIcon, ChevronDownIcon, CircleHelpIcon, MenuIcon, PlusIcon, SearchIcon } from "lucide-react"
import { QUICK_ACTIONS } from "@/components/kit/actions"
import { BinLabel } from "@/components/kit/misc"
import { StatusBadge } from "@/components/kit/status-badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { lowStockItems } from "@/lib/calc"
import { num } from "@/lib/format"
import { useInventory, useMounted, useUI } from "@/lib/store"
import { useHelp } from "./help-sheet"
import { SidebarContent } from "./sidebar"

/** "+ New" with the four everyday actions, each with one line saying what it does. */
export function NewMenu({ align = "end" }: { align?: "start" | "end" }) {
  const openComposer = useUI((s) => s.openComposer)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>
          <PlusIcon strokeWidth={2.25} />
          New
          <ChevronDownIcon className="-mr-1 opacity-80" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-80 p-1.5">
        <DropdownMenuLabel className="px-2.5 pt-1.5 pb-2 text-[13px] font-medium text-muted-foreground">What do you want to do?</DropdownMenuLabel>
        {QUICK_ACTIONS.map((a) => (
          <DropdownMenuItem key={a.type} onSelect={() => openComposer({ type: a.type })} className="items-start gap-3 rounded-lg px-2.5 py-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-primary-ink">
              <a.icon className="size-[18px]" strokeWidth={1.75} />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[15px] font-medium text-foreground">{a.label}</span>
              <span className="text-[13px] leading-snug whitespace-normal text-muted-foreground">{a.hint}</span>
            </span>
          </DropdownMenuItem>
        ))}
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
        <Button variant="outline" size="icon" aria-label={`${low.length} items running low`} className="relative">
          <BellIcon className="size-5" strokeWidth={1.75} />
          {low.length ? (
            <span className="absolute -top-1.5 -right-1.5 grid min-w-5 place-items-center rounded-full bg-negative px-1 text-[11px] leading-5 font-semibold text-white">
              {low.length}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] p-0">
        <div className="flex flex-col gap-0.5 px-4 pt-4 pb-3">
          <p className="text-base font-semibold">Running low</p>
          <p className="text-sm text-muted-foreground">These items are at or below their minimum level.</p>
        </div>
        <div className="scroll-quiet max-h-80 overflow-y-auto px-1.5 pb-1.5">
          {low.length === 0 ? (
            <p className="px-3 py-6 text-center text-[15px] text-muted-foreground">All good. Every item is above its minimum.</p>
          ) : (
            low.map(({ item, qty }) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openPanel({ type: "item", id: item.id })}
                className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-raised"
              >
                <BinLabel category={item.category} size="sm" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px]">{item.name}</span>
                  <span className="text-[13px] text-muted-foreground tabular">
                    {num(qty)} left · minimum {num(item.minLevel)}
                  </span>
                </div>
                <StatusBadge status={qty <= 0 ? "out" : "low"} label={qty <= 0 ? "Out" : "Low"} />
              </button>
            ))
          )}
        </div>
        <div className="border-t border-border p-1.5">
          <Link href="/stock?status=low" className="flex h-10 items-center justify-center rounded-lg text-[15px] font-medium text-primary-ink transition-colors hover:bg-accent">
            See all in Stock
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function Topbar() {
  const { mobileNavOpen, setMobileNavOpen, setCommandOpen } = useUI()
  const openHelp = useHelp((s) => s.setOpen)

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-card/90 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      <Button variant="ghost" size="icon" className="-ml-2 lg:hidden" aria-label="Open menu" onClick={() => setMobileNavOpen(true)}>
        <MenuIcon className="size-5" strokeWidth={1.75} />
      </Button>
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-[290px] bg-sidebar p-0 sm:max-w-[290px]" showCloseButton={false}>
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SidebarContent onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <button
        type="button"
        onClick={() => setCommandOpen(true)}
        className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-input bg-background px-3 text-left text-[15px] text-muted-foreground transition-colors hover:border-foreground/25 sm:max-w-md"
      >
        <SearchIcon className="size-[18px] shrink-0" strokeWidth={1.75} />
        <span className="truncate">
          <span className="sm:hidden">Search</span>
          <span className="hidden sm:inline">Search items, customers or orders…</span>
        </span>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <Alerts />
        <Button variant="outline" className="hidden md:inline-flex" onClick={() => openHelp(true)}>
          <CircleHelpIcon className="size-[18px]" strokeWidth={1.75} />
          Help
        </Button>
        <NewMenu />
      </div>
    </header>
  )
}
