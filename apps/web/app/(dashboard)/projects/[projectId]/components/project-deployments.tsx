"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertCircle, GitBranch, RefreshCw, Rocket } from "lucide-react"
import { useRouter } from "next/navigation"
import {
  listProjectDeployments,
  listProjects,
  redeployProject,
} from "@forge/api-client/project"
import { Alert, AlertTitle } from "@forge/ui/components/alert"
import { Button } from "@forge/ui/components/button"
import { Card } from "@forge/ui/components/card"
import { Skeleton } from "@forge/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@forge/ui/components/table"
import { PageHeader, StatusBadge } from "../../../_components/ui"
import { useToast } from "../../../_components/toast-provider"
import {
  formatDeploymentDuration,
  formatRelativeTime,
  isDeploymentActive,
} from "@/lib/deployment-format"
import { ProjectHeader } from "./project-header"

/** How often the list refreshes while a deployment is in flight. */
const ACTIVE_REFETCH_INTERVAL_MS = 5_000

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

export function ProjectDeployments({ projectId }: { projectId: string }) {
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
      // The running deployment (and its metrics) is about to change.
      void queryClient.invalidateQueries({
        queryKey: ["project-resources", projectId],
      })
    },
    onError: (error: Error) => notify(error.message),
  })

  const project = projectsQuery.data?.data.find((item) => item.id === projectId)
  const deployments = deploymentsQuery.data?.data ?? []
  const hasDeployments = deployments.length > 0

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
        title="Deployments"
        description="Deployment history for this project. Deploy rebuilds the latest commit with the project's current settings."
        action="Deploy"
        actionIcon={<Rocket className="size-3.5" />}
        actionDisabled={
          !hasDeployments ||
          deploymentsQuery.isLoading ||
          deployMutation.isPending
        }
        actionLoading={deployMutation.isPending}
        onAction={() => {
          if (deployMutation.isPending) return
          deployMutation.mutate()
        }}
      />

      {deploymentsQuery.isLoading && (
        <div className="space-y-1.5">
          {Array.from({ length: 4 }).map((_, index) => (
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
        !hasDeployments && (
          <Card className="flex flex-col items-center gap-2 border border-dashed border-border px-4 py-10 text-center ring-0">
            <Rocket className="size-5 text-muted-foreground" />
            <h3 className="text-[11px] text-foreground">No deployments yet</h3>
            <p className="max-w-sm text-[9px] text-muted-foreground">
              This project&apos;s first deployment is created when you deploy it
              from the project wizard.
            </p>
          </Card>
        )}

      {hasDeployments && (
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
                onClick={() =>
                  router.push(
                    `/projects/${projectId}/deployments/${deployment.id}`
                  )
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    router.push(
                      `/projects/${projectId}/deployments/${deployment.id}`
                    )
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
      )}

      {hasDeployments && (
        <p className="mt-3 text-[9px] text-muted-foreground">
          Running deployments refresh automatically every 5s.
        </p>
      )}
    </>
  )
}
