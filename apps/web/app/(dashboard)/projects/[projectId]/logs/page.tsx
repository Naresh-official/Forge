import { ProjectLogs } from "../components/project-logs"

export default async function Page({
    params,
}: {
    params: Promise<{ projectId: string }>
}) {
    const { projectId } = await params
    return <ProjectLogs projectId={projectId} />
}
