import {
  FORGE_MANAGED_BY_LABELS,
  HPA_MAX_REPLICAS,
  HPA_MIN_REPLICAS,
  HPA_TARGET_CPU_UTILIZATION,
} from "../constants"
import type { WorkloadRef } from "../types"

/**
 * HorizontalPodAutoscaler for an autoscaling project.
 *
 * Targets the Deployment by name and scales between HPA_MIN_REPLICAS and
 * HPA_MAX_REPLICAS, adding replicas when average CPU utilisation exceeds
 * HPA_TARGET_CPU_UTILIZATION. CPU utilisation is measured against the
 * container's resource requests, which `buildContainerResources` always sets.
 */
export function buildHpaManifest(params: WorkloadRef) {
  const { namespace, name } = params

  return {
    apiVersion: "autoscaling/v2",
    kind: "HorizontalPodAutoscaler",
    metadata: {
      name,
      namespace,
      labels: {
        app: name,
        ...FORGE_MANAGED_BY_LABELS,
      },
    },
    spec: {
      scaleTargetRef: {
        apiVersion: "apps/v1",
        kind: "Deployment",
        name,
      },
      minReplicas: HPA_MIN_REPLICAS,
      maxReplicas: HPA_MAX_REPLICAS,
      metrics: [
        {
          type: "Resource",
          resource: {
            name: "cpu",
            target: {
              type: "Utilization",
              averageUtilization: HPA_TARGET_CPU_UTILIZATION,
            },
          },
        },
      ],
    },
  }
}
