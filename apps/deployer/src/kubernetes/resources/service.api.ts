import { KubeHttpClient } from "../http/kube-http.client"
import { buildServiceManifest } from "../manifests/service.manifest"
import type { DeployContainerParams } from "../types"

export class ServiceApi {
  constructor(private readonly http: KubeHttpClient) {}

  async create(params: DeployContainerParams): Promise<void> {
    const { namespace, name } = params

    await this.http.post(
      `/api/v1/namespaces/${namespace}/services`,
      buildServiceManifest(params)
    )
  }
}
