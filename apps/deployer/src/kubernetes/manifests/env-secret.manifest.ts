import { createHash } from "crypto"
import { FORGE_MANAGED_BY_LABELS } from "../constants"

/**
 * Builds an Opaque Secret holding a deployment's project environment
 * variables. It lives in the same namespace as the Deployment that consumes
 * it and is referenced with `secretKeyRef`, so values never appear in the
 * pod manifest.
 *
 * `stringData` is used instead of `data` so Kubernetes performs the base64
 * encoding.
 */
export function buildEnvSecretManifest(params: {
  name: string
  namespace: string
  variables: Record<string, string>
}) {
  const { name, namespace, variables } = params

  return {
    apiVersion: "v1",
    kind: "Secret",
    metadata: {
      name,
      namespace,
      labels: {
        ...FORGE_MANAGED_BY_LABELS,
      },
    },
    type: "Opaque",
    stringData: { ...variables },
  }
}

/**
 * Stable digest of a variable set, stored as a pod-template annotation so a
 * changed environment (added/removed/rotated variables) changes the
 * Deployment spec and triggers a rollout. Updating a Secret on its own never
 * restarts running pods.
 */
export function hashEnvVariables(variables: Record<string, string>): string {
  const canonical = Object.keys(variables)
    .sort()
    .map((key) => `${key}=${variables[key]}`)
    .join("\n")

  return createHash("sha256").update(canonical).digest("hex")
}
