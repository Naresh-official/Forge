"use client"

import { useRouter } from "next/navigation"
import { getProject } from "@/lib/forge-data"
import { DeploymentTable } from "../../../deployments/components/deployments-view"
import { PageHeader } from "../../../_components/ui"
import { useToast } from "../../../_components/toast-provider"
import { ProjectHeader } from "./project-header"

export function ProjectDeployments({ projectId }: { projectId: string }) {
  const router = useRouter()
  const { notify } = useToast()
  const project = getProject(projectId)
  if (!project) return <div>Project not found.</div>
  return <>
    <ProjectHeader project={project} />
    <PageHeader title="Deployments" description="Deployment history for this project." action="Deploy" onAction={() => notify("Deployment started")} />
    <DeploymentTable onSelect={(d) => router.push(`/projects/${project.id}/deployments/${d.id}`)} />
  </>
}
