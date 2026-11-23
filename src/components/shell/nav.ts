import {
  ArrowRightLeftIcon,
  BoxesIcon,
  ChartColumnIcon,
  FactoryIcon,
  HouseIcon,
  ShoppingCartIcon,
  TruckIcon,
  UsersIcon,
  WarehouseIcon,
} from "lucide-react"

export type NavKey = "sales" | "purchases" | "stock"

export interface NavItem {
  href: string
  label: string
  /** a few words under the label: what you find there */
  hint: string
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  /** which live count to show on the right */
  count?: NavKey
}

export const NAV: { label: string; items: NavItem[] }[] = [
  {
    label: "Daily work",
    items: [
      { href: "/", label: "Home", hint: "Today at a glance", icon: HouseIcon },
      { href: "/sales", label: "Sales", hint: "Orders from customers", icon: ShoppingCartIcon, count: "sales" },
      { href: "/purchases", label: "Purchases", hint: "Orders to suppliers", icon: TruckIcon, count: "purchases" },
      { href: "/stock", label: "Stock", hint: "What you have, item by item", icon: BoxesIcon, count: "stock" },
      { href: "/transfers", label: "Move stock", hint: "Between godowns", icon: ArrowRightLeftIcon },
    ],
  },
  {
    label: "Records",
    items: [
      { href: "/godowns", label: "Godowns", hint: "Your warehouses", icon: WarehouseIcon },
      { href: "/customers", label: "Customers", hint: "Who buys from you", icon: UsersIcon },
      { href: "/suppliers", label: "Suppliers", hint: "Who you buy from", icon: FactoryIcon },
      { href: "/reports", label: "Reports", hint: "Totals and downloads", icon: ChartColumnIcon },
    ],
  },
]

/** What the number next to a menu item means. */
export const COUNT_HINT: Record<NavKey, string> = {
  sales: "orders waiting to be shipped or confirmed",
  purchases: "orders on the way from suppliers",
  stock: "items running low",
}

export const ALL_NAV = NAV.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label })))

export function navFor(pathname: string) {
  return ALL_NAV.find((n) => (n.href === "/" ? pathname === "/" : pathname.startsWith(n.href)))
}
