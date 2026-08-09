import { ProjectDeployments } from "../components/project-deployments"

export default async function Page({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  return <ProjectDeployments projectId={projectId} />
}
