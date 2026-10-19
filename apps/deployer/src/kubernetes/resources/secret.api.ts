import { KubeHttpClient, hasHttpStatus } from "../http/kube-http.client"
import { buildDockerRegistrySecretManifest } from "../manifests/registry-secret.manifest"
import { buildEnvSecretManifest } from "../manifests/env-secret.manifest"
import type { RegistryPullSecretParams } from "../types"

export class SecretApi {
  constructor(private readonly http: KubeHttpClient) {}

  /**
   * Creates a docker-registry Secret the Deployment uses to pull
   * private images (e.g. Amazon ECR). Idempotent: if a Secret with
   * the same name already exists it is left untouched.
   */
  async ensureDockerRegistrySecret(
    namespace: string,
    name: string,
    params: RegistryPullSecretParams
  ): Promise<void> {
    try {
      await this.http.post(
        `/api/v1/namespaces/${namespace}/secrets`,
        buildDockerRegistrySecretManifest({
          name,
          namespace,
          registryHost: params.registryHost,
          username: params.username,
          password: params.password,
        })
      )
    } catch (error) {
      // 409 AlreadyExists — keep the existing secret
      if (hasHttpStatus(error, 409)) {
        return
      }
      throw error
    }
  }

  /**
   * Creates (or replaces) the Secret holding a deployment's environment
   * variables, in the deployment's own namespace.
   *
   * Idempotent across redeploys: an existing Secret is replaced with the full
   * new variable set, so removed variables do not linger from a previous
   * build.
   */
  async ensureEnvSecret(
    namespace: string,
    name: string,
    variables: Record<string, string>
  ): Promise<void> {
    const manifest = buildEnvSecretManifest({ name, namespace, variables })

    try {
      await this.http.post(`/api/v1/namespaces/${namespace}/secrets`, manifest)
    } catch (error) {
      if (!hasHttpStatus(error, 409)) {
        throw error
      }

      // Already exists — replace it so the latest values win.
      await this.http.put(
        `/api/v1/namespaces/${namespace}/secrets/${name}`,
        manifest
      )
    }
  }
}
