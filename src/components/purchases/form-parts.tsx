import { CircleAlertIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * One numbered part of a form ("1. Which supplier?"). The number turns red
 * when this part has a problem, and the problem is written in plain words
 * right under the field. Shared by the purchase and move-stock forms.
 */
export function Step({
  n,
  title,
  htmlFor,
  help,
  error,
  children,
}: {
  n: number
  title: string
  /** id of the field the title labels, when the part has a single field */
  htmlFor?: string
  /** a HelpTip next to the title */
  help?: React.ReactNode
  error?: string | null
  children: React.ReactNode
}) {
  const Title = htmlFor ? "label" : "h3"
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-full text-sm font-semibold",
            error ? "bg-negative text-white" : "bg-primary text-primary-foreground",
          )}
        >
          {n}
        </span>
        <Title htmlFor={htmlFor} className="text-base font-semibold text-foreground">
          <span className="sr-only">{n}. </span>
          {title}
        </Title>
        {help}
      </div>
      <div className="flex flex-col gap-2.5 sm:pl-10">
        {children}
        {error ? (
          <p role="alert" className="flex items-start gap-2 text-sm font-medium text-negative">
            <CircleAlertIcon className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
            {error}
          </p>
        ) : null}
      </div>
    </section>
  )
}

/** Short grey line under a field that explains it. */
export function Helper({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-sm leading-relaxed text-muted-foreground", className)}>{children}</p>
}
