"use client"

import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

export type ConfirmChange = {
  label: string
  value: string
  /** up = stock or money goes up (green), down = goes down (red) */
  direction?: "up" | "down" | "none"
}

/**
 * Asks before anything that changes stock or money, and lists exactly what
 * will change, so nothing happens by surprise. The confirm button repeats
 * the action in words ("Yes, ship order"), never just "OK".
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  changes,
  confirmLabel,
  cancelLabel = "Go back",
  onConfirm,
  destructive,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  changes?: ConfirmChange[]
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  destructive?: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 p-6 sm:max-w-[480px]">
        <DialogHeader className="gap-2">
          <DialogTitle className="text-lg leading-snug font-semibold">{title}</DialogTitle>
          {description ? <DialogDescription className="text-[15px] leading-relaxed text-fg-secondary">{description}</DialogDescription> : null}
        </DialogHeader>
        {changes && changes.length > 0 ? (
          <div className="flex flex-col gap-1 rounded-xl border border-border bg-raised/50 p-2">
            <p className="px-2 pt-1 pb-1 text-[13px] font-medium text-muted-foreground">This will change</p>
            {changes.map((c, i) => {
              const Icon = c.direction === "up" ? ArrowUpIcon : c.direction === "down" ? ArrowDownIcon : MinusIcon
              return (
                <div key={i} className="flex items-center gap-3 rounded-lg bg-card px-3 py-2.5">
                  <span
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-full",
                      c.direction === "up" && "bg-positive-soft text-positive",
                      c.direction === "down" && "bg-negative-soft text-negative",
                      (!c.direction || c.direction === "none") && "bg-raised text-muted-foreground",
                    )}
                  >
                    <Icon className="size-4" strokeWidth={2.25} />
                  </span>
                  <span className="min-w-0 flex-1 text-[15px] text-foreground">{c.label}</span>
                  <span className="shrink-0 text-[15px] font-semibold text-foreground tabular">{c.value}</span>
                </div>
              )
            })}
          </div>
        ) : null}
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            className={cn(destructive && "bg-destructive text-white hover:bg-destructive/90")}
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
