import { buildContainerResources, FORGE_MANAGED_BY_LABELS } from "../constants"
import type { DeployContainerParams } from "../types"

export function buildDeploymentManifest(params: DeployContainerParams) {
  const { namespace, name, image, containerPort, env = [] } = params

  /*
   * Identity labels carry the explicit Forge project/deployment ids (the
   * same values the worker received on the Deploy job) so every runtime log
   * record is routed by labels — never by parsing pod or namespace names,
   * both of which truncate UUIDs at 63 chars.
   */
  const projectId = params.projectId
  const deploymentId = params.deploymentId

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
        ...(projectId ? { "forge.dev/project-id": projectId } : {}),
        ...(deploymentId ? { "forge.dev/deployment-id": deploymentId } : {}),
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
            ...(projectId ? { "forge.dev/project-id": projectId } : {}),
            ...(deploymentId
              ? { "forge.dev/deployment-id": deploymentId }
              : {}),
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
              resources: buildContainerResources(params.resources),
            },
          ],
        },
      },
    },
  }
}
