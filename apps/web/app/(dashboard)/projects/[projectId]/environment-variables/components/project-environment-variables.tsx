"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertCircle,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Pencil,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react"
import {
  createProjectEnvironmentVariable,
  deleteProjectEnvironmentVariable,
  listProjectEnvironmentVariables,
  updateProjectEnvironmentVariable,
} from "@forge/api-client/environment"
import { listProjects } from "@forge/api-client/project"
import type { EnvironmentChange } from "@forge/types/environment"
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
import { Card } from "@forge/ui/components/card"
import { Input } from "@forge/ui/components/input"
import { Skeleton } from "@forge/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@forge/ui/components/table"
import { InlineError } from "../../../../_components/inline-error"
import { PageHeader } from "../../../../_components/page-header"
import { useToast } from "../../../../_components/toast-provider"
import { ProjectHeader } from "../../components/project-header"

const ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/
const MASKED_VALUE = "••••••••••••••"

/** Human summary of what the API did to apply a change. */
function changeSummary(change: EnvironmentChange): string {
  switch (change.action) {
    case "REBUILD":
      return "a rebuild of the project was queued"
    case "SECRET_SYNC":
      return change.syncedDeployments > 0
        ? `${change.syncedDeployments} running deployment(s) updated`
        : "no running workload needed updating"
    default:
      return "no workload change was needed"
  }
}

function formatUpdated(value: string | Date) {
  return new Date(value).toLocaleString()
}

