"use client"

import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  AlertCircle,
  Boxes,
  Clock3,
  Cpu,
  Gauge,
  HardDrive,
  MemoryStick,
  RefreshCw,
} from "lucide-react"
import { getProjectResources } from "@forge/api-client/resources"
import { listProjects } from "@forge/api-client/project"
import type {
  ProjectAutoscalingStatus,
  ResourceUsage,
} from "@forge/types/resources"
import { Alert, AlertTitle } from "@forge/ui/components/alert"
import { Badge } from "@forge/ui/components/badge"
import { Button } from "@forge/ui/components/button"
import { Card, CardContent } from "@forge/ui/components/card"
import { Progress } from "@forge/ui/components/progress"
import { Skeleton } from "@forge/ui/components/skeleton"
import { cn } from "@forge/ui/lib/utils"
import {
  formatCpu,
  formatMemory,
  planForAllocation,
} from "@/lib/resource-format"
import { PageHeader } from "../../../_components/ui"
import { ProjectHeader } from "./project-header"

/** How often the tab re-reads live usage from the API. */
const REFETCH_INTERVAL_MS = 60_000

/** "60s" reads badly for the polling hint — say "minute" from 60s up. */
function formatInterval(ms: number) {
  const seconds = ms / 1000
  return seconds >= 60 && seconds % 60 === 0
    ? `${seconds / 60} min`
    : `${seconds}s`
}

/**
 * "Updated 12s ago" tag. Ticks every second so the age stays truthful
 * between the refetches.
 */
function LastUpdated({ timestamp }: { timestamp: number }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const seconds = Math.max(0, Math.round((now - timestamp) / 1000))
  const relative =
    seconds < 5
      ? "just now"
      : seconds < 60
        ? `${seconds}s ago`
        : `${Math.floor(seconds / 60)}m ago`

  return (
    <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
      <Clock3 className="size-3" />
      Updated {relative}
      <span className="text-muted-foreground/60">
        · refreshes every {formatInterval(REFETCH_INTERVAL_MS)}
      </span>
    </span>
  )
}

/**
 * One resource's usage. Fixed-size projects lead with the percentage of the
 * allocation consumed; autoscaled ones lead with the absolute usage, since
 * the allocation itself moves with the replica count.
 */
