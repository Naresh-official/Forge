"use client"

import { ArrowLeft, ExternalLink, Rocket } from "lucide-react"
import { useRouter } from "next/navigation"
import { getDeployment, getProject } from "@/lib/forge-data"
import { StatusBadge } from "../../../_components/ui"
import { useToast } from "../../../_components/toast-provider"
import { LogViewer } from "./project-logs"

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
      <button
        type="button"
        onClick={() => router.push(`/projects/${project.id}/deployments`)}
        className="mb-5 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"
      >
        <ArrowLeft className="size-3.5" /> {project.name} deployments
      </button>
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
        <button
          type="button"
          onClick={() => notify("Opening deployment")}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm"
        >
          Visit <ExternalLink className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => notify("Redeploy started")}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm"
        >
          Redeploy
        </button>
        <button
          type="button"
          onClick={() => notify("Rollback successful")}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm"
        >
          Rollback
        </button>
      </div>
      <article className="mb-3 overflow-auto rounded-lg border border-border bg-card p-[18px]">
        <h2 className="text-xs font-semibold">Deployment timeline</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Build pipeline events
        </p>
        <div className="mt-6 grid min-w-[600px] grid-cols-5">
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
      </article>
      <div className="grid grid-cols-2 gap-3 max-lg:grid-cols-1">
        <article className="rounded-lg border border-border bg-card p-[18px]">
          <h2 className="text-xs font-semibold">Deployment information</h2>
          <div className="mt-5 grid grid-cols-2 gap-5">
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
          </div>
        </article>
        <LogViewer />
      </div>
    </>
  )
}
