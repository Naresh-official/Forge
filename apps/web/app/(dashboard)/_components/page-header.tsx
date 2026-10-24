import Link from "next/link"
import { Loader2, Plus } from "lucide-react"
import { Button, buttonVariants } from "@forge/ui/components/button"
import { cn } from "@forge/ui/lib/utils"

/**
 * Page title block. Renders without a client boundary, so a server component
 * can render it directly; use `actionHref` for navigation actions and
 * `onAction` only from client components.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  onAction,
  actionHref,
  actionIcon,
  actionDisabled = false,
  actionLoading = false,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: string
  onAction?: () => void
  /** Renders the action as a link, keeping the header server-side. */
  actionHref?: string
  /** Replaces the default plus icon, e.g. a rocket for "Deploy". */
  actionIcon?: React.ReactNode
  actionDisabled?: boolean
  actionLoading?: boolean
}) {
  const actionClassName =
    "gap-2 px-3.5 py-2.5 text-[11px] font-bold max-sm:w-full"

  return (
    <div className="mb-8 flex items-end justify-between gap-5 max-sm:flex-col max-sm:items-start">
      <div>
        {eyebrow && (
          <p className="mb-2.5 font-mono text-[9px] tracking-[0.12em] text-muted-foreground uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="text-3xl font-semibold tracking-[-0.045em] max-sm:text-[26px]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {action &&
        (actionHref ? (
          <Link
            href={actionHref}
            className={cn(buttonVariants({ size: "lg" }), actionClassName)}
          >
            {actionIcon ?? <Plus className="size-3.5" />}
            {action}
          </Link>
        ) : (
          <Button
            type="button"
            size="lg"
            onClick={onAction}
            disabled={actionDisabled}
            className={actionClassName}
          >
            {actionLoading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              (actionIcon ?? <Plus className="size-3.5" />)
            )}
            {action}
          </Button>
        ))}
    </div>
  )
}
