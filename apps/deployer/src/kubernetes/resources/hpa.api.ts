import { KubeHttpClient, hasHttpStatus } from "../http/kube-http.client"
import { buildHpaManifest } from "../manifests/hpa.manifest"
import type { WorkloadRef } from "../types"

const HPA_PATH = (namespace: string) =>
  `/apis/autoscaling/v2/namespaces/${namespace}/horizontalpodautoscalers`

export class HpaApi {
  constructor(private readonly http: KubeHttpClient) {}

  /**
   * Creates the HorizontalPodAutoscaler, or patches the existing one (409).
   * Idempotent and safe to retry.
   */
  async ensure(params: WorkloadRef): Promise<"created" | "updated"> {
    const { namespace, name } = params

    try {
      await this.http.post(HPA_PATH(namespace), buildHpaManifest(params))
      return "created"
    } catch (error) {
      if (hasHttpStatus(error, 409)) {
        await this.http.patch(
          `${HPA_PATH(namespace)}/${name}`,
          buildHpaManifest(params)
        )
        return "updated"
      }
      throw error
    }
  }

  /**
   * Deletes the HPA. Missing HPAs are ignored so pausing a non-autoscaling
   * service (or pausing twice) is a no-op.
   */
  async remove(namespace: string, name: string): Promise<void> {
    try {
      await this.http.delete(`${HPA_PATH(namespace)}/${name}`)
    } catch (error) {
      if (hasHttpStatus(error, 404)) {
        return
      }
      throw error
    }
  }
}
