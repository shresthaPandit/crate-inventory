"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BoxesIcon, HouseIcon, MenuIcon, ShoppingCartIcon, TruckIcon } from "lucide-react"
import { useUI } from "@/lib/store"
import { cn } from "@/lib/utils"

const TABS = [
  { href: "/", label: "Home", icon: HouseIcon },
  { href: "/sales", label: "Sales", icon: ShoppingCartIcon },
  { href: "/purchases", label: "Purchases", icon: TruckIcon },
  { href: "/stock", label: "Stock", icon: BoxesIcon },
]

/** Phone tab bar: the four main places one thumb away, "More" opens the full menu. */
export function MobileNav() {
  const pathname = usePathname()
  const setMobileNavOpen = useUI((s) => s.setMobileNavOpen)
  const tab = "flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors outline-none"
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      {TABS.map((t) => {
        const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href)
        return (
          <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={cn(tab, active ? "text-primary-ink" : "text-muted-foreground")}>
            <t.icon className="size-[22px]" strokeWidth={active ? 2 : 1.75} />
            {t.label}
          </Link>
        )
      })}
      <button type="button" onClick={() => setMobileNavOpen(true)} className={cn(tab, "text-muted-foreground")}>
        <MenuIcon className="size-[22px]" strokeWidth={1.75} />
        More
      </button>
    </nav>
  )
}
