import { DeploymentDetail } from "../../components/deployment-detail"

export default async function Page({
    params,
}: {
    params: Promise<{ projectId: string; deploymentId: string }>
}) {
    const { projectId, deploymentId } = await params
    return (
        <DeploymentDetail projectId={projectId} deploymentId={deploymentId} />
    )
}
