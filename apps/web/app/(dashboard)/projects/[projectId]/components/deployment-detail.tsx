"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  GitBranch,
  Loader2,
  RefreshCw,
  Rocket,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { getDeployment, redeployDeployment } from "@forge/api-client/deployment"
import type { DeploymentDetailResponse } from "@forge/types/deployment"
import { Alert, AlertTitle } from "@forge/ui/components/alert"
import { Button } from "@forge/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@forge/ui/components/card"
import { Skeleton } from "@forge/ui/components/skeleton"
import { cn } from "@forge/ui/lib/utils"
import { CopyButton, StatusBadge } from "../../../_components/ui"
import { useToast } from "../../../_components/toast-provider"
import {
  formatDeploymentDuration,
  formatElapsed,
  formatRelativeTime,
  formatRuntime,
  isDeploymentActive,
} from "@/lib/deployment-format"
import { DeploymentLogs } from "./deployment-logs"

/** How often the page refreshes while the deployment is still moving. */
const ACTIVE_REFETCH_INTERVAL_MS = 5_000

type Stage = {
  label: string
  at: Date | null
  until: Date | null
}

function toDate(value: Date | string | null | undefined): Date | null {
  return value ? new Date(value) : null
}

/**
 * The pipeline as Forge actually records it: when the deployment was queued,
 * when the build ran, when the deployer started, and how it ended. There is no
 * separate "uploading" stage timestamp, so it is not invented here.
 */
function buildStages(deployment: DeploymentDetailResponse): Stage[] {
  const build = deployment.build

  const finishLabel =
    deployment.status === "READY"
      ? "Ready"
      : deployment.status === "FAILED"
        ? "Failed"
        : deployment.status === "CANCELLED"
          ? "Cancelled"
          : "Ready"

  return [
    {
      label: "Queued",
      at: toDate(deployment.createdAt),
      until: toDate(build?.startedAt ?? deployment.startedAt),
    },
    {
      label: "Building",
      at: toDate(build?.startedAt),
      until: toDate(build?.completedAt),
    },
    {
      label: "Deploying",
      at: toDate(deployment.startedAt),
      until: toDate(deployment.completedAt),
    },
    {
      label: finishLabel,
      at: toDate(deployment.completedAt ?? build?.completedAt),
      until: null,
    },
  ]
}

function stageCaption(stage: Stage, deployment: DeploymentDetailResponse) {
  if (stage.at && stage.until) {
    return formatElapsed(stage.at, stage.until)
  }

  if (stage.at) {
    if (deployment.status === "READY") return "completed"
    if (deployment.status === "FAILED" || deployment.status === "CANCELLED") {
      return "stopped"
    }
    return "in progress"
  }

  return "pending"
}

