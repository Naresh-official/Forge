import { appNameForDeployment, namespaceForDeployment } from "@/kubernetes"
import { KubernetesClient } from "@/kubernetes"
import logger from "@/utils/logger"
import type { CancelDeploymentJob, CancelDeploymentsJob } from "@/queue/queue"

const kubernetes = new KubernetesClient()

export async function cancelDeployment(
  job: CancelDeploymentJob
): Promise<{ deploymentId: string; paused: boolean; skipped: boolean }> {
  const { deploymentId, projectId, reason } = job

  logger.info(
    `[CancelWorker] Cancelling deployment ${deploymentId} of project ${projectId} (${reason})`
  )

  const namespace = namespaceForDeployment(projectId, deploymentId)
  const name = appNameForDeployment(deploymentId)

  let workload

  try {
    workload = await kubernetes.describeWorkload({
      namespace,
      name,
    })
  } catch (error) {
    logger.warn(
      `[CancelWorker] Could not read workload ${namespace}/${name}: ${error instanceof Error ? error.message : error}`
    )
    return { deploymentId, paused: false, skipped: true }
  }

  if (!workload) {
    logger.info(
      `[CancelWorker] No Kubernetes workload for ${namespace}/${name} — nothing to cancel`
    )
    return { deploymentId, paused: false, skipped: true }
  }

  try {
    await kubernetes.scaleWorkload({
      namespace,
      name,
      replicas: 0,
      autoscalingEnabled: workload.autoscalingEnabled,
    })

    logger.info(
      `[CancelWorker] Paused workload ${namespace}/${name} (desired ${workload.desiredReplicas} → 0)`
    )

    return { deploymentId, paused: true, skipped: false }
  } catch (error) {
    logger.error(
      error,
      `[CancelWorker] Failed to pause workload for deployment ${deploymentId}`
    )
    throw error
  }
}

export async function cancelDeployments(job: CancelDeploymentsJob): Promise<{
  projectId: string
  canceled: string[]
  skipped: string[]
}> {
  const { projectId, deploymentIds, reason } = job

  logger.info(
    `[CancelWorker] Cancelling ${deploymentIds.length} deployment(s) for project ${projectId} (${reason})`
  )

  const canceled: string[] = []
  const skipped: string[] = []

  for (const deploymentId of deploymentIds) {
    try {
      const result = await cancelDeployment({
        deploymentId,
        projectId,
        reason,
      })

      if (result.skipped) {
        skipped.push(deploymentId)
      } else {
        canceled.push(deploymentId)
      }
    } catch (error) {
      logger.error(
        error,
        `[CancelWorker] Failed to cancel deployment ${deploymentId}; continuing with the rest`
      )
      skipped.push(deploymentId)
    }
  }

  logger.info(
    `[CancelWorker] Finished cancelling project ${projectId}: ${canceled.length} paused, ${skipped.length} skipped`
  )

  return { projectId, canceled, skipped }
}
