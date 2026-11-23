"use client"

import { motion } from "motion/react"
import { CheckIcon, LightbulbIcon } from "lucide-react"
import { Steps } from "@/components/kit/help"
import { EASE } from "@/components/kit/page"
import { Button } from "@/components/ui/button"
import { HOW_IT_WORKS } from "@/lib/words"

const HIDDEN_KEY = "crate.home.how-it-works-hidden"

/** Was the "How Crate works" card hidden in this browser? Safe when storage is blocked. */
export function readHowItWorksHidden() {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(HIDDEN_KEY) === "1"
  } catch {
    return false
  }
}

export function writeHowItWorksHidden(hidden: boolean) {
  try {
    if (hidden) window.localStorage.setItem(HIDDEN_KEY, "1")
    else window.localStorage.removeItem(HIDDEN_KEY)
  } catch {
    // storage blocked (private window): the card just comes back next visit
  }
}

/** The whole app in three steps, shown on Home until the person says "Got it". */
export function HowItWorksCard({ onHide }: { onHide: () => void }) {
  return (
    <motion.section
      aria-labelledby="how-it-works-title"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6, transition: { duration: 0.2, ease: EASE } }}
      transition={{ duration: 0.35, ease: EASE }}
      className="flex flex-col gap-4 rounded-xl border border-primary/15 bg-accent/60 p-5 shadow-card"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-card text-primary-ink ring-1 ring-primary/15">
            <LightbulbIcon className="size-5" strokeWidth={1.75} />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 id="how-it-works-title" className="text-base font-semibold text-foreground">
              How Crate works
            </h2>
            <p className="text-[15px] leading-relaxed text-fg-secondary">
              Three things to know. You can read this again any time from Help at the top.
            </p>
          </div>
        </div>
        <Button variant="outline" className="self-start" onClick={onHide}>
          <CheckIcon />
          Got it, hide this
        </Button>
      </div>
      <Steps steps={HOW_IT_WORKS} />
    </motion.section>
  )
}
