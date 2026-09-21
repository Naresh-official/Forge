import { KubeHttpClient, hasHttpStatus } from "../http/kube-http.client"
import { buildDeploymentManifest } from "../manifests/deployment.manifest"
import type { DeployContainerParams } from "../types"

export class DeploymentApi {
  constructor(private readonly http: KubeHttpClient) {}

  async create(params: DeployContainerParams): Promise<void> {
    const { namespace, name } = params

    await this.http.post(
      `/apis/apps/v1/namespaces/${namespace}/deployments`,
      buildDeploymentManifest(params)
    )
  }

  /**
   * Updates the pod template of an existing Deployment (e.g. new image),
   * triggering a rollout.
   */
  async update(params: DeployContainerParams): Promise<void> {
    const { namespace, name } = params

    await this.http.patch(
      `/apis/apps/v1/namespaces/${namespace}/deployments/${name}`,
      buildDeploymentManifest(params)
    )
  }

  /**
   * Creates the Deployment, or patches the existing one when it already
   * exists (HTTP 409). Idempotent and safe to retry.
   */
  async ensure(params: DeployContainerParams): Promise<"created" | "updated"> {
    try {
      await this.create(params)
      return "created"
    } catch (error) {
      if (hasHttpStatus(error, 409)) {
        await this.update(params)
        return "updated"
      }
      throw error
    }
  }
}
