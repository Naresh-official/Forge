import type { ResourceUsage } from "@forge/types/resources"
import { Card, CardContent } from "@forge/ui/components/card"
import { Progress } from "@forge/ui/components/progress"

/**
 * One resource's usage. Fixed-size projects lead with the percentage of the
 * allocation consumed; autoscaled ones lead with the absolute usage, since
 * the allocation itself moves with the replica count.
 */
export function UsageCard({
  label,
  icon,
  usage,
  format,
  showAmount = false,
}: {
  label: string
  icon: React.ReactNode
  usage: ResourceUsage
  format: (value: number) => string
  showAmount?: boolean
}) {
  const percent = usage.percent
  const clamped = Math.min(100, Math.max(0, percent ?? 0))
  const percentLabel = percent === null ? "—" : `${percent}%`

  return (
    <Card size="sm">
      <CardContent>
        <span className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
          {icon}
          {label}
        </span>
        <strong className="mt-2 block font-mono text-lg">
          {showAmount ? format(usage.used) : percentLabel}
        </strong>
        <small className="mt-1 block text-[9px] text-muted-foreground">
          {showAmount
            ? `${percentLabel} of ${format(usage.allocated)} allocated`
            : `${format(usage.used)} of ${format(usage.allocated)} allocated`}
        </small>
        <Progress value={clamped} className="mt-2 block" />
      </CardContent>
    </Card>
  )
}
