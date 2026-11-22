import type { Metadata } from "next"
import { CustomersView } from "@/components/directory/customers-view"

export const metadata: Metadata = { title: "Customers" }

export default function Route() {
  return <CustomersView />
}
