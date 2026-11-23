"use client"

import { RotateCcwIcon } from "lucide-react"
import { toast } from "sonner"
import { create } from "zustand"
import { Steps } from "@/components/kit/help"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useInventory } from "@/lib/store"
import { GLOSSARY, HOW_IT_WORKS } from "@/lib/words"

export const useHelp = create<{ open: boolean; setOpen: (open: boolean) => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))

/** The whole app in three steps, the words it uses, and a safe way to start over. */
export function HelpSheet() {
  const open = useHelp((s) => s.open)
  const setOpen = useHelp((s) => s.setOpen)
  const resetDemo = useInventory((s) => s.resetDemo)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-[520px]">
        <SheetHeader className="gap-1 border-b border-border p-6">
          <SheetTitle className="text-xl font-semibold">How Crate works</SheetTitle>
          <SheetDescription className="text-[15px] text-fg-secondary">
            Three things to know. You can open this again from Help at any time.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-8 p-6">
          <Steps steps={HOW_IT_WORKS} className="sm:grid-cols-1" />

          <section className="flex flex-col gap-3">
            <h3 className="text-base font-semibold">Words you will see</h3>
            <dl className="flex flex-col divide-y divide-border rounded-xl border border-border">
              {GLOSSARY.map((g) => (
                <div key={g.term} className="flex flex-col gap-0.5 px-4 py-3">
                  <dt className="text-[15px] font-medium text-foreground">{g.term}</dt>
                  <dd className="text-sm leading-relaxed text-fg-secondary">{g.meaning}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="flex flex-col gap-3 rounded-xl border border-border bg-raised/60 p-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-base font-semibold">Practice freely</h3>
              <p className="text-sm leading-relaxed text-fg-secondary">
                Everything here is sample data for a Pune electrical shop. Try anything. If you want to start fresh, reset it.
              </p>
            </div>
            <Button
              variant="outline"
              className="self-start"
              onClick={() => {
                resetDemo()
                setOpen(false)
                toast.success("Sample data is back to the start", { description: "Stock, orders and history were reset." })
              }}
            >
              <RotateCcwIcon />
              Reset sample data
            </Button>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
