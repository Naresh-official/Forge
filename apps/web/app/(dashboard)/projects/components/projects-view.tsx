"use client"

import {
  AlertCircle,
  ChevronDown,
  GitBranch,
  RefreshCw,
  Search,
  X,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import type { IconType } from "react-icons"
import { SiAstro } from "react-icons/si"
import { SiAngular } from "react-icons/si"
import { SiExpress } from "react-icons/si"
import { SiNestjs } from "react-icons/si"
import { SiNextdotjs } from "react-icons/si"
import { SiNodedotjs } from "react-icons/si"
import { SiNuxt } from "react-icons/si"
import { SiReact } from "react-icons/si"
import { SiRemix } from "react-icons/si"
import { SiSvelte } from "react-icons/si"
import { SiVite } from "react-icons/si"
import { SiVuedotjs } from "react-icons/si"
import { listProjects } from "@forge/api-client/project"
import { EmptyState, PageHeader, StatusBadge } from "../../_components/ui"
import type { ProjectListItem } from "@forge/types"

const FRAMEWORK_LABELS: Record<string, string> = {
  NEXTJS: "Next.js",
  VITE: "Vite",
  REACT: "React",
  VUE: "Vue",
  NUXT: "Nuxt",
  SVELTE: "Svelte",
  SVELTEKIT: "SvelteKit",
  ASTRO: "Astro",
  ANGULAR: "Angular",
  REMIX: "Remix",
  NESTJS: "NestJS",
  EXPRESS: "Express",
  UNKNOWN: "Node.js",
}

function formatFramework(framework?: string) {
  if (!framework) return "Node.js"
  return FRAMEWORK_LABELS[framework.toUpperCase()] ?? framework
}

type FrameworkIcon = { icon: IconType; color: string }

const DEFAULT_FRAMEWORK_ICON: FrameworkIcon = {
  icon: SiNodedotjs,
  color: "text-lime-500",
}

const FRAMEWORK_ICONS: Record<string, FrameworkIcon> = {
  NEXTJS: { icon: SiNextdotjs, color: "text-foreground" },
  VITE: { icon: SiVite, color: "text-violet-400" },
  REACT: { icon: SiReact, color: "text-cyan-400" },
  VUE: { icon: SiVuedotjs, color: "text-emerald-400" },
  NUXT: { icon: SiNuxt, color: "text-emerald-400" },
  SVELTE: { icon: SiSvelte, color: "text-orange-500" },
  SVELTEKIT: { icon: SiSvelte, color: "text-orange-500" },
  ASTRO: { icon: SiAstro, color: "text-fuchsia-500" },
  ANGULAR: { icon: SiAngular, color: "text-rose-500" },
  REMIX: { icon: SiRemix, color: "text-sky-400" },
  NESTJS: { icon: SiNestjs, color: "text-rose-500" },
  EXPRESS: { icon: SiExpress, color: "text-foreground" },
  UNKNOWN: DEFAULT_FRAMEWORK_ICON,
}

function FrameworkLogo({ framework }: { framework?: string }) {
  const { icon: Icon, color } =
    FRAMEWORK_ICONS[(framework ?? "UNKNOWN").toUpperCase()] ??
    DEFAULT_FRAMEWORK_ICON

  return (
    <span
      title={formatFramework(framework)}
      className={[
        "flex size-4 shrink-0 items-center justify-center",
        color,
      ].join(" ")}
    >
      <Icon className="size-4" aria-hidden />
    </span>
  )
}

function formatRelativeTime(dateInput?: Date | string) {
  if (!dateInput) return "Recently"
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput
  if (isNaN(date.getTime())) return "Recently"

  const diffInSeconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diffInSeconds < 60) return "Just now"
  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `${diffInHours}h ago`
  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 30) return `${diffInDays}d ago`
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

function ProjectsSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-lg border border-border bg-card p-[17px]"
        >
          <div className="flex items-center justify-between">
            <div className="size-4 rounded bg-muted" />
            <div className="h-6 w-16 rounded-full bg-muted" />
          </div>
          <div className="mt-4 h-5 w-3/4 rounded bg-muted" />
          <div className="mt-2 mb-5 h-4 w-1/2 rounded bg-muted" />
          <div className="flex items-center justify-between border-t border-border pt-3">
            <div className="h-4 w-16 rounded bg-muted" />
            <div className="h-4 w-14 rounded bg-muted" />
          </div>
          <div className="mt-4 flex justify-between">
            <div className="h-3 w-24 rounded bg-muted" />
            <div className="h-3 w-12 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  )
}

