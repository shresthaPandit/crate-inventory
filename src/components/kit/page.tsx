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
      className={cn("mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 pt-6 pb-28 sm:px-6 lg:px-8 lg:pb-16", className)}
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
  icon: Icon,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  /** page icon, matches the menu */
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="flex min-w-0 items-start gap-4">
        {Icon ? (
          <span className="mt-0.5 hidden size-12 shrink-0 place-items-center rounded-2xl bg-accent text-primary-ink sm:grid">
            <Icon className="size-6" strokeWidth={1.75} />
          </span>
        ) : null}
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.01em] text-foreground sm:text-[28px]">{title}</h1>
          {description ? <p className="max-w-2xl text-[15px] leading-relaxed text-fg-secondary">{description}</p> : null}
        </div>
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
