import { KubeHttpClient } from "./http/kube-http.client"
import { NamespaceApi } from "./resources/namespace.api"
import { DeploymentApi } from "./resources/deployment.api"
import { ServiceApi } from "./resources/service.api"
import { SecretApi } from "./resources/secret.api"
import { HpaApi, type HpaSnapshot } from "./resources/hpa.api"
import { MetricsApi } from "./resources/metrics.api"
import type {
  AutoscalingSnapshot,
  DeployContainerParams,
  RegistryPullSecretParams,
  ScaleWorkloadParams,
  SyncEnvironmentParams,
  UpdateWorkloadResourcesParams,
  WorkloadMetrics,
  WorkloadRef,
} from "./types"
import { hashEnvVariables } from "./manifests/env-secret.manifest"
import logger from "@/utils/logger"

/** How long to wait for the Deployment rollout to become available. */
const ROLLOUT_TIMEOUT_MS = 120_000
/** Interval between pod status checks while waiting for readiness. */
const ROLLOUT_POLL_INTERVAL_MS = 5_000

/**
 * Turns the HPA's observed state into a label a human can act on.
 *
 * `ScalingLimited` is checked first: an autoscaler sitting at its maximum is
 * technically "desired == current" but is not steady, and reporting it as
 * steady would hide why the service is not growing.
 */
function describeScaling(
  hpa: HpaSnapshot,
  replicasDesired: number
): AutoscalingSnapshot {
  const currentReplicas = hpa.currentReplicas || replicasDesired
  const desiredReplicas = hpa.desiredReplicas || currentReplicas

  const limited = hpa.conditions.find(
    (condition) =>
      condition.type === "ScalingLimited" && condition.status === "True"
  )
  const active = hpa.conditions.find(
    (condition) => condition.type === "ScalingActive"
  )

  const base = {
    minReplicas: hpa.minReplicas,
    maxReplicas: hpa.maxReplicas,
    targetCpuUtilization: hpa.targetCpuUtilization,
    currentCpuUtilization: hpa.currentCpuUtilization,
    currentReplicas,
    desiredReplicas,
  }

  if (limited?.reason === "TooManyReplicas") {
    return {
      ...base,
      status: "At maximum replicas",
      message:
        limited.message ??
        `The autoscaler is capped at ${hpa.maxReplicas} replicas.`,
    }
  }

  if (desiredReplicas > currentReplicas) {
    return {
      ...base,
      status: "Scaling up",
      message: `The autoscaler wants ${desiredReplicas} replicas, up from ${currentReplicas}.`,
    }
  }

  if (desiredReplicas < currentReplicas) {
    return {
      ...base,
      status: "Scaling down",
      message: `The autoscaler wants ${desiredReplicas} replicas, down from ${currentReplicas}.`,
    }
  }

  if (active && active.status === "False") {
    return {
      ...base,
      status: "Scaling paused",
      message:
        active.message ??
        "The autoscaler cannot read metrics right now, so it is not scaling.",
    }
  }

  return {
    ...base,
    status: "Steady",
    message: `The autoscaler is holding ${currentReplicas} replica(s).`,
  }
}

/**
 * High-level facade for Kubernetes operations.
 *
 * Deploy a container image to Kubernetes:
 *  1. Ensure the namespace exists (idempotent)
 *  2. Ensure the image pull secret exists (idempotent)
 *  3. Ensure the environment Secret exists (create or replace — idempotent)
 *  4. Ensure the Deployment exists (create or patch — idempotent)
 *  5. Ensure the Service exists (create or skip — idempotent)
 *  6. Wait for the rollout to become available
 */
export class KubernetesClient {
  private readonly http: KubeHttpClient
  private readonly namespaces: NamespaceApi
  private readonly deployments: DeploymentApi
  private readonly services: ServiceApi
  private readonly secrets: SecretApi
  private readonly hpas: HpaApi
  private readonly metrics: MetricsApi

  constructor(http?: KubeHttpClient) {
    this.http = http ?? new KubeHttpClient()
    this.namespaces = new NamespaceApi(this.http)
    this.deployments = new DeploymentApi(this.http)
    this.services = new ServiceApi(this.http)
    this.secrets = new SecretApi(this.http)
    this.hpas = new HpaApi(this.http)
    this.metrics = new MetricsApi(this.http)
  }

  async listNamespaces(): Promise<string[]> {
    return this.namespaces.list()
  }

  async ensureNamespace(name: string): Promise<string> {
    return this.namespaces.ensure(name)
  }

