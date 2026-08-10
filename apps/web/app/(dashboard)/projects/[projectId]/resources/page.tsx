import { ProjectResources } from "../components/project-resources"

export default async function Page({
    params,
}: {
    params: Promise<{ projectId: string }>
}) {
    const { projectId } = await params
    return <ProjectResources projectId={projectId} />
}
