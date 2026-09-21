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

/** Namespace that hosts a deployment — `forge-project-<buildId>`. */
export function namespaceForBuild(buildId: string): string {
  return `forge-project-${sanitizeK8sName(buildId)}`
}

/** Name of the Deployment + Service for a deployment — `app-<deploymentId>`. */
export function appNameForDeployment(deploymentId: string): string {
  return `app-${sanitizeK8sName(deploymentId)}`
}
