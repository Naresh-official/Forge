"use client"

import { ArrowLeft, ExternalLink } from "lucide-react"
import { useRouter } from "next/navigation"
import { getDeployment, getProject } from "@/lib/forge-data"
import { Button } from "@forge/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@forge/ui/components/card"
import { StatusBadge } from "../../../_components/ui"
import { useToast } from "../../../_components/toast-provider"
import { DeploymentLogs } from "./deployment-logs"

export function DeploymentDetail({
  projectId,
  deploymentId,
}: {
  projectId: string
  deploymentId: string
}) {
  const router = useRouter()
  const { notify } = useToast()
  const project = getProject(projectId)
  const deployment = getDeployment(deploymentId)
  if (!project || !deployment) return <div>Deployment not found.</div>

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => router.push(`/projects/${project.id}/deployments`)}
        className="mb-5 gap-1.5 px-0 text-[11px] text-muted-foreground hover:bg-transparent hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> {project.name} deployments
      </Button>
      <div className="mb-5">
        <p className="mb-2 font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
          {deployment.id}
        </p>
        <h1 className="text-3xl font-semibold tracking-[-.045em]">
          Production deployment
        </h1>
        <p className="mt-2 text-xs text-muted-foreground">
          {deployment.message} · {deployment.created}
        </p>
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <StatusBadge status={deployment.status} />
        <Button
          type="button"
          variant="outline"
          onClick={() => notify("Opening deployment")}
          className="gap-2"
        >
          Visit <ExternalLink className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => notify("Redeploy started")}
        >
          Redeploy
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => notify("Rollback successful")}
        >
          Rollback
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
          <div className="grid min-w-[600px] grid-cols-5">
            {["Queued", "Building", "Uploading", "Deploying", "Ready"].map(
              (stage, i) => (
                <div
                  key={stage}
                  className={[
                    "border-t-2 pt-3",
                    i === 4 ? "border-primary" : "border-border",
                  ].join(" ")}
                >
                  <span className="text-[11px] font-semibold">{stage}</span>
                  <small className="mt-1 block text-[9px] text-muted-foreground">
                    {i === 4 ? "Ready now" : `${[2, 31, 6, 3][i]}s · completed`}
                  </small>
                </div>
              )
            )}
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 gap-3 max-lg:grid-cols-1">
        <Card className="[--card-spacing:--spacing(4.5)]">
          <CardHeader>
            <CardTitle className="text-xs">Deployment information</CardTitle>
          </CardHeader>
          <CardContent className="mt-5 grid grid-cols-2 gap-5">
            {[
              ["Project", project.name],
              ["Environment", deployment.environment],
              ["Commit SHA", deployment.commit],
              ["Region", "iad1 · Washington, DC"],
              ["Runtime", "Node.js 22"],
              ["Author", "Jordan Davis"],
            ].map(([a, b]) => (
              <div key={a}>
                <span className="text-[9px] text-muted-foreground">{a}</span>
                <strong className="mt-1.5 block text-[11px] font-medium">
                  {b}
                </strong>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <div className="mt-3">
        <DeploymentLogs deploymentId={deploymentId} />
      </div>
    </>
  )
}
