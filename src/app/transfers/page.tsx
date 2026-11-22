import type { Metadata } from "next"
import { TransfersView } from "@/components/transfers/transfers-view"

export const metadata: Metadata = { title: "Transfers" }

export default function Route() {
  return <TransfersView />
}