export function ProjectEnvironmentVariables({
  projectId,
}: {
  projectId: string
}) {
  const queryClient = useQueryClient()
  const { notify } = useToast()

  const [showAddForm, setShowAddForm] = useState(false)
  const [newKey, setNewKey] = useState("")
  const [newValue, setNewValue] = useState("")
  const [revealNewValue, setRevealNewValue] = useState(false)

  // Key of the row being re-valued, with its draft value.
  const [editing, setEditing] = useState<{ key: string; value: string } | null>(
    null
  )
  const [revealEditValue, setRevealEditValue] = useState(false)

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: listProjects,
  })

  const variablesQuery = useQuery({
    queryKey: ["project-environment-variables", projectId],
    queryFn: () => listProjectEnvironmentVariables(projectId),
  })

  const variables = variablesQuery.data?.data ?? []

  function refreshProject() {
    void queryClient.invalidateQueries({
      queryKey: ["project-environment-variables", projectId],
    })
    // A rebuild/redeploy changes the deployment list and status.
    void queryClient.invalidateQueries({
      queryKey: ["project-deployments", projectId],
    })
    void queryClient.invalidateQueries({ queryKey: ["projects"] })
  }

  function reportChange(change: EnvironmentChange, label: string) {
    const notes = [changeSummary(change), ...change.warnings]
    notify(`${label} — ${notes.join(" ")}`)
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createProjectEnvironmentVariable(projectId, {
        key: newKey.trim(),
        value: newValue,
      }),
    onSuccess: (response) => {
      setNewKey("")
      setNewValue("")
      setRevealNewValue(false)
      setShowAddForm(false)
      refreshProject()
      reportChange(response.data.change, `${response.data.variable.key} saved`)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (input: { key: string; value: string }) =>
      updateProjectEnvironmentVariable(projectId, input.key, {
        value: input.value,
      }),
    onSuccess: (response) => {
      setEditing(null)
      setRevealEditValue(false)
      refreshProject()
      reportChange(
        response.data.change,
        `${response.data.variable.key} updated`
      )
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (key: string) =>
      deleteProjectEnvironmentVariable(projectId, key),
    onSuccess: (response) => {
      refreshProject()
      reportChange(response.data.change, `${response.data.key} deleted`)
    },
  })

  const unreadableKeys = variables
    .filter((variable) => !variable.readable)
    .map((variable) => variable.key)

  const project = projectsQuery.data?.data.find((p) => p.id === projectId)

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

  const trimmedKey = newKey.trim()
  const keyError =
    trimmedKey.length > 0 && !ENV_KEY_PATTERN.test(trimmedKey)
      ? "Names may only contain letters, numbers and underscores, and cannot start with a number."
      : null
  const canAdd = trimmedKey.length > 0 && !keyError

  const addFormVisible = showAddForm || variables.length === 0

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
        title="Environment variables"
        description="Secrets and configuration for this project. Values are encrypted at rest and can be replaced but never read back."
        action="Add variable"
        onAction={() => setShowAddForm(true)}
      />

      {addFormVisible && (
        <Card className="mb-4 gap-0 p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (canAdd && !createMutation.isPending) createMutation.mutate()
            }}
            className="flex flex-wrap items-start gap-2"
          >
            <div className="flex min-w-52 flex-1 flex-col gap-1.5">
              <label
                htmlFor="env-new-key"
                className="text-[10px] text-muted-foreground"
              >
                Key
              </label>
              <Input
                id="env-new-key"
                value={newKey}
                onChange={(event) => setNewKey(event.target.value)}
                placeholder="DATABASE_URL"
                autoComplete="off"
                spellCheck={false}
                disabled={createMutation.isPending}
                aria-invalid={keyError !== null}
                className="h-9 font-mono text-[11px]"
              />
            </div>

            <div className="flex flex-[1.5] flex-col gap-1.5">
              <label
                htmlFor="env-new-value"
                className="text-[10px] text-muted-foreground"
              >
                Value
              </label>
              <div className="flex items-center gap-1">
                <Input
                  id="env-new-value"
                  type={revealNewValue ? "text" : "password"}
                  value={newValue}
                  onChange={(event) => setNewValue(event.target.value)}
                  placeholder="value"
                  autoComplete="new-password"
                  spellCheck={false}
                  disabled={createMutation.isPending}
                  className="h-9 font-mono text-[11px]"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-lg"
                  aria-label={revealNewValue ? "Hide value" : "Show value"}
                  onClick={() => setRevealNewValue((current) => !current)}
                  className="text-muted-foreground"
                >
                  {revealNewValue ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-[22px]">
              <Button
                type="submit"
                size="lg"
                disabled={!canAdd || createMutation.isPending}
                className="gap-1.5 text-[11px] font-bold"
                title="Add a new environment variable"
              >
                {createMutation.isPending && (
                  <Loader2 className="size-3.5 animate-spin" />
                )}
                Add variable
              </Button>
              {variables.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  onClick={() => {
                    setShowAddForm(false)
                    setNewKey("")
                    setNewValue("")
                  }}
                  className="text-[11px] text-muted-foreground"
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>

          {keyError && (
            <p className="mt-2 text-[10px] text-rose-300">{keyError}</p>
          )}

          {createMutation.isError && (
            <InlineError message={createMutation.error.message} />
          )}

          <p className="mt-3 text-[9px] text-muted-foreground">
            Saving a static project queues a rebuild and replaces its stored
            artifacts. For a project running on Kubernetes the Secret in its
            namespace is rewritten and the workload rolls to pick the change up.
          </p>
        </Card>
      )}

      {variablesQuery.isLoading && (
        <div className="space-y-1.5">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      )}

      {!variablesQuery.isLoading && variablesQuery.isError && (
        <InlineError
          message="Could not load this project's environment variables."
          onRetry={() => variablesQuery.refetch()}
        />
      )}

      {!variablesQuery.isLoading &&
        !variablesQuery.isError &&
        variables.length === 0 && (
          <Card className="flex flex-col items-center gap-2 border border-dashed border-border px-4 py-10 text-center ring-0">
            <KeyRound className="size-5 text-muted-foreground" />
            <h3 className="text-[11px] text-foreground">
              No environment variables
            </h3>
            <p className="max-w-sm text-[9px] text-muted-foreground">
              Add a variable above. It is encrypted before it is stored and is
              never sent back to the browser.
            </p>
          </Card>
        )}

      {unreadableKeys.length > 0 && (
        <Alert className="mt-4 flex items-center gap-2 rounded-md border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-[11px] text-amber-300">
          <AlertCircle className="size-3.5 shrink-0" />
          <AlertTitle className="flex-1 text-[11px] font-normal text-inherit">
            {unreadableKeys.join(", ")} can no longer be decrypted (the value
            was stored with an older key). Replace the value to re-encrypt it —
            until then it is skipped when applying this project&apos;s
            environment.
          </AlertTitle>
        </Alert>
      )}

      {variables.length > 0 && (
        <Table className="mt-2">
          <TableHeader>
            <TableRow>
              {["Variable", "Value", "Updated", "Actions"].map((heading) => (
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
            {variables.map((variable) => {
              const isEditing = editing?.key === variable.key

              return (
                <TableRow key={variable.key}>
                  <TableCell className="px-3 py-3">
                    <code className="text-sm text-primary">{variable.key}</code>
                    {!variable.readable && (
                      <span className="ml-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[9px] text-amber-300">
                        Needs re-entry
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="px-3 py-3">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type={revealEditValue ? "text" : "password"}
                          value={editing.value}
                          onChange={(event) =>
                            setEditing({
                              key: variable.key,
                              value: event.target.value,
                            })
                          }
                          autoFocus
                          autoComplete="new-password"
                          spellCheck={false}
                          disabled={updateMutation.isPending}
                          aria-label={`New value for ${variable.key}`}
                          className="h-8 max-w-72 font-mono text-[11px]"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={
                            revealEditValue ? "Hide value" : "Show value"
                          }
                          onClick={() =>
                            setRevealEditValue((current) => !current)
                          }
                          className="text-muted-foreground"
                        >
                          {revealEditValue ? (
                            <EyeOff className="size-3.5" />
                          ) : (
                            <Eye className="size-3.5" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={updateMutation.isPending}
                          onClick={() =>
                            updateMutation.mutate({
                              key: variable.key,
                              value: editing.value,
                            })
                          }
                          className="gap-1.5 text-[11px]"
                        >
                          {updateMutation.isPending && (
                            <Loader2 className="size-3 animate-spin" />
                          )}
                          Save
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Cancel edit"
                          onClick={() => {
                            setEditing(null)
                            setRevealEditValue(false)
                          }}
                          className="text-muted-foreground"
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <span className="font-mono text-sm text-muted-foreground">
                        {MASKED_VALUE}
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="px-3 py-3 text-[11px] text-muted-foreground">
                    {formatUpdated(variable.updatedAt)}
                  </TableCell>

                  <TableCell className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isEditing}
                        onClick={() => {
                          setEditing({ key: variable.key, value: "" })
                          setRevealEditValue(false)
                          updateMutation.reset()
                        }}
                        className="gap-1.5 text-[11px] text-muted-foreground"
                      >
                        <Pencil className="size-3.5" />
                        Replace value
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1.5 text-[11px] text-muted-foreground hover:text-rose-300"
                            />
                          }
                        >
                          <Trash2 className="size-3.5" />
                          Delete
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Delete “{variable.key}”?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Removing the variable rebuilds a static project or
                              rewrites the Secret of a running one. This cannot
                              be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel
                              disabled={deleteMutation.isPending}
                            >
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              variant="destructive"
                              disabled={deleteMutation.isPending}
                              onClick={() =>
                                deleteMutation.mutate(variable.key)
                              }
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
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      {updateMutation.isError && (
        <InlineError message={updateMutation.error.message} />
      )}

      {deleteMutation.isError && (
        <InlineError message={deleteMutation.error.message} />
      )}
    </>
  )
}
