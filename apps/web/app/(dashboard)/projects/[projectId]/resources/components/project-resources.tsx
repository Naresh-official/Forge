"use client"

import { useQuery } from "@tanstack/react-query"
import {
  AlertCircle,
  Boxes,
  Cpu,
  Gauge,
  HardDrive,
  MemoryStick,
  RefreshCw,
} from "lucide-react"
import { getProjectResources } from "@forge/api-client/resources"
import { listProjects } from "@forge/api-client/project"
import { Alert, AlertTitle } from "@forge/ui/components/alert"
import { Badge } from "@forge/ui/components/badge"
import { Button } from "@forge/ui/components/button"
import { Card } from "@forge/ui/components/card"
import { Skeleton } from "@forge/ui/components/skeleton"
import { cn } from "@forge/ui/lib/utils"
import {
  formatCpu,
  formatMemory,
  planForAllocation,
} from "@/lib/resource-format"
import { InlineError } from "../../../../_components/inline-error"
import { PageHeader } from "../../../../_components/page-header"
import { ProjectHeader } from "../../components/project-header"
import { AutoscalingPanel } from "./autoscaling-panel"
import { LastUpdated } from "./last-updated"
import { StatCard } from "./stat-card"
import { UsageCard } from "./usage-card"

/** How often the tab re-reads live usage from the API. */
const REFETCH_INTERVAL_MS = 60_000

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
          <LastUpdated
            timestamp={resourcesQuery.dataUpdatedAt}
            intervalMs={REFETCH_INTERVAL_MS}
          />
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
