/**
 * Derive a deterministic, DNS-safe name from a raw id.
 * K8s names must be <= 63 chars, lowercase alphanumeric + hyphens.
 */
export function sanitizeK8sName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 63)
}

/**
 * Namespace that hosts a deployment —
 * `forge-project-<projectId>-<deploymentId>`.
 *
 * Note: K8s namespace names are capped at 63 chars, so with two full UUIDs
 * the tail of the deploymentId gets truncated by `sanitizeK8sName`.
 */
export function namespaceForDeployment(
  projectId: string,
  deploymentId: string
): string {
  return sanitizeK8sName(`forge-project-${projectId}/${deploymentId}`)
}

/** Name of the Deployment + Service for a deployment — `app-<deploymentId>`. */
export function appNameForDeployment(deploymentId: string): string {
  return `app-${sanitizeK8sName(deploymentId)}`
}
