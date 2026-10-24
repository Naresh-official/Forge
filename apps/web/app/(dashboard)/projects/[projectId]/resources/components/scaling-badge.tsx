import { Badge } from "@forge/ui/components/badge"
import { cn } from "@forge/ui/lib/utils"

const STEADY = "text-emerald-400"
const TRANSITIONING = ["Scaling up", "Scaling down", "At maximum replicas"]

/** Autoscaler state as a badge; colours follow the same scale as statuses. */
export function ScalingBadge({ status }: { status: string }) {
  const tone =
    status === "Steady"
      ? STEADY
      : TRANSITIONING.includes(status)
        ? "text-amber-400"
        : "text-rose-400"

  return (
    <Badge variant="outline" className={cn("gap-1.5 px-2 py-1", tone)}>
      <span
        className={cn(
          "size-1.5 rounded-full",
          tone === STEADY
            ? "bg-emerald-400"
            : tone === "text-amber-400"
              ? "bg-amber-400"
              : "bg-rose-400"
        )}
      />
      {status}
    </Badge>
  )
}
