"use client"

import { motion } from "motion/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useMemo } from "react"
import { LifeBuoyIcon } from "lucide-react"
import { EASE } from "@/components/kit/page"
import { lowStockItems } from "@/lib/calc"
import { useInventory, useMounted } from "@/lib/store"
import { cn } from "@/lib/utils"
import { useHelp } from "./help-sheet"
import { COUNT_HINT, NAV, type NavKey } from "./nav"

/** Crate's mark: an orange crate with a hand slot. */
export function CrateMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={cn("size-5", className)}>
      <rect x="1" y="1" width="18" height="18" rx="5" className="fill-brand" />
      <rect x="5" y="9" width="10" height="2.2" rx="1.1" className="fill-white" />
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

/** Navy menu with an orange "you are here" pill. Used by the desktop sidebar and the phone menu. */
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const counts = useCounts()
  const openHelp = useHelp((s) => s.setOpen)

  return (
    <div className="flex h-full flex-col gap-6 bg-sidebar px-3 pt-5 pb-4 text-sidebar-foreground">
      <Link
        href="/"
        onClick={onNavigate}
        className="flex items-center gap-3 rounded-lg px-2 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/60"
      >
        <CrateMark className="size-9" />
        <div className="flex min-w-0 flex-col">
          <span className="text-[17px] leading-tight font-semibold text-white">Crate</span>
          <span className="truncate text-[13px] text-white/60">Deccan Electric Supply</span>
        </div>
      </Link>

      <nav className="scroll-quiet -mx-1 flex flex-1 flex-col gap-6 overflow-y-auto px-1">
        {NAV.map((group) => (
          <div key={group.label} className="flex flex-col gap-1">
            <div className="mb-1 px-3 text-[13px] font-medium text-white/45">{group.label}</div>
            {group.items.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
              const count = item.count ? counts[item.count] : null
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex h-11 items-center gap-3 rounded-lg px-3 text-[15px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/60",
                    active ? "font-semibold text-white" : "text-white/75 hover:bg-sidebar-accent hover:text-white",
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="nav-active"
                      transition={{ duration: 0.3, ease: EASE }}
                      className="absolute inset-0 rounded-lg bg-primary shadow-[0_4px_14px_rgb(234_108_15/0.35)]"
                    />
                  ) : null}
                  <Icon
                    className={cn("relative size-5 shrink-0", active ? "text-white" : "text-white/55 group-hover:text-white/85")}
                    strokeWidth={1.75}
                  />
                  <span className="relative flex-1 truncate">{item.label}</span>
                  {count && item.count ? (
                    <span
                      className={cn(
                        "relative min-w-6 rounded-full px-2 text-center text-xs leading-6 font-semibold tabular",
                        active
                          ? "bg-white/25 text-white"
                          : item.count === "stock"
                            ? "bg-amber-400/20 text-amber-300"
                            : "bg-white/10 text-white/85",
                      )}
                      title={`${count} ${COUNT_HINT[item.count]}`}
                      aria-label={`${count} ${COUNT_HINT[item.count]}`}
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

      <button
        type="button"
        onClick={() => {
          onNavigate?.()
          openHelp(true)
        }}
        className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-left transition-colors outline-none hover:border-brand/50 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-sidebar-ring/60"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-white">
          <LifeBuoyIcon className="size-5" strokeWidth={1.75} />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold text-white">Help and guide</span>
          <span className="text-[13px] text-white/60">How Crate works, in 3 steps</span>
        </span>
      </button>

      <div className="flex items-center gap-3 px-2">
        <div className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-sm font-semibold text-white">AM</div>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm leading-tight font-medium text-white">Aarav Mehta</span>
          <span className="truncate text-[13px] text-white/60">Stores manager</span>
        </div>
      </div>
    </div>
  )
}

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-[264px] shrink-0 bg-sidebar lg:block">
      <SidebarContent />
    </aside>
  )
}
