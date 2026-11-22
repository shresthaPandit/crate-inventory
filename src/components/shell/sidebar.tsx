"use client"

import { motion } from "motion/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useMemo } from "react"
import { ChevronsUpDownIcon, RotateCcwIcon, SearchIcon } from "lucide-react"
import { toast } from "sonner"
import { EASE } from "@/components/kit/page"
import { Keycap } from "@/components/kit/misc"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { lowStockItems } from "@/lib/calc"
import { useInventory, useMounted, useUI } from "@/lib/store"
import { cn } from "@/lib/utils"
import { NAV, type NavKey } from "./nav"
import { ThemeSwitch } from "./theme-switch"

/** Flat mark: a crate seen from the front — a square with one slat. */
export function CrateMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={cn("size-5", className)}>
      <rect x="2" y="2" width="16" height="16" rx="4" className="fill-foreground" />
      <rect x="5" y="9" width="10" height="2" rx="1" className="fill-background" />
    </svg>
  )
}

function useCounts(): Record<NavKey, number | null> {
  const mounted = useMounted()
  const salesOrders = useInventory((s) => s.salesOrders)
  const purchaseOrders = useInventory((s) => s.purchaseOrders)
  const stock = useInventory((s) => s.stock)
  const items = useInventory((s) => s.items)
  return useMemo(() => {
    if (!mounted) return { sales: null, purchases: null, stock: null }
    return {
      sales: salesOrders.filter((o) => o.status === "draft" || o.status === "confirmed").length,
      purchases: purchaseOrders.filter((o) => o.status === "ordered").length,
      stock: lowStockItems(stock, items).length,
    }
  }, [mounted, salesOrders, purchaseOrders, stock, items])
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const counts = useCounts()
  const setCommandOpen = useUI((s) => s.setCommandOpen)
  const resetDemo = useInventory((s) => s.resetDemo)

  return (
    <div className="flex h-full flex-col gap-4 px-3 pt-3 pb-3">
      {/* Workspace */}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex h-11 w-full items-center gap-2.5 rounded-lg px-2 text-left transition-colors outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring/50 data-[state=open]:bg-sidebar-accent">
          <CrateMark />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-[15px] leading-tight font-medium">Crate</span>
            <span className="truncate text-xs text-muted-foreground">Deccan Electric Supply</span>
          </div>
          <ChevronsUpDownIcon className="size-4 text-muted-foreground" strokeWidth={1.5} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Workspace</DropdownMenuLabel>
          <DropdownMenuItem className="gap-2">
            <CrateMark className="size-4" />
            Deccan Electric Supply
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              resetDemo()
              toast.success("Sample data restored", { description: "Stock, orders and history are back to the starting point" })
            }}
            className="gap-2"
          >
            <RotateCcwIcon className="size-4" strokeWidth={1.5} />
            Reset sample data
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Search */}
      <button
        type="button"
        onClick={() => setCommandOpen(true)}
        className="flex h-8 items-center gap-2 rounded-lg border border-sidebar-border bg-background/40 px-2.5 text-sm text-muted-foreground transition-colors hover:border-foreground/15 hover:text-fg-secondary"
      >
        <SearchIcon className="size-4" strokeWidth={1.5} />
        <span className="flex-1 text-left">Search</span>
        <Keycap>Ctrl K</Keycap>
      </button>

      {/* Navigation */}
      <nav className="scroll-quiet -mx-1 flex flex-1 flex-col overflow-y-auto px-1">
        {NAV.map((group, gi) => (
          <div key={gi} className={cn("flex flex-col gap-0.5", gi > 0 && "mt-6")}>
            {group.label ? <div className="mb-1 px-2 text-xs text-muted-foreground">{group.label}</div> : null}
            {group.items.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
              const count = item.count ? counts[item.count] : null
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "group relative flex h-8 items-center gap-2.5 rounded-lg px-2 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    active ? "text-foreground" : "text-fg-secondary hover:bg-sidebar-accent/70 hover:text-foreground",
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="nav-active"
                      transition={{ duration: 0.35, ease: EASE }}
                      className="absolute inset-0 rounded-lg border border-sidebar-border bg-sidebar-accent shadow-highlight"
                    />
                  ) : null}
                  <Icon
                    className={cn("relative size-4 shrink-0", active ? "text-foreground" : "text-muted-foreground group-hover:text-fg-secondary")}
                    strokeWidth={1.5}
                  />
                  <span className="relative flex-1 truncate">{item.label}</span>
                  {count ? (
                    <span
                      className={cn(
                        "relative font-mono text-xs tabular",
                        item.count === "stock" ? "text-warning" : "text-muted-foreground",
                      )}
                      title={item.count === "stock" ? "Items at or below min level" : "Open"}
                    >
                      {count}
                    </span>
                  ) : null}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="flex items-center gap-2.5 rounded-lg px-2 pt-2">
        <div className="grid size-7 shrink-0 place-items-center rounded-full bg-raised text-xs font-medium text-fg-secondary">AM</div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm leading-tight">Aarav Mehta</span>
          <span className="truncate text-xs text-muted-foreground">Stores manager</span>
        </div>
        <ThemeSwitch />
      </div>
    </div>
  )
}

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 border-r border-sidebar-border bg-sidebar lg:block">
      <SidebarContent />
    </aside>
  )
}
