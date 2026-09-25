import { FORGE_MANAGED_BY_LABELS, SERVICE_PORT } from "../constants"
import type { DeployContainerParams } from "../types"

export function buildServiceManifest(params: DeployContainerParams) {
  const { namespace, name, containerPort } = params

  return {
    apiVersion: "v1",
    kind: "Service",
    metadata: {
      name,
      namespace,
      labels: {
        app: name,
        ...FORGE_MANAGED_BY_LABELS,
      },
    },
    spec: {
      selector: {
        app: name,
      },
      ports: [
        {
          port: SERVICE_PORT,
          // TODO: Remove hardcoded port 5000 to containerPort
          targetPort: 5000,
          protocol: "TCP",
        },
      ],
      type: "ClusterIP",
    },
  }
}
