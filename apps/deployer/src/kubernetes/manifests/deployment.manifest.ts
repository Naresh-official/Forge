import {
  buildContainerResources,
  ENV_SECRET_HASH_ANNOTATION,
  FORGE_MANAGED_BY_LABELS,
} from "../constants"
import type { DeployContainerParams } from "../types"
import { hashEnvVariables } from "./env-secret.manifest"

export function buildDeploymentManifest(params: DeployContainerParams) {
  const { namespace, name, image, containerPort, env = [], envSecret } = params

  /*
   * Project variables are injected with secretKeyRef (never as literal
   * values), so the pod spec only references the Secret by name/key.
   */
  const secretEnv = envSecret
    ? Object.keys(envSecret.variables).map((key) => ({
        name: key,
        valueFrom: {
          secretKeyRef: {
            name: envSecret.name,
            key,
          },
        },
      }))
    : []

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
          /*
           * Digest of the environment so a changed Secret set rewrites the
           * pod template and rolls the Deployment — an updated Secret alone
           * leaves running pods untouched.
           */
          ...(envSecret
            ? {
                annotations: {
                  [ENV_SECRET_HASH_ANNOTATION]: hashEnvVariables(
                    envSecret.variables
                  ),
                },
              }
            : {}),
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
              env: [...env, ...secretEnv],
              resources: buildContainerResources(params.resources),
            },
          ],
        },
      },
    },
  }
}
