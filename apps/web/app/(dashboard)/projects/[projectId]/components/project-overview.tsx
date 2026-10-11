"use client"

import { ArrowUpRight, ExternalLink } from "lucide-react"
import { useRouter } from "next/navigation"
import { deployments, getProject } from "@/lib/forge-data"
import { Button } from "@forge/ui/components/button"
import {
  Card,
  CardAction,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@forge/ui/components/card"
import { Progress } from "@forge/ui/components/progress"
import { DeploymentTable } from "../../../deployments/components/deployments-view"
import { PageHeader, StatusBadge } from "../../../_components/ui"
import { useToast } from "../../../_components/toast-provider"
import { ProjectHeader } from "./project-header"

export function ProjectOverview({ projectId }: { projectId: string }) {
  const router = useRouter()
  const { notify } = useToast()
  const project = getProject(projectId)

  if (!project) return <div>Project not found.</div>

  const latest = deployments[0]

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
        <Card className="[--card-spacing:--spacing(4.5)]">
          <CardHeader>
            <CardTitle className="text-xs">Production deployment</CardTitle>
            <CardDescription className="text-sm">
              {latest?.message ?? "No deployments yet."}
            </CardDescription>
            <CardAction>
              <StatusBadge status="Ready" />
            </CardAction>
          </CardHeader>
          <CardContent className="mt-5 grid grid-cols-2 gap-5">
            <Info label="Deployment" value={latest?.id ?? "—"} />
            <Info label="Commit" value={latest?.commit ?? "—"} />
            <Info label="Branch" value="main" />
            <Info label="Build duration" value="42s" />
          </CardContent>
          <CardContent className="mt-5 flex gap-2">
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
          </CardContent>
        </Card>
        <Card className="[--card-spacing:--spacing(4.5)]">
          <CardHeader>
            <CardTitle className="text-xs">Resource overview</CardTitle>
            <CardDescription className="text-sm">
              Current allocation and usage
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-5 grid grid-cols-2 gap-2">
            {[
              ["CPU", "42%"],
              ["Memory", "1.8 GB"],
              ["Network", "842 GB"],
              ["Requests", "2.4M"],
            ].map(([a, b]) => (
              <div key={a} className="rounded-md border border-border p-3">
                <span className="text-[9px] text-muted-foreground">{a}</span>
                <strong className="mt-2 block font-mono text-lg">{b}</strong>
                <Progress value={66} className="mt-2 block" />
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
      <Card className="[--card-spacing:--spacing(4.5)]">
        <CardHeader>
          <CardTitle className="text-xs">Latest deployments</CardTitle>
          <CardDescription className="text-sm">
            Recent activity for {project.name}
          </CardDescription>
          <CardAction>
            <Button
              type="button"
              variant="link"
              onClick={() => router.push(`/projects/${project.id}/deployments`)}
              className="gap-1 text-sm"
            >
              View all <ArrowUpRight className="size-3.5" />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <DeploymentTable
            onSelect={(d) =>
              router.push(`/projects/${project.id}/deployments/${d.id}`)
            }
          />
        </CardContent>
      </Card>
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