function ErrorState({
  error,
  onRetry,
}: {
  error?: unknown
  onRetry?: () => void
}) {
  const errorMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Failed to load projects. Please try again."

  return (
    <div className="flex min-h-60 flex-col items-center justify-center gap-3 rounded-lg border border-rose-500/20 bg-rose-500/5 p-8 text-center text-rose-300">
      <div className="rounded-full border border-rose-500/30 bg-rose-500/10 p-3 text-rose-400">
        <AlertCircle className="size-6" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          Error loading projects
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">{errorMessage}</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
        >
          <RefreshCw className="size-3.5" />
          Retry
        </button>
      )}
    </div>
  )
}

export interface ProjectsViewProps {
  projects?: ProjectListItem[]
  isLoading?: boolean
  isError?: boolean
  error?: unknown
  onRetry?: () => void
}

export function ProjectsView({
  projects: propProjects,
  isLoading: propIsLoading,
  isError: propIsError,
  error: propError,
  onRetry: propOnRetry,
}: ProjectsViewProps = {}) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [frameworkFilter, setFrameworkFilter] = useState<string>("ALL")

  const fallbackQuery = useQuery({
    queryKey: ["projects"],
    queryFn: listProjects,
    enabled: propProjects === undefined,
  })

  const projects = propProjects ?? fallbackQuery.data?.data ?? []
  const isLoading =
    propIsLoading ?? (propProjects === undefined && fallbackQuery.isLoading)
  const isError =
    propIsError ?? (propProjects === undefined && fallbackQuery.isError)
  const error = propError ?? fallbackQuery.error
  const onRetry = propOnRetry ?? (() => fallbackQuery.refetch())

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
      <PageHeader
        title="Projects"
        description="Manage your applications and deployments."
        action="New project"
        onAction={() => router.push("/projects/new")}
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <label className="flex h-9 min-w-60 items-center gap-2 rounded-md border border-border bg-card px-2.5 text-muted-foreground max-sm:w-full">
          <Search className="size-3.5" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects..."
            className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
            disabled={isLoading}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </label>

        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            disabled={isLoading}
            className="h-9 cursor-pointer appearance-none rounded-md border border-border bg-card pr-8 pl-3 text-xs text-muted-foreground outline-none hover:text-foreground disabled:opacity-50"
          >
            <option value="ALL">All Statuses</option>
            <option value="READY">Ready</option>
            <option value="DEPLOYING">Deploying</option>
            <option value="BUILDING">Building</option>
            <option value="QUEUED">Queued</option>
            <option value="FAILED">Failed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3 -translate-y-1/2 text-muted-foreground" />
        </div>

        <div className="relative">
          <select
            value={frameworkFilter}
            onChange={(e) => setFrameworkFilter(e.target.value)}
            disabled={isLoading}
            className="h-9 cursor-pointer appearance-none rounded-md border border-border bg-card pr-8 pl-3 text-xs text-muted-foreground outline-none hover:text-foreground disabled:opacity-50"
          >
            <option value="ALL">All Frameworks</option>
            <option value="NEXTJS">Next.js</option>
            <option value="REACT">React</option>
            <option value="VITE">Vite</option>
            <option value="VUE">Vue</option>
            <option value="NUXT">Nuxt</option>
            <option value="ASTRO">Astro</option>
            <option value="SVELTEKIT">SvelteKit</option>
            <option value="NESTJS">NestJS</option>
            <option value="EXPRESS">Express</option>
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>

      {isLoading && <ProjectsSkeleton />}

      {!isLoading && isError && <ErrorState error={error} onRetry={onRetry} />}

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
          <div className="flex min-h-60 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border text-muted-foreground">
            <Search className="size-6 opacity-50" />
            <h3 className="mt-1 text-sm text-foreground">
              No results matching filter
            </h3>
            <p className="mb-2 text-xs">
              Try adjusting your search terms or filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery("")
                setStatusFilter("ALL")
                setFrameworkFilter("ALL")
              }}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-muted"
            >
              Clear filters
            </button>
          </div>
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
              <button
                key={p.id}
                type="button"
                onClick={() => router.push(`/projects/${p.id}`)}
                className="rounded-lg border border-border bg-card p-[17px] text-left transition hover:-translate-y-px hover:border-primary/50 focus:ring-1 focus:ring-primary focus:outline-none"
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
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}
