import type { Metadata } from "next"
import { GodownsView } from "@/components/godowns/godowns-view"

export const metadata: Metadata = { title: "Godowns" }

export default function Route() {
  return <GodownsView />
}
