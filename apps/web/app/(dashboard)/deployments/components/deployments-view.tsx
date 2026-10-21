"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { AlertCircle, GitBranch, RefreshCw, Search, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { listDeployments } from "@forge/api-client/deployment"
import {
  formatDeploymentDuration,
  formatRelativeTime,
  isDeploymentActive,
  runtimeLabel,
} from "@/lib/deployment-format"
import { ALL_FILTER, filterDeployments } from "@/lib/deployment-filter"
import type { DeploymentListItem } from "@forge/types/deployment"
import { Alert, AlertTitle } from "@forge/ui/components/alert"
import { Button } from "@forge/ui/components/button"
import { Card } from "@forge/ui/components/card"
import { Input } from "@forge/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@forge/ui/components/select"
import { Skeleton } from "@forge/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@forge/ui/components/table"
import { PageHeader, StatusBadge } from "../../_components/ui"

/** How often the list refreshes while a deployment is in flight. */
const ACTIVE_REFETCH_INTERVAL_MS = 5_000

const STATUS_OPTIONS = [
  { value: "ALL", label: "All statuses" },
  { value: "READY", label: "Ready" },
  { value: "QUEUED", label: "Queued" },
  { value: "BUILDING", label: "Building" },
  { value: "DEPLOYING", label: "Deploying" },
  { value: "FAILED", label: "Failed" },
  { value: "CANCELLED", label: "Cancelled" },
] as const

export function DeploymentsView() {
  const router = useRouter()

  const [search, setSearch] = useState("")
  const [status, setStatus] = useState(ALL_FILTER)
  const [projectId, setProjectId] = useState(ALL_FILTER)

  const deploymentsQuery = useQuery({
    queryKey: ["deployments"],
    queryFn: listDeployments,
    // Builds and rollouts finish asynchronously — poll only while one runs.
    refetchInterval: (query) =>
      query.state.data?.data.some((deployment) =>
        isDeploymentActive(deployment.status)
      )
        ? ACTIVE_REFETCH_INTERVAL_MS
        : false,
  })

  const deployments = useMemo(
    () => deploymentsQuery.data?.data ?? [],
    [deploymentsQuery.data]
  )

  const projectOptions = useMemo(() => {
    const unique = new Map<string, string>()

    for (const deployment of deployments) {
      unique.set(deployment.project.id, deployment.project.name)
    }

    return [
      { value: ALL_FILTER, label: "All projects" },
      ...[...unique.entries()]
        .sort(([, a], [, b]) => a.localeCompare(b))
        .map(([value, label]) => ({ value, label })),
    ]
  }, [deployments])

  const filtered = useMemo(
    () => filterDeployments(deployments, { search, status, projectId }),
    [deployments, search, status, projectId]
  )

  const hasFilters =
    search.trim().length > 0 ||
    status !== ALL_FILTER ||
    projectId !== ALL_FILTER

  function openDeployment(deployment: DeploymentListItem) {
    router.push(
      `/projects/${deployment.project.id}/deployments/${deployment.id}`
    )
  }

  function clearFilters() {
    setSearch("")
    setStatus(ALL_FILTER)
    setProjectId(ALL_FILTER)
  }

  return (
    <>
      <PageHeader
        title="Deployments"
        description="Every build, preview, and production release across your projects — the 50 most recent."
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative flex min-w-60 items-center max-sm:w-full">
          <Search className="pointer-events-none absolute left-2.5 size-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search deployments"
            aria-label="Search deployments"
            className="h-9 pl-8 text-[11px]"
          />
        </div>

        <Select
          items={projectOptions}
          value={projectId}
          onValueChange={(value) => setProjectId(value as string)}
        >
          <SelectTrigger className="h-9 min-w-36 bg-card text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {projectOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          items={[...STATUS_OPTIONS]}
          value={status}
          onValueChange={(value) => setStatus(value as string)}
        >
          <SelectTrigger className="h-9 min-w-32 bg-card text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={deploymentsQuery.isFetching}
          onClick={() => deploymentsQuery.refetch()}
          className="h-9 gap-1.5 text-[11px]"
          title="Refresh deployment list"
        >
          <RefreshCw
            className={
              deploymentsQuery.isFetching ? "size-3 animate-spin" : "size-3"
            }
          />
          Refresh
        </Button>

        {hasFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-9 gap-1.5 text-[11px] text-muted-foreground"
          >
            <X className="size-3" />
            Clear filters
          </Button>
        )}
      </div>

      {deploymentsQuery.isLoading && (
        <div className="space-y-1.5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-11 w-full" />
          ))}
        </div>
      )}

      {!deploymentsQuery.isLoading && deploymentsQuery.isError && (
        <Alert
          variant="destructive"
          className="mt-3 flex items-center gap-2 rounded-md border-rose-500/20 bg-rose-500/5 px-3 py-2.5 text-[11px] text-rose-300"
        >
          <AlertCircle className="size-3.5 shrink-0" />
          <AlertTitle className="flex-1 text-[11px] font-normal text-inherit">
            Could not load deployments.
          </AlertTitle>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => deploymentsQuery.refetch()}
            className="shrink-0 gap-1 text-rose-200 hover:bg-transparent hover:text-rose-100"
          >
            <RefreshCw className="size-3" />
            Retry
          </Button>
        </Alert>
      )}

      {!deploymentsQuery.isLoading &&
        !deploymentsQuery.isError &&
        deployments.length === 0 && (
          <Card className="flex flex-col items-center gap-2 border border-dashed border-border px-4 py-10 text-center ring-0">
            <GitBranch className="size-5 text-muted-foreground" />
            <h3 className="text-[11px] text-foreground">No deployments yet</h3>
            <p className="max-w-sm text-[9px] text-muted-foreground">
              Deploy a project and its builds will show up here.
            </p>
          </Card>
        )}

      {!deploymentsQuery.isLoading &&
        !deploymentsQuery.isError &&
        deployments.length > 0 &&
        filtered.length === 0 && (
          <Card className="flex flex-col items-center gap-2 border border-dashed border-border px-4 py-10 text-center ring-0">
            <Search className="size-5 text-muted-foreground" />
            <h3 className="text-[11px] text-foreground">
              No deployments match these filters
            </h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="mt-2 text-[11px]"
            >
              Clear filters
            </Button>
          </Card>
        )}

      {filtered.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              {[
                "Status",
                "Deployment",
                "Project",
                "Branch",
                "Commit",
                "Runtime",
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
            {filtered.map((deployment) => (
              <TableRow
                key={deployment.id}
                tabIndex={0}
                onClick={() => openDeployment(deployment)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    openDeployment(deployment)
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

                <TableCell className="px-3 py-3 text-[11px]">
                  {deployment.project.name}
                </TableCell>

                <TableCell className="px-3 py-3 font-mono text-sm text-muted-foreground">
                  <GitBranch className="mr-1 inline size-3.5" />
                  {deployment.branch}
                </TableCell>

                <TableCell className="px-3 py-3 font-mono text-sm text-primary">
                  {deployment.commitSha.slice(0, 7)}
                </TableCell>

                <TableCell className="px-3 py-3 text-[11px] text-muted-foreground">
                  {runtimeLabel(deployment.runtime)}
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

      {filtered.length > 0 && (
        <p className="mt-3 text-[9px] text-muted-foreground">
          Running deployments refresh automatically every 5s.
        </p>
      )}
    </>
  )
}
