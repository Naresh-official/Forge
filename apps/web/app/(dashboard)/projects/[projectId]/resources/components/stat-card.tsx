import { Card, CardContent } from "@forge/ui/components/card"
import { Progress } from "@forge/ui/components/progress"

/** Read-only number card with an optional hint and progress bar. */
export function StatCard({
  label,
  icon,
  value,
  hint,
  progress,
}: {
  label: string
  icon: React.ReactNode
  value: string
  hint?: string
  progress?: number | null
}) {
  return (
    <Card size="sm">
      <CardContent>
        <span className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
          {icon}
          {label}
        </span>
        <strong className="mt-2 block font-mono text-lg">{value}</strong>
        {hint && (
          <small className="mt-1 block text-[9px] text-muted-foreground">
            {hint}
          </small>
        )}
        {progress !== null && progress !== undefined && (
          <Progress
            value={Math.min(100, Math.max(0, progress))}
            className="mt-2 block"
          />
        )}
      </CardContent>
    </Card>
  )
}
