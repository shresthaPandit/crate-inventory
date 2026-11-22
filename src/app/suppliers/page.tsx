import type { Metadata } from "next"
import { SuppliersView } from "@/components/directory/suppliers-view"

export const metadata: Metadata = { title: "Suppliers" }

export default function Route() {
  return <SuppliersView />
}
