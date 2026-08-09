import { ProjectEnvironmentVariables } from "../components/project-environment-variables"

export default async function Page({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  return <ProjectEnvironmentVariables projectId={projectId} />
}
