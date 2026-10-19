import { apiConfig } from "@forge/config"
import { deleteObjectsByPrefix } from "@forge/storage"

/**
 * Deletes every stored static artifact of a project except the newest
 * deployment's. Called after a static build succeeds — including the rebuild
 * triggered by an environment-variable change — so a project keeps only its
 * current output in object storage.
 *
 * Best-effort: failures are returned as human-readable warnings (and logged)
 * rather than thrown, because pruning is housekeeping and must never turn a
 * successful build into a failed one. No-op when storage is not configured.
 */
export async function pruneStaleArtifacts(
  projectId: string,
  keepDeploymentId: string
): Promise<string[]> {
  const storage = apiConfig.storage

  if (!storage.bucket || !storage.accessKeyId) {
    return []
  }

  try {
    const result = await deleteObjectsByPrefix(
      {
        region: storage.region,
        bucket: storage.bucket,
        accessKeyId: storage.accessKeyId,
        secretAccessKey: storage.secretAccessKey,
      },
      `${projectId}/`,
      // Artifacts are stored under "<projectId>/<deploymentId>/...".
      { excludePrefixes: [`${projectId}/${keepDeploymentId}/`] }
    )

    return result.deletedCount > 0
      ? [`Deleted ${result.deletedCount} stale artifact object(s).`]
      : []
  } catch (error) {
    console.error("Failed to prune stale build artifacts:", error)
    return ["Stale build artifacts could not be deleted."]
  }
}
