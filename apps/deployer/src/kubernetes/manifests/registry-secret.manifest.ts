import { FORGE_MANAGED_BY_LABELS } from "../constants"

/**
 * Builds a `kubernetes.io/dockerconfigjson` Secret manifest used as an
 * imagePullSecret so Kubernetes can pull private images (e.g. Amazon ECR).
 */
export function buildDockerRegistrySecretManifest(params: {
  name: string
  namespace: string
  registryHost: string
  username: string
  password: string
}) {
  const { name, namespace, registryHost, username, password } = params

  const auth = Buffer.from(`${username}:${password}`).toString("base64")

  const dockerConfigJson = Buffer.from(
    JSON.stringify({
      auths: {
        [registryHost]: {
          username,
          password,
          auth,
        },
      },
    })
  ).toString("base64")

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
    type: "kubernetes.io/dockerconfigjson",
    data: {
      ".dockerconfigjson": dockerConfigJson,
    },
  }
}