  /**
   * Deletes a namespace and all resources inside it. Idempotent — a missing
   * namespace is treated as already deleted.
   */
  async deleteNamespace(name: string): Promise<void> {
    await this.namespaces.remove(name)
  }

  async ensureDockerRegistrySecret(
    namespace: string,
    name: string,
    params: RegistryPullSecretParams
  ): Promise<void> {
    await this.secrets.ensureDockerRegistrySecret(namespace, name, params)
  }

  async ensureDeployment(
    params: DeployContainerParams
  ): Promise<"created" | "updated"> {
    return this.deployments.ensure(params)
  }

  async createDeployment(params: DeployContainerParams): Promise<void> {
    await this.deployments.create(params)
  }

  async ensureService(
    params: DeployContainerParams
  ): Promise<"created" | "exists"> {
    return this.services.ensure(params)
  }

  async createService(params: DeployContainerParams): Promise<void> {
    await this.services.create(params)
  }

  async deployContainer(params: DeployContainerParams): Promise<{
    rolloutReady: boolean
  }> {
    await this.ensureNamespace(params.namespace)

    if (params.imagePullSecret) {
      await this.secrets.ensureDockerRegistrySecret(
        params.namespace,
        params.imagePullSecret,
        params.pullSecretCredentials!
      )
    }

    /*
     * The environment Secret is written before the Deployment so the pod's
     * secretKeyRef lookups always resolve.
     */
    if (params.envSecret) {
      await this.secrets.ensureEnvSecret(
        params.namespace,
        params.envSecret.name,
        params.envSecret.variables
      )
    }

    await this.deployments.ensure(params)
    await this.services.ensure(params)

    // Autoscaling projects get an HPA that owns the replica count. The
    // initial Deployment replicas (1) satisfy the HPA's minimum, so the
    // rollout below observes a ready pod before the HPA adjusts anything.
    if (params.autoscalingEnabled) {
      await this.hpas.ensure(params)
    }

    const rolloutReady = await this.waitForRollout(
      params.namespace,
      params.name,
      ROLLOUT_TIMEOUT_MS
    )

    return { rolloutReady }
  }

  /**
   * Reconciles an already-deployed workload with a changed variable set: the
   * namespace's env Secret is rewritten and the Deployment is rolled so pods
   * pick the new values up.
   *
   * Returns `"skipped"` when there is no running Deployment in the namespace
   * (nothing to update yet — the next deploy will inject the variables).
   */
  async syncEnvironmentSecret(
    params: SyncEnvironmentParams
  ): Promise<"updated" | "skipped"> {
    await this.secrets.ensureEnvSecret(
      params.namespace,
      params.secretName,
      params.variables
    )

    return this.deployments.syncEnvironment({
      namespace: params.namespace,
      name: params.name,
      secretName: params.secretName,
      variables: params.variables,
      hash: hashEnvVariables(params.variables),
    })
  }

  /**
   * Reads the current state of an already-deployed workload and exposes the
   * subset the cancel path needs: whether there is a workload at all, its
   * desired replica count, and whether it is autoscaled.
   */
  async describeWorkload(ref: WorkloadRef): Promise<{
    exists: boolean
    desiredReplicas: number
    readyReplicas: number
    autoscalingEnabled: boolean
  } | null> {
    const workload = await this.deployments.describe(ref.namespace, ref.name)

    if (!workload) {
      return null
    }

    const hpa = await this.hpas.find(ref.namespace, ref.name)

    return {
      exists: true,
      desiredReplicas: workload.desiredReplicas,
      readyReplicas: workload.readyReplicas,
      autoscalingEnabled: hpa !== null,
    }
  }

  /**
   * Scales an existing workload to `replicas` (pause = 0, resume = 1).
   *
   * When the workload autoscales, the HPA is removed before scaling to zero
   * — otherwise it would immediately scale the Deployment back up to its
   * minimum. On resume the HPA is recreated so it resumes managing replicas
   * from the minimum. Idempotent: pausing or resuming twice is safe.
   */
  async scaleWorkload(params: ScaleWorkloadParams): Promise<void> {
    const { namespace, name, replicas, autoscalingEnabled } = params

    if (replicas <= 0) {
      if (autoscalingEnabled) {
        await this.hpas.remove(namespace, name)
      }
      await this.deployments.scale(namespace, name, 0)
      return
    }

    await this.deployments.scale(namespace, name, replicas)

    if (autoscalingEnabled) {
      await this.hpas.ensure({ namespace, name })
    }
  }

