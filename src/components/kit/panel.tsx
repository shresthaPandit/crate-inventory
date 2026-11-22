import { cn } from "@/lib/utils"

/**
 * The one container used for content blocks: card surface, hairline,
 * radius 14. Header has a title, optional description and an action slot.
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
        "flex min-w-0 flex-col rounded-xl border border-border bg-card text-card-foreground",
        className,
      )}
    >
      {title || action ? (
        <header className="flex min-h-14 items-center justify-between gap-3 px-5 py-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            {title ? <h2 className="truncate text-sm font-medium text-foreground">{title}</h2> : null}
            {description ? <p className="truncate text-xs text-muted-foreground">{description}</p> : null}
          </div>
          {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
        </header>
      ) : null}
      <div className={cn(flush ? "" : "px-5 pb-5", !title && !action && !flush && "pt-5", bodyClassName)}>
        {children}
      </div>
    </section>
  )
}
