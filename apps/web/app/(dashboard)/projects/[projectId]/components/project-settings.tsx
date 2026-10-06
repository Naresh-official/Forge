"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertCircle,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Trash2,
} from "lucide-react"
import {
  deleteProject,
  listProjects,
  renameProject,
  setProjectStatus,
} from "@forge/api-client/project"
import type { ProjectStatus } from "@forge/types"
import { PageHeader, StatusBadge } from "../../../_components/ui"
import { useToast } from "../../../_components/toast-provider"
import { ProjectHeader } from "./project-header"

export function ProjectSettings({ projectId }: { projectId: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { notify } = useToast()

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: listProjects,
  })

  const project = projectsQuery.data?.data.find((p) => p.id === projectId)

  // `null` means "show the server value" — the user has not edited yet.
  const [draftName, setDraftName] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const invalidateProject = () => {
    void queryClient.invalidateQueries({ queryKey: ["projects"] })
    void queryClient.invalidateQueries({ queryKey: ["project-names"] })
    void queryClient.invalidateQueries({
      queryKey: ["project-deployments", projectId],
    })
  }

  const renameMutation = useMutation({
    mutationFn: (newName: string) => renameProject(projectId, newName),
    onSuccess: () => {
      // Fall back to the refreshed server value after a rename.
      setDraftName(null)
      invalidateProject()
      notify("Project renamed")
    },
  })

  const statusMutation = useMutation({
    mutationFn: (status: ProjectStatus) => setProjectStatus(projectId, status),
    onSuccess: (_data, status) => {
      invalidateProject()
      notify(status === "PAUSED" ? "Project paused" : "Project resumed")
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteProject(projectId),
    onSuccess: (response) => {
      invalidateProject()
      const warnings = response.data.cleanupWarnings
      notify(
        warnings.length > 0
          ? `Project deleted — ${warnings.join(" ")}`
          : "Project deleted"
      )
      router.push("/projects")
    },
  })

  if (projectsQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading settings…</p>
  }

  if (projectsQuery.isError) {
    return (
      <div className="flex min-h-60 flex-col items-center justify-center gap-3 rounded-lg border border-rose-500/20 bg-rose-500/5 p-8 text-center">
        <AlertCircle className="size-6 text-rose-400" />
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Failed to load settings
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            This project could not be loaded from the API.
          </p>
        </div>
        <button
          type="button"
          onClick={() => projectsQuery.refetch()}
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

  const isPaused = project.status === "PAUSED"
  const name = draftName ?? project.name
  const trimmedName = name.trim()
  const canRename =
    trimmedName.length > 0 &&
    trimmedName !== project.name &&
    !renameMutation.isPending

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
        title="Project settings"
        description="Configure project-specific settings."
      />

      {isPaused && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-[11px] text-amber-300">
          <Pause className="size-3.5" />
          This project is paused — its workload is scaled to zero.
        </div>
      )}

      <article className="max-w-2xl rounded-lg border border-border bg-card p-[18px]">
        <h2 className="text-xs font-semibold">General</h2>
        <div className="mt-4 grid gap-4">
          <label className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            Project name
            <input
              value={name}
              onChange={(e) => setDraftName(e.target.value)}
              disabled={renameMutation.isPending}
              className="rounded-md border border-border bg-background px-2.5 py-2 text-[11px] text-foreground outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            />
          </label>

          {renameMutation.isError && (
            <InlineError message="Could not rename the project. Please try again." />
          )}

          <button
            type="button"
            disabled={!canRename}
            onClick={() => renameMutation.mutate(trimmedName)}
            className="inline-flex w-fit items-center gap-2 rounded-md bg-primary px-3 py-2 text-[11px] font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {renameMutation.isPending && (
              <Loader2 className="size-3.5 animate-spin" />
            )}
            Save changes
          </button>
        </div>
      </article>

      <article className="mt-4 max-w-2xl rounded-lg border border-border bg-card p-[18px]">
        <h2 className="text-xs font-semibold">Availability</h2>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Pausing scales the running workload to zero. Resuming brings it back
          to one replica (or lets autoscaling take over).
        </p>
        <div className="mt-4 flex items-center gap-3">
          <StatusBadge status={project.status} />
          <button
            type="button"
            disabled={statusMutation.isPending}
            onClick={() =>
              statusMutation.mutate(isPaused ? "ACTIVE" : "PAUSED")
            }
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-[11px] font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            {statusMutation.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : isPaused ? (
              <Play className="size-3.5" />
            ) : (
              <Pause className="size-3.5" />
            )}
            {isPaused ? "Resume project" : "Pause project"}
          </button>
        </div>
        {statusMutation.isError && (
          <InlineError message="Could not update the project's workload. Please try again." />
        )}
      </article>

      <article className="mt-4 max-w-2xl rounded-lg border border-rose-500/20 bg-rose-500/[.03] p-[18px]">
        <h2 className="text-xs font-semibold text-rose-300">Danger zone</h2>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Deleting a project removes it and all of its deployments. This cannot
          be undone.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {confirmingDelete ? (
            <>
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
                className="inline-flex items-center gap-2 rounded-md bg-rose-600 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-50"
              >
                {deleteMutation.isPending && (
                  <Loader2 className="size-3.5 animate-spin" />
                )}
                Confirm delete
              </button>
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => setConfirmingDelete(false)}
                className="rounded-md border border-border bg-card px-3 py-2 text-[11px]"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="inline-flex items-center gap-2 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] font-medium text-rose-300 hover:bg-rose-500/20"
            >
              <Trash2 className="size-3.5" />
              Delete project
            </button>
          )}
        </div>
        {deleteMutation.isError && (
          <InlineError message="Could not delete the project. Please try again." />
        )}
      </article>
    </>
  )
}

function InlineError({ message }: { message: string }) {
  return (
    <p className="flex items-center gap-1.5 text-[11px] text-rose-300">
      <AlertCircle className="size-3.5 shrink-0" />
      {message}
    </p>
  )
}
