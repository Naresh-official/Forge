import { KubeHttpClient, hasHttpStatus } from "../http/kube-http.client"
import { buildHpaManifest } from "../manifests/hpa.manifest"
import {
  HPA_MAX_REPLICAS,
  HPA_MIN_REPLICAS,
  HPA_TARGET_CPU_UTILIZATION,
} from "../constants"
import type { WorkloadRef } from "../types"

const HPA_PATH = (namespace: string) =>
  `/apis/autoscaling/v2/namespaces/${namespace}/horizontalpodautoscalers`

export interface HpaCondition {
  type: string
  status: string
  reason?: string
  message?: string
}

/** The autoscaler state the resources view reports. */
export interface HpaSnapshot {
  minReplicas: number
  maxReplicas: number
  targetCpuUtilization: number
  /** Average CPU utilisation in percent of requests; null when unreadable. */
  currentCpuUtilization: number | null
  currentReplicas: number
  desiredReplicas: number
  conditions: HpaCondition[]
}

interface KubeHpa {
  spec?: {
    minReplicas?: number
    maxReplicas?: number
    metrics?: Array<{
      type?: string
      resource?: {
        name?: string
        target?: { type?: string; averageUtilization?: number }
      }
    }>
  }
  status?: {
    currentReplicas?: number
    desiredReplicas?: number
    currentMetrics?: Array<{
      type?: string
      resource?: { name?: string; current?: { averageUtilization?: number } }
    }>
    conditions?: HpaCondition[]
  }
}

export class HpaApi {
  constructor(private readonly http: KubeHttpClient) {}

  /**
   * Reads the HPA's configured targets and last observed state. Returns null
   * when the workload is not autoscaled (no HPA in the namespace).
   */
  async find(namespace: string, name: string): Promise<HpaSnapshot | null> {
    let hpa: KubeHpa

    try {
      hpa = await this.http.get<KubeHpa>(`${HPA_PATH(namespace)}/${name}`)
    } catch (error) {
      if (hasHttpStatus(error, 404)) {
        return null
      }
      throw error
    }

    const cpuMetric = (hpa.spec?.metrics ?? []).find(
      (metric) => metric.type === "Resource" && metric.resource?.name === "cpu"
    )

    const cpuReading = (hpa.status?.currentMetrics ?? []).find(
      (metric) => metric.type === "Resource" && metric.resource?.name === "cpu"
    )

    return {
      minReplicas: hpa.spec?.minReplicas ?? HPA_MIN_REPLICAS,
      maxReplicas: hpa.spec?.maxReplicas ?? HPA_MAX_REPLICAS,
      targetCpuUtilization:
        cpuMetric?.resource?.target?.averageUtilization ??
        HPA_TARGET_CPU_UTILIZATION,
      currentCpuUtilization:
        cpuReading?.resource?.current?.averageUtilization ?? null,
      currentReplicas: hpa.status?.currentReplicas ?? 0,
      desiredReplicas: hpa.status?.desiredReplicas ?? 0,
      conditions: hpa.status?.conditions ?? [],
    }
  }

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
