import { ProjectDomains } from "../components/project-domains"

export default async function Page({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  return <ProjectDomains projectId={projectId} />
}
