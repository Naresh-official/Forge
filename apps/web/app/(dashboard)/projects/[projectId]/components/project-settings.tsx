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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@forge/ui/components/alert-dialog"
import { Alert, AlertTitle } from "@forge/ui/components/alert"
import { Button } from "@forge/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@forge/ui/components/card"
import { Input } from "@forge/ui/components/input"
import { Label } from "@forge/ui/components/label"
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
      <Alert
        variant="destructive"
        className="flex min-h-60 flex-col items-center justify-center gap-3 border-rose-500/20 bg-rose-500/5 p-8 text-center"
      >
        <AlertCircle className="size-6 text-rose-400" />
        <div className="grid gap-1">
          <AlertTitle className="text-sm font-semibold text-foreground">
            Failed to load settings
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
        <Alert className="mb-4 flex items-center gap-2 border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-[11px] text-amber-300">
          <Pause className="size-3.5" />
          <AlertTitle className="text-[11px] font-normal text-inherit">
            This project is paused — its workload is scaled to zero.
          </AlertTitle>
        </Alert>
      )}

      <Card className="max-w-2xl [--card-spacing:--spacing(4.5)]">
        <CardHeader>
          <CardTitle className="text-xs">General</CardTitle>
        </CardHeader>
        <CardContent className="mt-4 grid gap-4">
          <Label className="flex-col items-start gap-1.5 text-sm font-normal text-muted-foreground">
            Project name
            <Input
              value={name}
              onChange={(e) => setDraftName(e.target.value)}
              disabled={renameMutation.isPending}
              className="h-auto py-2 text-[11px]"
            />
          </Label>

          {renameMutation.isError && (
            <InlineError message="Could not rename the project. Please try again." />
          )}

          <Button
            type="button"
            size="lg"
            disabled={!canRename}
            onClick={() => renameMutation.mutate(trimmedName)}
            className="w-fit gap-2 text-[11px] font-bold"
          >
            {renameMutation.isPending && (
              <Loader2 className="size-3.5 animate-spin" />
            )}
            Save changes
          </Button>
        </CardContent>
      </Card>

      <Card className="mt-4 max-w-2xl [--card-spacing:--spacing(4.5)]">
        <CardHeader>
          <CardTitle className="text-xs">Availability</CardTitle>
          <CardDescription className="text-[11px]">
            Pausing scales the running workload to zero. Resuming brings it back
            to one replica (or lets autoscaling take over).
          </CardDescription>
        </CardHeader>
        <CardContent className="mt-4">
          <div className="flex items-center gap-3">
            <StatusBadge status={project.status} />
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={statusMutation.isPending}
              onClick={() =>
                statusMutation.mutate(isPaused ? "ACTIVE" : "PAUSED")
              }
              className="gap-2 text-[11px] font-medium"
            >
              {statusMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : isPaused ? (
                <Play className="size-3.5" />
              ) : (
                <Pause className="size-3.5" />
              )}
              {isPaused ? "Resume project" : "Pause project"}
            </Button>
          </div>
          {statusMutation.isError && (
            <InlineError message="Could not update the project's workload. Please try again." />
          )}
        </CardContent>
      </Card>

      <Card className="mt-4 max-w-2xl border border-rose-500/20 bg-rose-500/[.03] ring-0 [--card-spacing:--spacing(4.5)]">
        <CardHeader>
          <CardTitle className="text-xs text-rose-300">Danger zone</CardTitle>
          <CardDescription className="text-[11px]">
            Deleting a project removes it and all of its deployments. This
            cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="mt-4">
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  variant="outline"
                  className="gap-2 border-rose-500/40 bg-rose-500/10 text-[11px] font-medium text-rose-300 hover:bg-rose-500/20"
                />
              }
            >
              <Trash2 className="size-3.5" />
              Delete project
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this project?</AlertDialogTitle>
                <AlertDialogDescription>
                  Deleting “{project.name}” removes it and all of its
                  deployments. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleteMutation.isPending}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate()}
                  className="gap-2"
                >
                  {deleteMutation.isPending && (
                    <Loader2 className="size-3.5 animate-spin" />
                  )}
                  Confirm delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
        {deleteMutation.isError && (
          <CardContent>
            <InlineError message="Could not delete the project. Please try again." />
          </CardContent>
        )}
      </Card>
    </>
  )
}

function InlineError({ message }: { message: string }) {
  return (
    <Alert
      variant="destructive"
      className="flex items-center gap-1.5 rounded-md border-rose-500/20 bg-rose-500/5 px-3 py-2 text-[11px] text-rose-300"
    >
      <AlertCircle className="size-3.5 shrink-0" />
      <AlertTitle className="text-[11px] font-normal text-inherit">
        {message}
      </AlertTitle>
    </Alert>
  )
}
