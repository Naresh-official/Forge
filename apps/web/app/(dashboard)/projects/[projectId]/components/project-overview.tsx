"use client"

import { ArrowUpRight, ExternalLink, Rocket } from "lucide-react"
import { useRouter } from "next/navigation"
import { deployments, getProject } from "@/lib/forge-data"
import { DeploymentTable } from "../../../deployments/components/deployments-view"
import { PageHeader, StatusBadge } from "../../../_components/ui"
import { useToast } from "../../../_components/toast-provider"
import { ProjectHeader } from "./project-header"

export function ProjectOverview({ projectId }: { projectId: string }) {
  const router = useRouter()
  const { notify } = useToast()
  const project = getProject(projectId)

  if (!project) return <div>Project not found.</div>

  return (
    <>
      <ProjectHeader project={project} />
      <PageHeader
        title="Project overview"
        description="A calm view of what is running in production."
        action="Deploy"
        onAction={() => notify("Deployment started")}
      />
      <section className="mb-3 grid grid-cols-2 gap-3 max-lg:grid-cols-1">
        <article className="rounded-lg border border-border bg-card p-[18px]">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xs font-semibold">Production deployment</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {deployments[0].message}
              </p>
            </div>
            <StatusBadge status="Ready" />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-5">
            <Info label="Deployment" value={deployments[0].id} />
            <Info label="Commit" value={deployments[0].commit} />
            <Info label="Branch" value="main" />
            <Info label="Build duration" value="42s" />
          </div>
          <div className="mt-5 flex gap-2">
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
        </article>
        <article className="rounded-lg border border-border bg-card p-[18px]">
          <h2 className="text-xs font-semibold">Resource overview</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Current allocation and usage
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            {[
              ["CPU", "42%"],
              ["Memory", "1.8 GB"],
              ["Network", "842 GB"],
              ["Requests", "2.4M"],
            ].map(([a, b]) => (
              <div key={a} className="rounded-md border border-border p-3">
                <span className="text-[9px] text-muted-foreground">{a}</span>
                <strong className="mt-2 block font-mono text-lg">{b}</strong>
                <div className="mt-2 h-0.5 bg-border">
                  <span className="block h-full w-2/3 bg-primary" />
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
      <article className="rounded-lg border border-border bg-card p-[18px]">
        <div className="flex justify-between">
          <div>
            <h2 className="text-xs font-semibold">Latest deployments</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Recent activity for {project.name}
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push(`/projects/${project.id}/deployments`)}
            className="inline-flex items-center text-sm text-primary"
          >
            View all <ArrowUpRight className="ml-1 size-3.5" />
          </button>
        </div>
        <DeploymentTable
          onSelect={(d) =>
            router.push(`/projects/${project.id}/deployments/${d.id}`)
          }
        />
      </article>
    </>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[9px] text-muted-foreground">{label}</span>
      <strong className="text-[11px] font-medium">{value}</strong>
    </div>
  )
}
