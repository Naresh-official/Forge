import { KubeHttpClient } from "../http/kube-http.client"
import { parseCpuMillicores, parseMemoryMb } from "../quantity"
import logger from "@/utils/logger"

/** Aggregate CPU/memory usage of the pods matching a label selector. */
export interface PodUsage {
  /** False when the metrics API is missing or could not be read. */
  available: boolean
  cpuMillicores: number
  memoryMb: number
  /** RFC 3339 timestamp of the newest sample, or null when unavailable. */
  timestamp: string | null
}

interface PodMetricsList {
  items?: Array<{
    metadata?: { name?: string }
    /** Sample time of this pod's metrics. */
    timestamp?: string
    containers?: Array<{ name?: string; usage?: Record<string, string> }>
  }>
}

/**
 * Client for the cluster's resource-metrics API (`metrics.k8s.io`), served by
 * metrics-server. It is deliberately optional: a cluster without
 * metrics-server still deploys, it just has no usage numbers to show.
 */
export class MetricsApi {
  constructor(private readonly http: KubeHttpClient) {}

  async podUsage(namespace: string, labelSelector: string): Promise<PodUsage> {
    const path =
      `/apis/metrics.k8s.io/v1beta1/namespaces/${namespace}/pods` +
      `?labelSelector=${encodeURIComponent(labelSelector)}`

    let list: PodMetricsList

    try {
      list = await this.http.get<PodMetricsList>(path)
    } catch (error) {
      /*
       * A missing metrics API (404) or an unavailable metrics-server (503)
       * only means there is no live usage to report. Anything else is worth a
       * log line, but it must not fail the whole request — allocation and
       * replica state are still useful.
       */
      logger.warn(
        `[k8s] Could not read pod metrics in ${namespace}: ${
          error instanceof Error ? error.message : error
        }`
      )

      return {
        available: false,
        cpuMillicores: 0,
        memoryMb: 0,
        timestamp: null,
      }
    }

    let cpuMillicores = 0
    let memoryMb = 0
    let timestamp: string | null = null

    for (const pod of list.items ?? []) {
      for (const container of pod.containers ?? []) {
        cpuMillicores += parseCpuMillicores(container.usage?.cpu) ?? 0
        memoryMb += parseMemoryMb(container.usage?.memory) ?? 0
      }

      if (pod.timestamp && (!timestamp || pod.timestamp > timestamp)) {
        timestamp = pod.timestamp
      }
    }

    return {
      available: true,
      cpuMillicores: Math.round(cpuMillicores),
      memoryMb: Math.round(memoryMb),
      timestamp,
    }
  }
}
