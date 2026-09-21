import { KubeHttpClient } from "../http/kube-http.client"
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
}
