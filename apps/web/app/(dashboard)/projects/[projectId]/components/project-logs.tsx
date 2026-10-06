"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { AlertCircle, RefreshCw } from "lucide-react"
import { listProjectDeployments, listProjects } from "@forge/api-client/project"
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
      <div className="flex min-h-60 flex-col items-center justify-center gap-3 rounded-lg border border-rose-500/20 bg-rose-500/5 p-8 text-center">
        <AlertCircle className="size-6 text-rose-400" />
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Failed to load logs
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            This project could not be loaded from the API.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void projectsQuery.refetch()
            void deploymentsQuery.refetch()
          }}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
        >
          <RefreshCw className="size-3.5" />
          Retry
        </button>
      </div>
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
                <button
                  key={deployment.id}
                  type="button"
                  onClick={() => setSelectedId(deployment.id)}
                  className={[
                    "flex items-center gap-2 rounded-md border px-2.5 py-1.5 font-mono text-[10px] transition-colors",
                    isActive
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  <span>#{deployment.deploymentNumber}</span>
                  <span className="max-w-32 truncate">{deployment.branch}</span>
                  <StatusBadge status={deployment.status} />
                </button>
              )
            })}
          </div>
          <DeploymentLogs key={selected.id} deploymentId={selected.id} />
        </>
      )}
    </>
  )
}
