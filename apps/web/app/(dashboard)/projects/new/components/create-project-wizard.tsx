"use client"

import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  Check,
  Cpu,
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
import { isStaticFramework, normalizeFramework } from "@forge/frameworks"
import {
  AUTOSCALING,
  DEPLOYMENT_PLANS,
  deploymentPlanIds,
  type DeploymentPlanId,
} from "@forge/types"
import { Alert, AlertTitle } from "@forge/ui/components/alert"
import { Button, buttonVariants } from "@forge/ui/components/button"
import { Card } from "@forge/ui/components/card"
import { Input } from "@forge/ui/components/input"
import { Label } from "@forge/ui/components/label"
import { Skeleton } from "@forge/ui/components/skeleton"
import { cn } from "@forge/ui/lib/utils"
import { FrameworkLogo } from "@/app/(dashboard)/_components/framework-logo"
import { useToast } from "@/app/(dashboard)/_components/toast-provider"

/**
 * The Resources step is only shown for non-static (server/container)
 * projects — static sites need no Kubernetes resources.
 */
const STATIC_STEPS = [
  { label: "Repository", description: "Import a repository" },
  { label: "Deploy", description: "Review and deploy" },
] as const

const CONTAINER_STEPS = [
  { label: "Repository", description: "Import a repository" },
  { label: "Resources", description: "Configure resources" },
  { label: "Deploy", description: "Review and deploy" },
] as const

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
  const [plan, setPlan] = useState<DeploymentPlanId>("basic")
  // Autoscaling is chosen instead of a fixed tier; requests fall back to
  // Basic as the HPA's CPU baseline.
  const [autoscaling, setAutoscaling] = useState(false)

  const selectedIsStatic = selected
    ? isStaticFramework(normalizeFramework(selected.framework))
    : true

  const steps = selectedIsStatic ? STATIC_STEPS : CONTAINER_STEPS
  const isLastStep = step === steps.length

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
      ...(selectedIsStatic
        ? {}
        : autoscaling
          ? { autoscaling: true }
          : { plan }),
    })
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => router.push("/projects")}
        className="mb-5 gap-1.5 px-0 text-[11px] text-muted-foreground hover:bg-transparent hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Projects
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-[-.045em]">
          Create a project
        </h1>
        <p className="mt-2 text-xs text-muted-foreground">
          Step {step} of {steps.length} · {steps[step - 1]?.description}
        </p>
      </div>

      <div className="max-w-4xl">
        <div className="mb-3 flex gap-6 max-sm:justify-between max-sm:gap-2">
          {steps.map(({ label }, i) => (
            <Button
              key={label}
              type="button"
              variant="ghost"
              disabled={i + 1 > step || selected === null}
              onClick={() => goToStep(i + 1)}
              className={cn(
                "h-auto gap-2 px-0 text-sm hover:bg-transparent",
                step === i + 1 ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "grid size-5 place-items-center rounded-full border",
                  step >= i + 1
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border"
                )}
              >
                {step > i + 1 ? <Check className="size-3" /> : i + 1}
              </span>
              <span className="max-sm:hidden">{label}</span>
            </Button>
          ))}
        </div>

        <Card className="gap-0 p-6 max-sm:p-4">
          {step === 1 && (
            <>
              <StepTitle
                icon={<GitBranch className="size-5" />}
                title="Import a repository"
                description="Choose a GitHub repository to deploy with Forge."
              />

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <div className="relative flex h-9 min-w-55 flex-1 items-center">
                  <Search className="pointer-events-none absolute left-2.5 size-3.5 shrink-0 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search repositories"
                    disabled={repositoriesQuery.isLoading}
                    className="h-9 pl-8 text-[11px]"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => repositoriesQuery.refetch()}
                  disabled={repositoriesQuery.isFetching}
                  className="gap-1.5 text-[11px] text-muted-foreground"
                >
                  <RefreshCw
                    className={cn(
                      "size-3.5",
                      repositoriesQuery.isFetching && "animate-spin"
                    )}
                  />
                  Sync
                </Button>
                <a
                  href={githubInstallUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "gap-1.5 text-[11px] font-bold"
                  )}
                >
                  <ExternalLink className="size-3.5" />
                  Allow more repos
                </a>
              </div>

              {repositoriesQuery.isLoading && (
                <div className="mt-3 space-y-1.5">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Card
                      key={i}
                      className="flex-row items-center gap-3 p-2.5 ring-1 ring-border"
                    >
                      <Skeleton className="size-7 shrink-0 rounded-md" />
                      <div className="flex flex-1 flex-col gap-1.5">
                        <Skeleton className="h-3 w-40" />
                        <Skeleton className="h-2.5 w-20" />
                      </div>
                    </Card>
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
                  <Card className="mt-3 flex flex-col items-center gap-2 border border-dashed border-border px-4 py-10 text-center ring-0">
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
                      className={cn(
                        buttonVariants({ size: "lg" }),
                        "mt-1 gap-1.5 text-[11px] font-bold"
                      )}
                    >
                      <ExternalLink className="size-3.5" />
                      Allow repositories on GitHub
                    </a>
                  </Card>
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
                      <Button
                        key={repo.id}
                        type="button"
                        variant="outline"
                        disabled={connected}
                        onClick={() => setSelected(repo)}
                        className={cn(
                          "h-auto w-full items-center justify-start gap-3 p-2.5 text-left font-normal",
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border",
                          connected
                            ? "cursor-not-allowed opacity-50"
                            : "hover:border-primary/50"
                        )}
                      >
                        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-secondary">
                          <FrameworkLogo framework={repo.framework} />
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
                      </Button>
                    )
                  })}
                </div>
              )}

              <Actions>
                <Button
                  type="button"
                  size="lg"
                  disabled={selected === null}
                  onClick={() => goToStep(2)}
                  className="gap-2 text-[11px] font-bold"
                >
                  Continue <ArrowUpRight className="size-3.5" />
                </Button>
              </Actions>
            </>
          )}

          {step === 2 && !selectedIsStatic && selected && (
            <>
              <StepTitle
                icon={<Cpu className="size-5" />}
                title="Configure resources"
                description="Choose how much CPU, memory and storage your service gets — or let it autoscale."
              />

              <div className="mt-5 grid grid-cols-4 gap-3 border-t border-border pt-5 max-lg:grid-cols-2 max-sm:grid-cols-1">
                {deploymentPlanIds.map((id) => {
                  const planOption = DEPLOYMENT_PLANS[id]
                  const active = !autoscaling && plan === id

                  return (
                    <Button
                      key={id}
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setAutoscaling(false)
                        setPlan(id)
                      }}
                      className={cn(
                        "h-auto flex-col items-start gap-1.5 p-3 text-left font-normal",
                        active
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <span className="flex w-full items-center justify-between">
                        <strong className="text-[12px] font-semibold">
                          {planOption.label}
                        </strong>
                        {active && <Check className="size-3.5 text-primary" />}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {planOption.cpuMillicores} m CPU
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {planOption.memoryMb} MB memory
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {planOption.ephemeralStorageMb} MB storage
                      </span>
                    </Button>
                  )
                })}

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAutoscaling(true)}
                  className={cn(
                    "h-auto flex-col items-start gap-1.5 p-3 text-left font-normal",
                    autoscaling
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <span className="flex w-full items-center justify-between">
                    <strong className="text-[12px] font-semibold">
                      Autoscale
                    </strong>
                    {autoscaling && <Check className="size-3.5 text-primary" />}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Up to {AUTOSCALING.maxReplicas} replicas
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Target {AUTOSCALING.targetCpuUtilization}% CPU
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Scale on demand
                  </span>
                </Button>
              </div>

              <Actions>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => goToStep(1)}
                  className="text-[11px]"
                >
                  Back
                </Button>
                <Button
                  type="button"
                  size="lg"
                  onClick={() => goToStep(3)}
                  className="gap-2 text-[11px] font-bold"
                >
                  Continue <ArrowUpRight className="size-3.5" />
                </Button>
              </Actions>
            </>
          )}

          {isLastStep && selected && (
            <>
              <StepTitle
                icon={<Rocket className="size-5" />}
                title="Ready to deploy"
                description="Review your selection before creating the project."
              />

              <div className="mt-5 grid grid-cols-2 gap-5 border-t border-border pt-5 max-sm:grid-cols-1">
                <Summary label="Repository" value={selected.fullName} />
                <Summary label="Branch" value={selected.defaultBranch} />
                {!selectedIsStatic && (
                  <Summary
                    label="Resources"
                    value={
                      autoscaling
                        ? `Autoscale · up to ${AUTOSCALING.maxReplicas} replicas · ${AUTOSCALING.targetCpuUtilization}% CPU`
                        : `${DEPLOYMENT_PLANS[plan].label} · ${DEPLOYMENT_PLANS[plan].cpuMillicores}m / ${DEPLOYMENT_PLANS[plan].memoryMb}MB`
                    }
                  />
                )}
              </div>

              <Label className="mt-5 flex-col items-start gap-1.5 text-sm font-normal text-muted-foreground">
                Project name
                <Input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder={repoShortName(selected)}
                  disabled={deployment.isPending}
                  className="h-auto py-2 text-[11px]"
                />
              </Label>
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
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  disabled={deployment.isPending}
                  onClick={() => goToStep(step - 1)}
                  className="text-[11px]"
                >
                  Back
                </Button>
                <Button
                  type="button"
                  size="lg"
                  disabled={!canDeploy}
                  onClick={startDeployment}
                  className="gap-2 text-[11px] font-bold"
                >
                  {deployment.isPending
                    ? "Starting deployment…"
                    : "Deploy project"}
                  {deployment.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Rocket className="size-3.5" />
                  )}
                </Button>
              </Actions>
            </>
          )}
        </Card>
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
    <Alert
      variant="destructive"
      className="mt-3 flex items-center gap-2 rounded-md border-rose-500/20 bg-rose-500/5 px-3 py-2.5 text-[11px] text-rose-300"
    >
      <AlertCircle className="size-3.5 shrink-0" />
      <AlertTitle className="flex-1 text-[11px] font-normal text-inherit">
        {message}
      </AlertTitle>
      {onRetry && (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={onRetry}
          className="shrink-0 gap-1 text-rose-200 hover:bg-transparent hover:text-rose-100"
        >
          <RefreshCw className="size-3" />
          Retry
        </Button>
      )}
    </Alert>
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
