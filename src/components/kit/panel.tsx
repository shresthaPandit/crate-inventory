import { cn } from "@/lib/utils"

/**
 * The one container for content blocks: white card, soft shadow.
 * Header has a title, a plain one-line explanation and an action slot.
 * Use `flush` when the body is a table that should run edge to edge.
 */
export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
  flush,
}: {
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
  flush?: boolean
}) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-card",
        className,
      )}
    >
      {title || action ? (
        <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex min-w-0 flex-col gap-1">
            {title ? <h2 className="text-base leading-tight font-semibold text-foreground">{title}</h2> : null}
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
        </header>
      ) : null}
      <div className={cn(flush ? "" : "px-5 pb-5", !title && !action && !flush && "pt-5", bodyClassName)}>
        {children}
      </div>
    </section>
  )
}