  /**
   * Applies a new resource plan to an already-running workload without a
   * rebuild: the container's requests/limits are patched (which rolls the
   * pods) and the HPA is created or removed to match the new autoscaling
   * setting, then the rollout is awaited.
   *
   * Idempotent. A deployment with no workload in the cluster (static builds,
   * or one that never reached Kubernetes) is reported as `skipped` rather
   * than failing — there is simply nothing to resize.
   */
  async updateWorkloadResources(
    params: UpdateWorkloadResourcesParams
  ): Promise<{ updated: boolean; skipped: boolean; rolloutReady: boolean }> {
    const { namespace, name, resources, autoscalingEnabled } = params

    const result = await this.deployments.updateResources(
      namespace,
      name,
      resources
    )

    if (result === "skipped") {
      return { updated: false, skipped: true, rolloutReady: false }
    }

    if (autoscalingEnabled) {
      await this.hpas.ensure({ namespace, name })
    } else {
      await this.hpas.remove(namespace, name)
    }

    const rolloutReady = await this.waitForRollout(
      namespace,
      name,
      ROLLOUT_TIMEOUT_MS
    )

    return { updated: true, skipped: false, rolloutReady }
  }

  /**
   * Reads the live resource picture of a workload: its replica state, the
   * CPU/memory it was granted versus what it consumes right now (from the
   * cluster's metrics API) and, when autoscaled, the HPA's state.
   *
   * Usage is summed over the pods matching the workload's `app` label, so a
   * scaled-out workload reports the whole footprint, not just one pod.
   */
  async getWorkloadMetrics(ref: WorkloadRef): Promise<WorkloadMetrics> {
    const { namespace, name } = ref

    const workload = await this.deployments.describe(namespace, name)

    if (!workload) {
      return {
        available: false,
        message:
          "This deployment has no Kubernetes workload — it is served from object storage.",
        replicasDesired: 0,
        replicasReady: 0,
        cpuUsageMillicores: 0,
        cpuRequestMillicores: 0,
        memoryUsageMb: 0,
        memoryRequestMb: 0,
        metricsAvailable: false,
        metricsTimestamp: null,
        autoscaling: null,
      }
    }

    // Reads run in parallel: none of them depends on another's result.
    const [usage, hpa] = await Promise.all([
      this.metrics.podUsage(namespace, `app=${name}`),
      this.hpas.find(namespace, name),
    ])

    return {
      available: true,
      message: "",
      replicasDesired: workload.desiredReplicas,
      replicasReady: workload.readyReplicas,
      cpuUsageMillicores: usage.cpuMillicores,
      // Allocation is what the user asked for: the per-pod request times the
      // replicas the workload is meant to run.
      cpuRequestMillicores:
        workload.cpuRequestMillicores * workload.desiredReplicas,
      memoryUsageMb: usage.memoryMb,
      memoryRequestMb: workload.memoryRequestMb * workload.desiredReplicas,
      metricsAvailable: usage.available,
      metricsTimestamp: usage.timestamp,
      autoscaling: hpa ? describeScaling(hpa, workload.desiredReplicas) : null,
    }
  }

  /**
   * Polls the Deployment's status until it reports available replicas
   * (i.e. pods Ready and serving) or the timeout elapses.
   *
   * Returns true when the rollout is available, false on timeout. Errors
   * while polling are logged but not thrown — the rollout check is
   * best-effort; the deployment itself has already been applied.
   */
  private async waitForRollout(
    namespace: string,
    name: string,
    timeoutMs: number
  ): Promise<boolean> {
    const deadline = Date.now() + timeoutMs

    while (Date.now() < deadline) {
      try {
        const deployment = await this.http.get<{
          metadata?: { generation?: number }
          status?: {
            observedGeneration?: number
            updatedReplicas?: number
            availableReplicas?: number
            replicas?: number
          }
        }>(`/apis/apps/v1/namespaces/${namespace}/deployments/${name}`)

        const status = deployment.status ?? {}
        const generation = deployment.metadata?.generation ?? 0
        const observed = status.observedGeneration ?? 0

        // Only trust status for the latest spec generation
        if (observed >= generation && (status.availableReplicas ?? 0) > 0) {
          return true
        }
      } catch (error) {
        // Transient API errors shouldn't abort the wait loop
        logger.warn(
          `[k8s] Transient error while polling rollout of ${namespace}/${name}: ${
            error instanceof Error ? error.message : error
          }`
        )
      }

      await new Promise((resolve) =>
        setTimeout(resolve, ROLLOUT_POLL_INTERVAL_MS)
      )
    }

    return false
  }
}