function stageTone(stage: Stage, deployment: DeploymentDetailResponse) {
  const failed =
    deployment.status === "FAILED" || deployment.status === "CANCELLED"
  const isLast =
    stage.label === "Ready" ||
    stage.label === "Failed" ||
    stage.label === "Cancelled"

  if (stage.at) {
    return "border-primary"
  }

  if (failed && isLast) {
    return "border-rose-500/60"
  }

  return "border-border"
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

function Info({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[9px] text-muted-foreground">{label}</span>
      <strong className="text-[11px] font-medium">{children}</strong>
    </div>
  )
}

export function DeploymentDetail({
  projectId,
  deploymentId,
}: {
  projectId: string
  deploymentId: string
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { notify } = useToast()

  const deploymentQuery = useQuery({
    queryKey: ["deployment", deploymentId],
    queryFn: () => getDeployment(deploymentId),
    refetchInterval: (query) =>
      isDeploymentActive(query.state.data?.data.status ?? "")
        ? ACTIVE_REFETCH_INTERVAL_MS
        : false,
  })

  const deployment = deploymentQuery.data?.data

  const redeployMutation = useMutation({
    mutationFn: () => redeployDeployment(deploymentId),
    onSuccess: (response) => {
      notify(`Deployment #${response.data.deploymentNumber} queued`)
      void queryClient.invalidateQueries({ queryKey: ["deployments"] })
      void queryClient.invalidateQueries({
        queryKey: ["project-deployments", projectId],
      })
      void queryClient.invalidateQueries({ queryKey: ["projects"] })
      router.push(
        `/projects/${projectId}/deployments/${response.data.deploymentId}`
      )
    },
    onError: (error: Error) => notify(error.message),
  })

  if (deploymentQuery.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (deploymentQuery.isError || !deployment) {
    return (
      <>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/projects/${projectId}/deployments`)}
          className="mb-5 gap-1.5 px-0 text-[11px] text-muted-foreground hover:bg-transparent hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Deployments
        </Button>
        <InlineError
          message={
            deploymentQuery.isError
              ? deploymentQuery.error.message
              : "Deployment not found."
          }
          onRetry={() => deploymentQuery.refetch()}
        />
      </>
    )
  }

  const stages = buildStages(deployment)
  const isReady = deployment.status === "READY"

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() =>
          router.push(`/projects/${deployment.project.id}/deployments`)
        }
        className="mb-5 gap-1.5 px-0 text-[11px] text-muted-foreground hover:bg-transparent hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> {deployment.project.name} deployments
      </Button>

      <div className="mb-5">
        <p className="mb-2 font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
          deployment {deployment.id.slice(0, 8)}
        </p>
        <h1 className="text-3xl font-semibold tracking-[-.045em]">
          Deployment #{deployment.deploymentNumber}
        </h1>
        <p className="mt-2 text-xs text-muted-foreground">
          {deployment.commitMessage || "No commit message"} ·{" "}
          {formatRelativeTime(deployment.createdAt)}
        </p>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <StatusBadge status={deployment.status} />

        <Button
          type="button"
          variant="outline"
          onClick={() => redeployMutation.mutate()}
          disabled={redeployMutation.isPending}
          className="gap-2"
        >
          {redeployMutation.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Rocket className="size-3.5" />
          )}
          Redeploy
        </Button>

        {isReady && (
          <Button
            nativeButton={false}
            variant="outline"
            render={
              <a
                href={`https://${deployment.project.slug}.forge.run`}
                target="_blank"
                rel="noreferrer"
              />
            }
            className="gap-2"
          >
            Visit <ExternalLink className="size-3.5" />
          </Button>
        )}

        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Refresh deployment"
          disabled={deploymentQuery.isFetching}
          onClick={() => deploymentQuery.refetch()}
          className="text-muted-foreground hover:text-foreground"
        >
          <RefreshCw
            className={cn(
              "size-3.5",
              deploymentQuery.isFetching && "animate-spin"
            )}
          />
        </Button>
      </div>

      <Card className="mb-3 [--card-spacing:--spacing(4.5)]">
        <CardHeader>
          <CardTitle className="text-xs">Deployment timeline</CardTitle>
          <CardDescription className="text-sm">
            Build pipeline events
          </CardDescription>
        </CardHeader>
        <CardContent className="mt-6 overflow-auto">
          <div className="grid min-w-[600px] grid-cols-4">
            {stages.map((stage) => (
              <div
                key={stage.label}
                className={cn("border-t-2 pt-3", stageTone(stage, deployment))}
              >
                <span className="text-[11px] font-semibold">{stage.label}</span>
                <small className="mt-1 block text-[9px] text-muted-foreground">
                  {stageCaption(stage, deployment)}
                  {stage.at ? ` · ${stage.at.toLocaleTimeString()}` : ""}
                </small>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-3 [--card-spacing:--spacing(4.5)]">
        <CardHeader>
          <CardTitle className="text-xs">Deployment information</CardTitle>
          <CardDescription className="text-sm">
            Source, runtime and resource plan
          </CardDescription>
        </CardHeader>
        <CardContent className="mt-5 grid grid-cols-3 gap-5 max-lg:grid-cols-2 max-sm:grid-cols-1">
          <Info label="Project">
            <a
              href={`/projects/${deployment.project.id}`}
              className="text-primary"
            >
              {deployment.project.name}
            </a>
          </Info>
          <Info label="Branch">
            <span className="inline-flex items-center gap-1 font-mono">
              <GitBranch className="size-3" />
              {deployment.branch}
            </span>
          </Info>
          <Info label="Commit SHA">
            <span className="inline-flex items-center gap-1.5 font-mono">
              {deployment.commitSha.slice(0, 12)}
              <CopyButton value={deployment.commitSha} />
            </span>
          </Info>
          <Info label="Runtime">{formatRuntime(deployment.runtime)}</Info>
          <Info label="Build">{deployment.build?.status ?? "Not started"}</Info>
          <Info label="Duration">{formatDeploymentDuration(deployment)}</Info>
          <Info label="Resource plan">
            {deployment.resources
              ? `${deployment.resources.cpuMillicores}m CPU · ${deployment.resources.memoryMb} MB · ${deployment.resources.ephemeralStorageMb} MB storage`
              : "—"}
          </Info>
          <Info label="Scaling">
            {deployment.resources
              ? deployment.resources.autoscalingEnabled
                ? "Autoscaling"
                : "Fixed replicas"
              : "—"}
          </Info>
          <Info label="Image tag">
            <span className="font-mono">{deployment.imageTag ?? "—"}</span>
          </Info>
          <Info label="Started by">
            {deployment.createdBy
              ? (deployment.createdBy.name ?? deployment.createdBy.email)
              : "—"}
          </Info>
          <Info label="Created">
            {new Date(deployment.createdAt).toLocaleString()}
          </Info>
          <Info label="Completed">
            {deployment.completedAt
              ? new Date(deployment.completedAt).toLocaleString()
              : "—"}
          </Info>
        </CardContent>
      </Card>

      <div className="mt-3">
        <DeploymentLogs
          deploymentId={deployment.id}
          status={deployment.status}
        />
      </div>
    </>
  )
}
