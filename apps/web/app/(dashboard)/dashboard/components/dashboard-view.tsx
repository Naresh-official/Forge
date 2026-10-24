"use client"

import { useMemo } from "react"
import { GitBranch, Rocket } from "lucide-react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { listProjects } from "@forge/api-client/project"
import { Button } from "@forge/ui/components/button"
import { Skeleton } from "@forge/ui/components/skeleton"
import { formatRelativeTime } from "@/lib/deployment-format"
import { DataTable } from "../../_components/data-table"
import {
  formatFramework,
  FrameworkLogo,
} from "../../_components/framework-logo"
import { InlineError } from "../../_components/inline-error"
import { StatusBadge } from "../../_components/status-badge"
import { DashboardUsage } from "./dashboard-usage"

/** Projects listed in the "Recent projects" card. */
const RECENT_PROJECTS = 5

export function DashboardView() {
  const router = useRouter()

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: listProjects,
  })

  const recentProjects = useMemo(
    () => (projectsQuery.data?.data ?? []).slice(0, RECENT_PROJECTS),
    [projectsQuery.data]
  )

  return (
    <>
      <DashboardUsage />

      <article className="rounded-lg border border-border bg-card p-4.5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xs font-semibold">Recent projects</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your most recently updated projects
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/projects")}
          >
            View projects
          </Button>
        </div>

        {projectsQuery.isLoading && (
          <div className="mt-4 space-y-1.5">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-11 w-full" />
            ))}
          </div>
        )}

        {!projectsQuery.isLoading && projectsQuery.isError && (
          <InlineError
            message="Could not load your projects."
            onRetry={() => projectsQuery.refetch()}
          />
        )}

        {!projectsQuery.isLoading &&
          !projectsQuery.isError &&
          recentProjects.length === 0 && (
            <div className="mt-6 flex flex-col items-center gap-2 py-6 text-center">
              <Rocket className="size-5 text-muted-foreground" />
              <h3 className="text-[11px] text-foreground">No projects yet</h3>
              <p className="max-w-sm text-[9px] text-muted-foreground">
                Import a repository to create your first project.
              </p>
              <Button
                type="button"
                size="sm"
                onClick={() => router.push("/projects/new")}
                className="mt-1 text-[11px]"
              >
                New project
              </Button>
            </div>
          )}

        {recentProjects.length > 0 && (
          <DataTable>
            <thead>
              <tr className="text-[9px] tracking-widest text-muted-foreground uppercase">
                {["Project", "Framework", "Branch", "Status", "Updated"].map(
                  (h) => (
                    <th key={h} className="px-3 pb-2 text-left font-semibold">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {recentProjects.map((project) => (
                <tr
                  key={project.id}
                  onClick={() => router.push(`/projects/${project.id}`)}
                  className="cursor-pointer border-t border-border hover:bg-primary/[.035]"
                >
                  <td className="px-3 py-3 text-[11px] font-medium">
                    <span className="mr-2 inline-block size-1.5 rounded-full bg-primary" />
                    {project.name}
                  </td>
                  <td className="px-3 py-3 text-[11px]">
                    <span className="inline-flex items-center gap-1.5 rounded border border-border px-1.5 py-1 text-[9px] text-muted-foreground">
                      <FrameworkLogo
                        framework={project.framework}
                        className="size-3"
                      />
                      {formatFramework(project.framework)}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-mono text-sm text-muted-foreground">
                    <GitBranch className="mr-1 inline size-3.5" />
                    {project.deployments.branch}
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={project.deployments.status} />
                  </td>
                  <td className="px-3 py-3 text-sm text-muted-foreground">
                    <span title={new Date(project.updatedAt).toLocaleString()}>
                      {formatRelativeTime(project.updatedAt)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </article>
    </>
  )
}
