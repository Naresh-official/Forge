"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertCircle,
  ArrowUpRight,
  ExternalLink,
  GitBranch,
  RefreshCw,
  Rocket,
} from "lucide-react"
import { useRouter } from "next/navigation"
import {
  listProjectDeployments,
  listProjects,
  redeployProject,
} from "@forge/api-client/project"
import { getProjectResources } from "@forge/api-client/resources"
import type { ProjectDeploymentItem } from "@forge/types/project"
import { Alert, AlertTitle } from "@forge/ui/components/alert"
import { Badge } from "@forge/ui/components/badge"
import { Button } from "@forge/ui/components/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@forge/ui/components/card"
import { Progress } from "@forge/ui/components/progress"
import { Skeleton } from "@forge/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@forge/ui/components/table"
import {
  formatCpu,
  formatMemory,
  planForAllocation,
} from "@/lib/resource-format"
import {
  formatDeploymentDuration,
  formatRelativeTime,
  isDeploymentActive,
} from "@/lib/deployment-format"
import { PageHeader, StatusBadge } from "../../../_components/ui"
import { useToast } from "../../../_components/toast-provider"
import { ProjectHeader } from "./project-header"

/** How often the overview refreshes while a deployment is in flight. */
const ACTIVE_REFETCH_INTERVAL_MS = 5_000
/** How often live resource usage is re-read. */
const RESOURCES_REFETCH_INTERVAL_MS = 60_000
/** Deployments listed in the "Latest deployments" card. */
const RECENT_DEPLOYMENTS = 5

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[9px] text-muted-foreground">{label}</span>
      <strong className="text-[11px] font-medium">{value}</strong>
    </div>
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

/** One live metric: the percentage of what the workload was granted. */
function UsageTile({
  label,
  percent,
  detail,
  progress,
}: {
  label: string
  percent: string
  detail: string
  progress?: number | null
}) {
  return (
    <div className="rounded-md border border-border p-3">
      <span className="text-[9px] text-muted-foreground">{label}</span>
      <strong className="mt-2 block font-mono text-lg">{percent}</strong>
      <small className="mt-1 block text-[9px] text-muted-foreground">
        {detail}
      </small>
      {progress !== null && progress !== undefined && (
        <Progress
          value={Math.min(100, Math.max(0, progress))}
          className="mt-2 block"
        />
      )}
    </div>
  )
}

