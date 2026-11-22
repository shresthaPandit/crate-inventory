"use client"

import { motion } from "motion/react"
import { cn } from "@/lib/utils"

export const EASE = [0.22, 1, 0.36, 1] as const

/**
 * Page root. Caps width, sets page padding and runs the single entrance
 * on load: a short fade and rise. Every route wraps its content in this.
 */
export function Page({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.main
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className={cn("mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 pt-6 pb-16 sm:px-6 lg:px-8", className)}
    >
      {children}
    </motion.main>
  )
}

/** Title row: page name, one line of context, actions on the right. */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-[28px] leading-[1.15] font-medium tracking-[-0.01em] text-foreground">{title}</h1>
        {description ? <p className="text-sm text-fg-secondary">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

/** Small stagger for a group of siblings (max ~6 items, 50ms apart). */
export function Stagger({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 8 },
        show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
      }}
    >
      {children}
    </motion.div>
  )
}
