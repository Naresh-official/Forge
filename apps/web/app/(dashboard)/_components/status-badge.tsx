import { Badge } from "@forge/ui/components/badge"
import { cn } from "@forge/ui/lib/utils"

const GOOD_STATUSES = [
  "READY",
  "PRODUCTION",
  "CONFIGURED",
  "ACTIVE",
  "OPERATIONAL",
  "CONNECTED",
  "SUCCESS",
]

const WARN_STATUSES = [
  "BUILDING",
  "DEPLOYING",
  "PREVIEW",
  "VERIFYING",
  "PENDING",
  "QUEUED",
  "PAUSED",
]

/**
 * Coloured status pill. Purely presentational, so it carries no client
 * boundary of its own — it renders in server components too.
 */
export function StatusBadge({ status }: { status?: string }) {
  const norm = (status ?? "").toUpperCase()
  const good = GOOD_STATUSES.includes(norm)
  const warn = WARN_STATUSES.includes(norm)

  const formattedStatus =
    status && status.length > 0
      ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
      : "Unknown"

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 px-2 py-1 text-sm",
        good ? "text-emerald-400" : warn ? "text-amber-400" : "text-rose-400"
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          good ? "bg-emerald-400" : warn ? "bg-amber-400" : "bg-rose-400"
        )}
      />
      {formattedStatus}
    </Badge>
  )
}
