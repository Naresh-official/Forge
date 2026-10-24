import type { ProjectAutoscalingStatus } from "@forge/types/resources"
import { Card, CardContent } from "@forge/ui/components/card"
import { ScalingBadge } from "./scaling-badge"

/** Autoscaler status, CPU target and replica range for a project. */
export function AutoscalingPanel({
  autoscaling,
}: {
  autoscaling: ProjectAutoscalingStatus
}) {
  return (
    <Card className="mt-2.5">
      <CardContent className="flex flex-wrap items-center gap-4">
        <div className="flex flex-1 flex-col gap-1">
          <span className="text-[9px] text-muted-foreground">
            Scaling status
          </span>
          <div className="flex items-center gap-2">
            <ScalingBadge status={autoscaling.status} />
            <span className="text-[11px] text-muted-foreground">
              {autoscaling.message}
            </span>
          </div>
        </div>
        <div className="flex gap-6">
          <div className="flex flex-col gap-1">
            <span className="text-[9px] text-muted-foreground">CPU target</span>
            <strong className="font-mono text-sm">
              {autoscaling.targetCpuUtilization}%
            </strong>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[9px] text-muted-foreground">
              Current CPU
            </span>
            <strong className="font-mono text-sm">
              {autoscaling.currentCpuUtilization === null
                ? "—"
                : `${autoscaling.currentCpuUtilization}%`}
            </strong>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[9px] text-muted-foreground">
              Replica range
            </span>
            <strong className="font-mono text-sm">
              {autoscaling.minReplicas}–{autoscaling.maxReplicas}
            </strong>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
