import { CONTAINER_RESOURCES, FORGE_MANAGED_BY_LABELS } from "../constants"
import type { DeployContainerParams } from "../types"

export function buildDeploymentManifest(params: DeployContainerParams) {
  const { namespace, name, image, containerPort, env = [] } = params

  const imagePullSecrets = params.imagePullSecret
    ? [{ name: params.imagePullSecret }]
    : undefined

  return {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: {
      name,
      namespace,
      labels: {
        app: name,
        ...FORGE_MANAGED_BY_LABELS,
      },
    },
    spec: {
      replicas: 1,
      selector: {
        matchLabels: {
          app: name,
        },
      },
      template: {
        metadata: {
          labels: {
            app: name,
            ...FORGE_MANAGED_BY_LABELS,
          },
        },
        spec: {
          ...(imagePullSecrets ? { imagePullSecrets } : {}),
          containers: [
            {
              name,
              image,
              ports: [
                {
                  containerPort,
                  protocol: "TCP",
                },
              ],
              env,
              resources: CONTAINER_RESOURCES,
            },
          ],
        },
      },
    },
  }
}
