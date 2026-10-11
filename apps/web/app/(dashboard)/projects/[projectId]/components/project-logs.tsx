"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { AlertCircle, RefreshCw } from "lucide-react"
import { listProjectDeployments, listProjects } from "@forge/api-client/project"
import { Alert, AlertTitle } from "@forge/ui/components/alert"
import { Button } from "@forge/ui/components/button"
import { cn } from "@forge/ui/lib/utils"
import { EmptyState, PageHeader, StatusBadge } from "../../../_components/ui"
import { ProjectHeader } from "./project-header"
import { DeploymentLogs } from "./deployment-logs"

export function ProjectLogs({ projectId }: { projectId: string }) {
  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: listProjects,
  })

  const deploymentsQuery = useQuery({
    queryKey: ["project-deployments", projectId],
    queryFn: () => listProjectDeployments(projectId),
  })

  // Which deployment's logs are shown. Defaults to the newest one.
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const project = projectsQuery.data?.data.find((p) => p.id === projectId)
  const deployments = deploymentsQuery.data?.data ?? []
  const selected =
    deployments.find((d) => d.id === selectedId) ?? deployments[0]

  if (projectsQuery.isLoading || deploymentsQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading logs…</p>
  }

  if (projectsQuery.isError || deploymentsQuery.isError) {
    return (
      <Alert
        variant="destructive"
        className="flex min-h-60 flex-col items-center justify-center gap-3 border-rose-500/20 bg-rose-500/5 p-8 text-center"
      >
        <AlertCircle className="size-6 text-rose-400" />
        <div className="grid gap-1">
          <AlertTitle className="text-sm font-semibold text-foreground">
            Failed to load logs
          </AlertTitle>
          <p className="text-xs text-muted-foreground">
            This project could not be loaded from the API.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            void projectsQuery.refetch()
            void deploymentsQuery.refetch()
          }}
          className="gap-1.5 text-xs"
        >
          <RefreshCw className="size-3.5" />
          Retry
        </Button>
      </Alert>
    )
  }

  if (!project) {
    return <div>Project not found.</div>
  }

  return (
    <>
      <ProjectHeader
        project={{
          id: project.id,
          name: project.name,
          // `deployments` is the latest deployment summary (or undefined).
          status: project.deployments?.status,
          repo: project.githubRepository?.fullName ?? project.slug,
          url: `${project.slug}.forge.run`,
        }}
      />
      <PageHeader
        title="Logs"
        description="Build and runtime logs for this project."
      />

      {deployments.length === 0 || !selected ? (
        <EmptyState title="No deployments yet" />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {deployments.map((deployment) => {
              const isActive = deployment.id === selected.id
              return (
                <Button
                  key={deployment.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedId(deployment.id)}
                  className={cn(
                    "gap-2 px-2.5 py-1.5 font-mono text-[10px] transition-colors",
                    isActive
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span>#{deployment.deploymentNumber}</span>
                  <span className="max-w-32 truncate">{deployment.branch}</span>
                  <StatusBadge status={deployment.status} />
                </Button>
              )
            })}
          </div>
          <DeploymentLogs
            key={selected.id}
            deploymentId={selected.id}
            status={selected.status}
          />
        </>
      )}
    </>
  )
}