export function ProjectOverview({ projectId }: { projectId: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { notify } = useToast()

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: listProjects,
  })

  const deploymentsQuery = useQuery({
    queryKey: ["project-deployments", projectId],
    queryFn: () => listProjectDeployments(projectId),
    // Builds and rollouts finish asynchronously — poll only while one runs.
    refetchInterval: (query) =>
      query.state.data?.data.some((deployment) =>
        isDeploymentActive(deployment.status)
      )
        ? ACTIVE_REFETCH_INTERVAL_MS
        : false,
  })

  const resourcesQuery = useQuery({
    queryKey: ["project-resources", projectId],
    queryFn: () => getProjectResources(projectId),
    refetchInterval: RESOURCES_REFETCH_INTERVAL_MS,
  })

  const deployMutation = useMutation({
    mutationFn: () => redeployProject(projectId),
    onSuccess: (response) => {
      notify(
        `Deployment #${response.data.deploymentNumber} queued — building the latest commit`
      )
      void queryClient.invalidateQueries({
        queryKey: ["project-deployments", projectId],
      })
      void queryClient.invalidateQueries({ queryKey: ["projects"] })
      void queryClient.invalidateQueries({
        queryKey: ["project-resources", projectId],
      })
    },
    onError: (error: Error) => notify(error.message),
  })

  const project = projectsQuery.data?.data.find((item) => item.id === projectId)
  const deployments = deploymentsQuery.data?.data ?? []
  const latest = deployments[0]
  const recent = deployments.slice(0, RECENT_DEPLOYMENTS)
  const resources = resourcesQuery.data?.data
  const plan = resources?.allocation
    ? planForAllocation(resources.allocation)
    : null

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
        title="Project overview"
        description="What is deployed, what it is using, and what shipped recently."
        action="Deploy"
        actionIcon={<Rocket className="size-3.5" />}
        actionDisabled={
          !latest || deploymentsQuery.isLoading || deployMutation.isPending
        }
        actionLoading={deployMutation.isPending}
        onAction={() => {
          if (deployMutation.isPending) return
          deployMutation.mutate()
        }}
      />

      <section className="mb-3 grid grid-cols-2 gap-3 max-lg:grid-cols-1">
        <Card className="[--card-spacing:--spacing(4.5)]">
          <CardHeader>
            <CardTitle className="text-xs">Production deployment</CardTitle>
            <CardDescription className="text-sm">
              {latest
                ? latest.commitMessage || "No commit message"
                : "No deployments yet."}
            </CardDescription>
            {latest && (
              <CardAction>
                <StatusBadge status={latest.status} />
              </CardAction>
            )}
          </CardHeader>
          <CardContent className="mt-5 grid grid-cols-2 gap-5">
            <Info
              label="Deployment"
              value={latest ? `#${latest.deploymentNumber}` : "—"}
            />
            <Info
              label="Commit"
              value={latest ? latest.commitSha.slice(0, 7) : "—"}
            />
            <Info label="Branch" value={latest?.branch ?? "—"} />
            <Info
              label="Duration"
              value={latest ? formatDeploymentDuration(latest) : "—"}
            />
          </CardContent>
          <CardContent className="mt-5 flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!latest}
              onClick={() =>
                latest &&
                router.push(`/projects/${projectId}/deployments/${latest.id}`)
              }
              className="gap-2"
            >
              Open <ExternalLink className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!latest || deployMutation.isPending}
              onClick={() => deployMutation.mutate()}
            >
              Redeploy
            </Button>
          </CardContent>
        </Card>

        <Card className="[--card-spacing:--spacing(4.5)]">
          <CardHeader>
            <CardTitle className="text-xs">Resource overview</CardTitle>
            <CardDescription className="text-sm">
              Current allocation and usage
            </CardDescription>
            {resources && (
              <CardAction>
                <Badge variant="outline" className="gap-1.5 px-2 py-1">
                  {resources.runtime === "STATIC"
                    ? "Static"
                    : (plan?.label ?? "Custom")}
                </Badge>
              </CardAction>
            )}
          </CardHeader>
          <CardContent className="mt-5">
            {resourcesQuery.isLoading && (
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-24 w-full" />
                ))}
              </div>
            )}

            {!resourcesQuery.isLoading && resourcesQuery.isError && (
              <InlineError
                message="Could not load this project's resources."
                onRetry={() => resourcesQuery.refetch()}
              />
            )}

            {resources?.runtime === "STATIC" && (
              <div className="grid grid-cols-2 gap-2">
                <UsageTile
                  label="CPU"
                  percent="—"
                  detail="served from object storage"
                />
                <UsageTile
                  label="Memory"
                  percent="—"
                  detail="no Kubernetes workload"
                />
              </div>
            )}

            {resources && resources.runtime !== "STATIC" && (
              <div className="grid grid-cols-2 gap-2">
                <UsageTile
                  label="CPU"
                  percent={
                    resources.cpu.percent === null
                      ? "—"
                      : `${resources.cpu.percent}%`
                  }
                  detail={
                    resources.allocation
                      ? `${formatCpu(resources.cpu.used)} of ${formatCpu(
                          resources.allocation.cpuMillicores
                        )} per replica`
                      : "no allocation recorded"
                  }
                  progress={resources.cpu.percent}
                />
                <UsageTile
                  label="Memory"
                  percent={
                    resources.memory.percent === null
                      ? "—"
                      : `${resources.memory.percent}%`
                  }
                  detail={
                    resources.allocation
                      ? `${formatMemory(
                          resources.memory.used
                        )} of ${formatMemory(
                          resources.allocation.memoryMb
                        )} per replica`
                      : "no allocation recorded"
                  }
                  progress={resources.memory.percent}
                />
                <UsageTile
                  label="Replicas"
                  percent={`${resources.replicas.ready}/${resources.replicas.desired}`}
                  detail={
                    resources.autoscaling
                      ? `autoscales ${resources.autoscaling.minReplicas}–${resources.autoscaling.maxReplicas}`
                      : "fixed replica count"
                  }
                />
                <UsageTile
                  label="Plan"
                  percent={plan?.label ?? "Custom"}
                  detail={
                    resources.allocation
                      ? `${formatCpu(
                          resources.allocation.cpuMillicores
                        )} · ${formatMemory(resources.allocation.memoryMb)}`
                      : "not recorded"
                  }
                />
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Card className="[--card-spacing:--spacing(4.5)]">
        <CardHeader>
          <CardTitle className="text-xs">Latest deployments</CardTitle>
          <CardDescription className="text-sm">
            Recent activity for {project.name}
          </CardDescription>
          <CardAction>
            <Button
              type="button"
              variant="link"
              onClick={() => router.push(`/projects/${project.id}/deployments`)}
              className="gap-1 text-sm"
            >
              View all <ArrowUpRight className="size-3.5" />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {deploymentsQuery.isLoading && (
            <div className="space-y-1.5">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-11 w-full" />
              ))}
            </div>
          )}

          {!deploymentsQuery.isLoading && deploymentsQuery.isError && (
            <InlineError
              message="Could not load this project's deployments."
              onRetry={() => deploymentsQuery.refetch()}
            />
          )}

          {!deploymentsQuery.isLoading &&
            !deploymentsQuery.isError &&
            recent.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Rocket className="size-5 text-muted-foreground" />
                <h3 className="text-[11px] text-foreground">
                  No deployments yet
                </h3>
                <p className="max-w-sm text-[9px] text-muted-foreground">
                  Deploy the project to create its first build.
                </p>
              </div>
            )}

          {recent.length > 0 && (
            <DeploymentRows
              deployments={recent}
              onSelect={(deployment) =>
                router.push(
                  `/projects/${projectId}/deployments/${deployment.id}`
                )
              }
            />
          )}
        </CardContent>
      </Card>
    </>
  )
}

