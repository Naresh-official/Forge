import { KubeHttpClient, hasHttpStatus } from "../http/kube-http.client"
import { buildDeploymentManifest } from "../manifests/deployment.manifest"
import {
  buildContainerResources,
  ENV_SECRET_HASH_ANNOTATION,
} from "../constants"
import { parseCpuMillicores, parseMemoryMb } from "../quantity"
import type { ContainerResources, DeployContainerParams } from "../types"

/** The subset of a container env entry this API needs to reason about. */
interface ContainerEnvEntry {
  name?: string
  valueFrom?: { secretKeyRef?: { name?: string; key?: string } }
}

interface ContainerResourcesEntry {
  requests?: { cpu?: string; memory?: string }
}

interface RunningDeployment {
  spec?: {
    replicas?: number
    template?: {
      spec?: {
        containers?: Array<{
          name?: string
          env?: ContainerEnvEntry[]
          resources?: ContainerResourcesEntry
        }>
      }
    }
  }
  status?: {
    replicas?: number
    readyReplicas?: number
    availableReplicas?: number
  }
}

/**
 * The slice of a running Deployment needed to report resources: how many
 * replicas it runs and what each pod has been granted.
 */
export interface WorkloadSnapshot {
  desiredReplicas: number
  readyReplicas: number
  /** CPU request of a single pod (summed over its containers), millicores. */
  cpuRequestMillicores: number
  /** Memory request of a single pod (summed over its containers), MiB. */
  memoryRequestMb: number
}

export class DeploymentApi {
  constructor(private readonly http: KubeHttpClient) {}

  /**
   * Reads the Deployment's replica state and per-pod resource requests.
   * Returns null when the namespace holds no Deployment (e.g. a static
   * deployment, which never reaches Kubernetes).
   */
  async describe(
    namespace: string,
    name: string
  ): Promise<WorkloadSnapshot | null> {
    let deployment: RunningDeployment

    try {
      deployment = await this.http.get<RunningDeployment>(
        `/apis/apps/v1/namespaces/${namespace}/deployments/${name}`
      )
    } catch (error) {
      if (hasHttpStatus(error, 404)) {
        return null
      }
      throw error
    }

    const containers = deployment.spec?.template?.spec?.containers ?? []

    let cpuRequestMillicores = 0
    let memoryRequestMb = 0

    for (const container of containers) {
      cpuRequestMillicores +=
        parseCpuMillicores(container.resources?.requests?.cpu) ?? 0
      memoryRequestMb +=
        parseMemoryMb(container.resources?.requests?.memory) ?? 0
    }

    return {
      desiredReplicas: deployment.spec?.replicas ?? 0,
      readyReplicas:
        deployment.status?.readyReplicas ??
        deployment.status?.availableReplicas ??
        0,
      cpuRequestMillicores: Math.round(cpuRequestMillicores),
      memoryRequestMb: Math.round(memoryRequestMb),
    }
  }

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
   * Patches the container's resource requests/limits in place, which rewrites
   * the pod template and therefore rolls the workload.
   *
   * The container name is read from the live Deployment rather than assumed:
   * a strategic merge patch matches containers by name, and a name that does
   * not exist would be appended as an extra container instead of updating the
   * app's. Returns `"skipped"` when the namespace holds no Deployment.
   */
  async updateResources(
    namespace: string,
    name: string,
    resources: ContainerResources
  ): Promise<"updated" | "skipped"> {
    const path = `/apis/apps/v1/namespaces/${namespace}/deployments/${name}`

    let deployment: RunningDeployment

    try {
      deployment = await this.http.get<RunningDeployment>(path)
    } catch (error) {
      if (hasHttpStatus(error, 404)) {
        return "skipped"
      }
      throw error
    }

    const container = deployment.spec?.template?.spec?.containers?.[0]

    if (!container?.name) {
      return "skipped"
    }

    await this.http.strategicPatch(path, {
      spec: {
        template: {
          spec: {
            containers: [
              {
                name: container.name,
                resources: buildContainerResources(resources),
              },
            ],
          },
        },
      },
    })

    return "updated"
  }

  /**
   * Sets `spec.replicas` directly (0 pauses, 1 resumes). Does not touch the
   * pod template, so no image rollout is triggered. Idempotent.
   */
  async scale(
    namespace: string,
    name: string,
    replicas: number
  ): Promise<void> {
    await this.http.patch(
      `/apis/apps/v1/namespaces/${namespace}/deployments/${name}`,
      { spec: { replicas } }
    )
  }

  /**
   * Reconciles a running Deployment with a changed variable set: re-points
   * the container's `env` at the Secret (adding new keys, dropping removed
   * ones) and bumps the pod-template hash annotation so the workload rolls
   * and pods pick the new values up.
   *
   * Returns `"skipped"` when the namespace has no Deployment to update — the
   * Secret is still written, and the next deploy injects the variables.
   */
  async syncEnvironment(params: {
    namespace: string
    name: string
    secretName: string
    variables: Record<string, string>
    hash: string
  }): Promise<"updated" | "skipped"> {
    const { namespace, name, secretName, variables, hash } = params
    const path = `/apis/apps/v1/namespaces/${namespace}/deployments/${name}`

    let deployment: RunningDeployment

    try {
      deployment = await this.http.get<RunningDeployment>(path)
    } catch (error) {
      // Nothing running in this namespace yet.
      if (hasHttpStatus(error, 404)) {
        return "skipped"
      }
      throw error
    }

    const containers = deployment.spec?.template?.spec?.containers ?? []
    // Prefer the container already wired to our Secret, otherwise the first.
    const container =
      containers.find((candidate) =>
        (candidate.env ?? []).some(
          (entry) => entry.valueFrom?.secretKeyRef?.name === secretName
        )
      ) ?? containers[0]

    if (!container?.name) {
      return "skipped"
    }

    const managedKeys = new Set(
      (container.env ?? [])
        .filter((entry) => entry.valueFrom?.secretKeyRef?.name === secretName)
        .map((entry) => entry.name)
        .filter((key): key is string => typeof key === "string")
    )

    const upserts = Object.keys(variables).map((key) => ({
      name: key,
      valueFrom: { secretKeyRef: { name: secretName, key } },
    }))

    /*
     * A removed variable must be dropped explicitly: without `$patch: delete`
     * the pod spec would keep referencing a key the Secret no longer holds
     * and the container would fail to start.
     */
    const deletions = [...managedKeys]
      .filter((key) => !(key in variables))
      .map((key) => ({ name: key, $patch: "delete" as const }))

    await this.http.strategicPatch(path, {
      spec: {
        template: {
          metadata: {
            annotations: { [ENV_SECRET_HASH_ANNOTATION]: hash },
          },
          spec: {
            containers: [
              { name: container.name, env: [...upserts, ...deletions] },
            ],
          },
        },
      },
    })

    return "updated"
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
