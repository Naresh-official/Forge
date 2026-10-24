"use client"

import { GitBranch, Search, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { listProjects } from "@forge/api-client/project"
import { formatRelativeTime } from "@/lib/deployment-format"
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
import { EmptyState } from "../../_components/empty-state"
import {
  FrameworkLogo,
  formatFramework,
} from "../../_components/framework-logo"
import { StatusBadge } from "../../_components/status-badge"
import { ProjectsErrorState } from "./projects-error-state"
import { ProjectsSkeleton } from "./projects-skeleton"

const STATUS_OPTIONS = {
  ALL: "All Statuses",
  READY: "Ready",
  DEPLOYING: "Deploying",
  BUILDING: "Building",
  QUEUED: "Queued",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
} as const

const FRAMEWORK_OPTIONS = {
  ALL: "All Frameworks",
  NEXTJS: "Next.js",
  REACT: "React",
  VITE: "Vite",
  VUE: "Vue",
  NUXT: "Nuxt",
  ASTRO: "Astro",
  SVELTEKIT: "SvelteKit",
  NESTJS: "NestJS",
  EXPRESS: "Express",
} as const

export function ProjectsView() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [frameworkFilter, setFrameworkFilter] = useState<string>("ALL")

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: listProjects,
  })

  const projects = useMemo(
    () => projectsQuery.data?.data ?? [],
    [projectsQuery.data]
  )
  const isLoading = projectsQuery.isLoading
  const isError = projectsQuery.isError

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      const repoName = p.githubRepository?.fullName ?? p.slug ?? ""
      const matchesQuery =
        query === "" ||
        `${p.name} ${repoName} ${p.framework ?? ""} ${p.deployments?.branch ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase())

      const matchesStatus =
        statusFilter === "ALL" ||
        (p.deployments?.status ?? "QUEUED").toUpperCase() === statusFilter

      const matchesFramework =
        frameworkFilter === "ALL" ||
        (p.framework ?? "UNKNOWN").toUpperCase() === frameworkFilter

      return matchesQuery && matchesStatus && matchesFramework
    })
  }, [projects, query, statusFilter, frameworkFilter])

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative flex h-9 min-w-60 items-center max-sm:w-full">
          <Search className="pointer-events-none absolute left-2.5 size-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects..."
            className="h-9 pl-8 text-xs"
            disabled={isLoading}
          />
          {query && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => setQuery("")}
              className="absolute right-1.5 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
              title="Clear search"
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>

        <Select
          items={STATUS_OPTIONS}
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as string)}
          disabled={isLoading}
        >
          <SelectTrigger className="h-9 min-w-36 text-xs text-muted-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_OPTIONS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          items={FRAMEWORK_OPTIONS}
          value={frameworkFilter}
          onValueChange={(value) => setFrameworkFilter(value as string)}
          disabled={isLoading}
        >
          <SelectTrigger className="h-9 min-w-36 text-xs text-muted-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(FRAMEWORK_OPTIONS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && <ProjectsSkeleton />}

      {!isLoading && isError && (
        <ProjectsErrorState
          error={projectsQuery.error}
          onRetry={() => projectsQuery.refetch()}
        />
      )}

      {!isLoading && !isError && projects.length === 0 && (
        <EmptyState
          title="No projects found"
          action="New project"
          onAction={() => router.push("/projects/new")}
        />
      )}

      {!isLoading &&
        !isError &&
        projects.length > 0 &&
        filtered.length === 0 && (
          <Card className="flex min-h-60 flex-col items-center justify-center gap-2 border border-dashed border-border text-muted-foreground ring-0">
            <Search className="size-6 opacity-50" />
            <h3 className="mt-1 text-sm text-foreground">
              No results matching filter
            </h3>
            <p className="mb-2 text-xs">
              Try adjusting your search terms or filters.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setQuery("")
                setStatusFilter("ALL")
                setFrameworkFilter("ALL")
              }}
              className="text-xs"
            >
              Clear filters
            </Button>
          </Card>
        )}

      {!isLoading && !isError && filtered.length > 0 && (
        <div className="grid grid-cols-3 gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
          {filtered.map((p) => {
            const status = p.deployments?.status ?? "QUEUED"
            const branch =
              p.deployments?.branch ??
              p.githubRepository?.defaultBranch ??
              "main"
            const repo = p.githubRepository?.fullName ?? p.slug
            const domain = `${p.slug}.forge.run`
            const updated = formatRelativeTime(p.updatedAt ?? p.createdAt)
            const framework = formatFramework(p.framework)

            return (
              <Card
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/projects/${p.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    router.push(`/projects/${p.id}`)
                  }
                }}
                className="cursor-pointer gap-0 p-[17px] text-left transition hover:-translate-y-px hover:ring-primary/50 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              >
                <div className="flex items-center justify-between">
                  <FrameworkLogo framework={p.framework} />
                  <StatusBadge status={status} />
                </div>
                <h3 className="mt-4 truncate text-sm font-semibold text-foreground">
                  {p.name}
                </h3>
                <p className="mt-1 mb-5 truncate text-xs text-muted-foreground">
                  {repo}
                </p>
                <div className="flex items-center justify-between border-t border-border pt-3 font-mono text-xs text-muted-foreground">
                  <span className="flex items-center truncate">
                    <GitBranch className="mr-1 inline size-3.5 shrink-0" />
                    <span className="truncate">{branch}</span>
                  </span>
                  <span className="shrink-0">{framework}</span>
                </div>
                <div className="mt-4 flex justify-between text-[10px] text-muted-foreground">
                  <span className="truncate">{domain}</span>
                  <span className="shrink-0 pl-2">{updated}</span>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}