function DeploymentRows({
  deployments,
  onSelect,
}: {
  deployments: ProjectDeploymentItem[]
  onSelect: (deployment: ProjectDeploymentItem) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {[
            "Status",
            "Deployment",
            "Branch",
            "Commit",
            "Duration",
            "Created",
          ].map((heading) => (
            <TableHead
              key={heading}
              className="px-3 text-[9px] tracking-widest text-muted-foreground uppercase"
            >
              {heading}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {deployments.map((deployment) => (
          <TableRow
            key={deployment.id}
            tabIndex={0}
            onClick={() => onSelect(deployment)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                onSelect(deployment)
              }
            }}
            className="cursor-pointer focus-visible:bg-primary/[.035] focus-visible:outline-none"
          >
            <TableCell className="px-3 py-3">
              <StatusBadge status={deployment.status} />
            </TableCell>

            <TableCell className="px-3 py-3">
              <strong className="text-[11px]">
                #{deployment.deploymentNumber}
              </strong>
              <small className="mt-1 block max-w-64 truncate text-[9px] text-muted-foreground">
                {deployment.commitMessage || "No commit message"}
              </small>
            </TableCell>

            <TableCell className="px-3 py-3 font-mono text-sm text-muted-foreground">
              <GitBranch className="mr-1 inline size-3.5" />
              {deployment.branch}
            </TableCell>

            <TableCell className="px-3 py-3 font-mono text-sm text-primary">
              {deployment.commitSha.slice(0, 7)}
            </TableCell>

            <TableCell className="px-3 py-3 text-[11px]">
              {formatDeploymentDuration(deployment)}
            </TableCell>

            <TableCell className="px-3 py-3 text-sm text-muted-foreground">
              <span title={new Date(deployment.createdAt).toLocaleString()}>
                {formatRelativeTime(deployment.createdAt)}
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
