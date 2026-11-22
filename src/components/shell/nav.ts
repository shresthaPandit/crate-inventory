import {
  ArrowLeftRightIcon,
  BoxesIcon,
  ChartColumnIcon,
  FactoryIcon,
  LayoutDashboardIcon,
  ReceiptTextIcon,
  TruckIcon,
  UsersIcon,
  WarehouseIcon,
} from "lucide-react"

export type NavKey = "sales" | "purchases" | "stock"

export interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  /** which live count to show on the right */
  count?: NavKey
}

export const NAV: { label?: string; items: NavItem[] }[] = [
  { items: [{ href: "/", label: "Dashboard", icon: LayoutDashboardIcon }] },
  {
    label: "Operations",
    items: [
      { href: "/sales", label: "Sales", icon: ReceiptTextIcon, count: "sales" },
      { href: "/purchases", label: "Purchases", icon: TruckIcon, count: "purchases" },
      { href: "/stock", label: "Stock", icon: BoxesIcon, count: "stock" },
      { href: "/transfers", label: "Transfers", icon: ArrowLeftRightIcon },
    ],
  },
  {
    label: "Directory",
    items: [
      { href: "/godowns", label: "Godowns", icon: WarehouseIcon },
      { href: "/customers", label: "Customers", icon: UsersIcon },
      { href: "/suppliers", label: "Suppliers", icon: FactoryIcon },
    ],
  },
  {
    label: "Insights",
    items: [{ href: "/reports", label: "Reports", icon: ChartColumnIcon }],
  },
]

export const ALL_NAV = NAV.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label })))

export function navFor(pathname: string) {
  return ALL_NAV.find((n) => (n.href === "/" ? pathname === "/" : pathname.startsWith(n.href)))
}
