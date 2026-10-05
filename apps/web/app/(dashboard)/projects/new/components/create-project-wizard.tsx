"use client"

import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  Check,
  ExternalLink,
  GitBranch,
  Loader2,
  RefreshCw,
  Rocket,
  Search,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createDeployment } from "@forge/api-client/deployment"
import { getGithubInstallUrl } from "@forge/api-client/github"
import { listRepositories } from "@forge/api-client/repositories"
import type { GithubRepository } from "@forge/types/github"
import { useToast } from "@/app/(dashboard)/_components/toast-provider"

const STEPS = ["Repository", "Deploy"] as const

const STEP_DESCRIPTIONS = ["Import a repository", "Review and deploy"] as const

function repoShortName(repo: GithubRepository) {
  return repo.fullName.split("/")[1] ?? repo.fullName
}

export function CreateProjectWizard() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { notify } = useToast()

  const [step, setStep] = useState(1)
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<GithubRepository | null>(null)
  const [projectName, setProjectName] = useState("")

  const repositoriesQuery = useQuery({
    queryKey: ["repositories"],
    queryFn: listRepositories,
  })

  const githubInstallUrl = getGithubInstallUrl()

  const repositories = repositoriesQuery.data?.data ?? []

  const filtered = repositories.filter((repo) =>
    repo.fullName.toLowerCase().includes(query.trim().toLowerCase())
  )

  const deployment = useMutation({
    mutationFn: createDeployment,
    onSuccess: () => {
      // The new project shows up in the list and sidebar, so refresh both
      // before we leave the wizard.
      queryClient.invalidateQueries({ queryKey: ["projects"] })
      queryClient.invalidateQueries({ queryKey: ["project-names"] })
      notify("Project created and deployment started")
      router.push("/projects")
    },
  })

  const canDeploy = selected !== null && !deployment.isPending

  function goToStep(next: number) {
    deployment.reset()
    setStep(next)
  }

  function startDeployment() {
    if (!selected) return
    const name = projectName.trim()
    deployment.mutate({
      repositoryId: selected.id,
      ...(name ? { projectName: name } : {}),
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => router.push("/projects")}
        className="mb-5 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"
      >
        <ArrowLeft className="size-3.5" /> Projects
      </button>

      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-[-.045em]">
          Create a project
        </h1>
        <p className="mt-2 text-xs text-muted-foreground">
          Step {step} of {STEPS.length} · {STEP_DESCRIPTIONS[step - 1]}
        </p>
      </div>

      <div className="max-w-4xl">
        <div className="mb-3 flex gap-6 max-sm:justify-between max-sm:gap-2">
          {STEPS.map((label, i) => (
            <button
              key={label}
              type="button"
              disabled={i + 1 > step || selected === null}
              onClick={() => goToStep(i + 1)}
              className={[
                "flex items-center gap-2 text-sm",
                step === i + 1 ? "text-foreground" : "text-muted-foreground",
              ].join(" ")}
            >
              <span
                className={[
                  "grid size-5 place-items-center rounded-full border",
                  step >= i + 1
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border",
                ].join(" ")}
              >
                {step > i + 1 ? <Check className="size-3" /> : i + 1}
              </span>
              <span className="max-sm:hidden">{label}</span>
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-border bg-card p-6 max-sm:p-4">
          {step === 1 && (
            <>
              <StepTitle
                icon={<GitBranch className="size-5" />}
                title="Import a repository"
                description="Choose a GitHub repository to deploy with Forge."
              />

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <label className="flex h-9 min-w-55 flex-1 items-center gap-2 rounded-md border border-border bg-background px-2.5">
                  <Search className="size-3.5 shrink-0 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search repositories"
                    disabled={repositoriesQuery.isLoading}
                    className="min-w-0 flex-1 bg-transparent text-[11px] outline-none"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => repositoriesQuery.refetch()}
                  disabled={repositoriesQuery.isFetching}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  <RefreshCw
                    className={[
                      "size-3.5",
                      repositoriesQuery.isFetching ? "animate-spin" : "",
                    ].join(" ")}
                  />
                  Sync
                </button>
                <a
                  href={githubInstallUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-2.5 text-[11px] font-bold text-primary-foreground"
                >
                  <ExternalLink className="size-3.5" />
                  Allow more repos
                </a>
              </div>

              {repositoriesQuery.isLoading && (
                <div className="mt-3 space-y-1.5">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex animate-pulse items-center gap-3 rounded-md border border-border p-2.5"
                    >
                      <div className="size-7 shrink-0 rounded-md bg-muted" />
                      <div className="flex flex-1 flex-col gap-1.5">
                        <div className="h-3 w-40 rounded bg-muted" />
                        <div className="h-2.5 w-20 rounded bg-muted" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!repositoriesQuery.isLoading && repositoriesQuery.isError && (
                <InlineError
                  message="Could not load your repositories."
                  onRetry={() => repositoriesQuery.refetch()}
                />
              )}

              {!repositoriesQuery.isLoading &&
                !repositoriesQuery.isError &&
                repositories.length === 0 && (
                  <div className="mt-3 flex flex-col items-center gap-2 rounded-md border border-dashed border-border px-4 py-10 text-center">
                    <GitBranch className="size-5 text-muted-foreground" />
                    <h3 className="text-[11px] text-foreground">
                      No repositories available
                    </h3>
                    <p className="max-w-sm text-[9px] text-muted-foreground">
                      Install the Forge GitHub App and grant it access to the
                      repositories you want to deploy.
                    </p>
                    <a
                      href={githubInstallUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-[11px] font-bold text-primary-foreground"
                    >
                      <ExternalLink className="size-3.5" />
                      Allow repositories on GitHub
                    </a>
                  </div>
                )}

              {!repositoriesQuery.isLoading &&
                !repositoriesQuery.isError &&
                repositories.length > 0 &&
                filtered.length === 0 && (
                  <p className="mt-3 rounded-md border border-dashed border-border px-4 py-6 text-center text-[11px] text-muted-foreground">
                    No repositories match “{query}”.
                  </p>
                )}

              {filtered.length > 0 && (
                <div className="mt-3 max-h-[380px] space-y-1.5 overflow-y-auto">
                  {filtered.map((repo) => {
                    const connected = repo.projectId !== null
                    const isSelected = selected?.id === repo.id

                    return (
                      <button
                        key={repo.id}
                        type="button"
                        disabled={connected}
                        onClick={() => setSelected(repo)}
                        className={[
                          "flex w-full items-center gap-3 rounded-md border p-2.5 text-left",
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border",
                          connected
                            ? "cursor-not-allowed opacity-50"
                            : "hover:border-primary/50",
                        ].join(" ")}
                      >
                        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-secondary text-xs text-primary">
                          {repoShortName(repo)[0]?.toUpperCase()}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                          <strong className="truncate text-[11px]">
                            {repo.fullName}
                          </strong>
                          <small className="flex items-center gap-1 text-[9px] text-muted-foreground">
                            <GitBranch className="size-2.5" />
                            {repo.defaultBranch}
                          </small>
                        </span>
                        {connected && (
                          <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[9px] text-muted-foreground">
                            Already imported
                          </span>
                        )}
                        {isSelected && (
                          <Check className="size-3.5 shrink-0 text-primary" />
                        )}
                      </button>
                    )
                  })}
                </div>
              )}

              <Actions>
                <button
                  type="button"
                  disabled={selected === null}
                  onClick={() => goToStep(2)}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-[11px] font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Continue <ArrowUpRight className="size-3.5" />
                </button>
              </Actions>
            </>
          )}

          {step === 2 && selected && (
            <>
              <StepTitle
                icon={<Rocket className="size-5" />}
                title="Ready to deploy"
                description="Review your selection before creating the project."
              />

              <div className="mt-5 grid grid-cols-2 gap-5 border-t border-border pt-5 max-sm:grid-cols-1">
                <Summary label="Repository" value={selected.fullName} />
                <Summary label="Branch" value={selected.defaultBranch} />
              </div>

              <label className="mt-5 flex flex-col gap-1.5 text-sm text-muted-foreground">
                Project name
                <input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder={repoShortName(selected)}
                  disabled={deployment.isPending}
                  className="rounded-md border border-border bg-background px-2.5 py-2 text-[11px] text-foreground outline-none focus:ring-1 focus:ring-ring"
                />
              </label>
              <p className="mt-2 text-[9px] text-muted-foreground">
                Leave empty to use the repository name. Forge detects the build
                and output settings automatically.
              </p>

              {deployment.isError && (
                <InlineError
                  message={
                    deployment.error instanceof Error
                      ? deployment.error.message
                      : "Failed to start the deployment."
                  }
                />
              )}

              <Actions>
                <button
                  type="button"
                  disabled={deployment.isPending}
                  onClick={() => goToStep(1)}
                  className="rounded-md border border-border bg-card px-3 py-2 text-[11px] disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={!canDeploy}
                  onClick={startDeployment}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-[11px] font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deployment.isPending
                    ? "Starting deployment…"
                    : "Deploy project"}
                  {deployment.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Rocket className="size-3.5" />
                  )}
                </button>
              </Actions>
            </>
          )}
        </div>
      </div>
    </>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[9px] text-muted-foreground">{label}</span>
      <strong className="truncate text-[11px] font-medium">{value}</strong>
    </div>
  )
}

function InlineError({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <div className="mt-3 flex items-center gap-2 rounded-md border border-rose-500/20 bg-rose-500/5 px-3 py-2.5 text-[11px] text-rose-300">
      <AlertCircle className="size-3.5 shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex shrink-0 items-center gap-1 text-rose-200 hover:text-rose-100"
        >
          <RefreshCw className="size-3" />
          Retry
        </button>
      )}
    </div>
  )
}

function StepTitle({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-primary">{icon}</span>
      <div>
        <h2 className="text-[15px] font-semibold">{title}</h2>
        <p className="mt-1 text-[11px] text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function Actions({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 flex justify-end gap-2">{children}</div>
}
