import { FORGE_MANAGED_BY_LABELS } from "../constants"

export function buildNamespaceManifest(name: string) {
  return {
    apiVersion: "v1",
    kind: "Namespace",
    metadata: {
      name,
      labels: FORGE_MANAGED_BY_LABELS,
    },
  }
}