function UsageCard({
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

function StatCard({
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

/** Autoscaler state as a badge; colours follow the same scale as statuses. */
function ScalingBadge({ status }: { status: string }) {
  const tone =
    status === "Steady"
      ? "text-emerald-400"
      : status === "Scaling up" ||
          status === "Scaling down" ||
          status === "At maximum replicas"
        ? "text-amber-400"
        : "text-rose-400"

  return (
    <Badge variant="outline" className={cn("gap-1.5 px-2 py-1", tone)}>
      <span
        className={cn(
          "size-1.5 rounded-full",
          tone === "text-emerald-400"
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

function AutoscalingPanel({
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

function InlineError({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <Alert
      variant="destructive"
      className="mt-3 flex items-center gap-2 rounded-md border-rose-500/20 bg-rose-500/5 px-3 py-2.5 text-[11px] text-rose-300"
    >
      <AlertCircle className="size-3.5 shrink-0" />
      <AlertTitle className="flex-1 text-[11px] font-normal text-inherit">
        {message}
      </AlertTitle>
      {onRetry && (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={onRetry}
          className="shrink-0 gap-1 text-rose-200 hover:bg-transparent hover:text-rose-100"
        >
          <RefreshCw className="size-3" />
          Retry
        </Button>
      )}
    </Alert>
  )
}

export function ProjectResources({ projectId }: { projectId: string }) {
  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: listProjects,
  })

  const resourcesQuery = useQuery({
    queryKey: ["project-resources", projectId],
    queryFn: () => getProjectResources(projectId),
    // Live usage: poll instead of relying on user-triggered refreshes.
    refetchInterval: REFETCH_INTERVAL_MS,
  })

  const project = projectsQuery.data?.data.find((item) => item.id === projectId)
  const resources = resourcesQuery.data?.data

  if (projectsQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading project…</p>
  }

  if (projectsQuery.isError || !project) {
    return (
      <Alert
        variant="destructive"
        className="flex min-h-60 flex-col items-center justify-center gap-3 border-rose-500/20 bg-rose-500/5 p-8 text-center"
      >
        <AlertCircle className="size-6 text-rose-400" />
        <div className="grid gap-1">
          <AlertTitle className="text-sm font-semibold text-foreground">
            Failed to load the project
          </AlertTitle>
          <p className="text-xs text-muted-foreground">
            This project could not be loaded from the API.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => projectsQuery.refetch()}
          className="gap-1.5 text-xs"
        >
          <RefreshCw className="size-3.5" />
          Retry
        </Button>
      </Alert>
    )
  }

  const planLabel = resources?.allocation
    ? (planForAllocation(resources.allocation)?.label ?? null)
    : null

  return (
    <>
      <ProjectHeader
        project={{
          id: project.id,
          name: project.name,
          status: project.status,
          repo: project.githubRepository?.fullName ?? project.slug,
          url: `${project.slug}.forge.run`,
        }}
      />
      <PageHeader
        title="Resources"
        description="What this deployment was granted, and what it is using right now."
      />

      <div className="mb-4 flex items-center justify-between gap-3">
        {resourcesQuery.dataUpdatedAt > 0 ? (
          <LastUpdated timestamp={resourcesQuery.dataUpdatedAt} />
        ) : (
          <span />
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={resourcesQuery.isFetching}
          onClick={() => resourcesQuery.refetch()}
          className="gap-1.5 text-[11px]"
          title="Refresh resource usage metrics"
        >
          <RefreshCw
            className={cn(
              "size-3",
              resourcesQuery.isFetching && "animate-spin"
            )}
          />
          Refresh
        </Button>
      </div>

      {resourcesQuery.isLoading && (
        <div className="grid grid-cols-4 gap-2.5 max-lg:grid-cols-2 max-sm:grid-cols-1">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full" />
          ))}
        </div>
      )}

      {!resourcesQuery.isLoading && resourcesQuery.isError && (
        <InlineError
          message="Could not load this project's resources."
          onRetry={() => resourcesQuery.refetch()}
        />
      )}

      {resources && (
        <>
          {resources.warnings.length > 0 && (
            <Alert className="mb-3 flex items-start gap-2 rounded-md border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-[11px] text-amber-300">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              <AlertTitle className="flex flex-col gap-1 text-[11px] font-normal text-inherit">
                {resources.warnings.map((warning) => (
                  <span key={warning}>{warning}</span>
                ))}
              </AlertTitle>
            </Alert>
          )}

          {resources.runtime === "STATIC" ? (
            <Card className="flex flex-col items-center gap-2 border border-dashed border-border px-4 py-10 text-center ring-0">
              <HardDrive className="size-5 text-muted-foreground" />
              <h3 className="text-[11px] text-foreground">Static deployment</h3>
              <p className="max-w-sm text-[9px] text-muted-foreground">
                This project is served from object storage. No Kubernetes
                workload is provisioned, so there is no live CPU or memory usage
                to report.
              </p>
            </Card>
          ) : (
            <>
              <div className="mb-2.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                {resources.allocation ? (
                  <>
                    <Badge variant="outline" className="gap-1.5 px-2 py-1">
                      {planLabel ?? "Custom"} plan
                    </Badge>
                    <span>
                      {formatCpu(resources.allocation.cpuMillicores)} CPU ·{" "}
                      {formatMemory(resources.allocation.memoryMb)} memory ·{" "}
                      {formatMemory(resources.allocation.ephemeralStorageMb)}{" "}
                      storage per replica
                    </span>
                  </>
                ) : (
                  <span>No resource plan recorded for this deployment.</span>
                )}
              </div>

              <div className="grid grid-cols-4 gap-2.5 max-lg:grid-cols-2 max-sm:grid-cols-1">
                {resources.autoscalingEnabled && resources.autoscaling ? (
                  <>
                    <UsageCard
                      label="CPU usage"
                      icon={<Cpu className="size-3" />}
                      usage={resources.cpu}
                      format={formatCpu}
                      showAmount
                    />
                    <StatCard
                      label="CPU target"
                      icon={<Gauge className="size-3" />}
                      value={`${resources.autoscaling.targetCpuUtilization}%`}
                      hint={
                        resources.autoscaling.currentCpuUtilization === null
                          ? "no reading yet"
                          : `${resources.autoscaling.currentCpuUtilization}% current`
                      }
                      progress={resources.autoscaling.currentCpuUtilization}
                    />
                    <UsageCard
                      label="Memory usage"
                      icon={<MemoryStick className="size-3" />}
                      usage={resources.memory}
                      format={formatMemory}
                      showAmount
                    />
                    <StatCard
                      label="Active replicas"
                      icon={<Boxes className="size-3" />}
                      value={`${resources.replicas.ready}/${resources.replicas.desired}`}
                      hint={`autoscales ${resources.autoscaling.minReplicas}–${resources.autoscaling.maxReplicas}`}
                    />
                  </>
                ) : (
                  <>
                    <UsageCard
                      label="CPU usage"
                      icon={<Cpu className="size-3" />}
                      usage={resources.cpu}
                      format={formatCpu}
                    />
                    <UsageCard
                      label="Memory usage"
                      icon={<MemoryStick className="size-3" />}
                      usage={resources.memory}
                      format={formatMemory}
                    />
                    <StatCard
                      label="Ephemeral storage"
                      icon={<HardDrive className="size-3" />}
                      value={
                        resources.allocation
                          ? formatMemory(
                              resources.allocation.ephemeralStorageMb
                            )
                          : "—"
                      }
                      hint="provisioned per replica"
                    />
                    <StatCard
                      label="Active replicas"
                      icon={<Boxes className="size-3" />}
                      value={`${resources.replicas.ready}/${resources.replicas.desired}`}
                      hint="fixed replica count"
                    />
                  </>
                )}
              </div>

              {resources.autoscaling && (
                <AutoscalingPanel autoscaling={resources.autoscaling} />
              )}

              <p className="mt-3 text-[9px] text-muted-foreground">
                {resources.metricsAvailable ? (
                  <>
                    Usage is read from the cluster&apos;s metrics API
                    {resources.metricsTimestamp
                      ? ` (last sample ${new Date(
                          resources.metricsTimestamp
                        ).toLocaleTimeString()})`
                      : ""}
                    . Allocation is what the workload was granted across its
                    replicas.
                  </>
                ) : (
                  "Live usage is unavailable, so only allocation and replica state are shown."
                )}
              </p>
            </>
          )}
        </>
      )}
    </>
  )
}
