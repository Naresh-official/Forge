import { KubeHttpClient } from "./http/kube-http.client"
import { NamespaceApi } from "./resources/namespace.api"
import { DeploymentApi } from "./resources/deployment.api"
import { ServiceApi } from "./resources/service.api"
import { SecretApi } from "./resources/secret.api"
import type { DeployContainerParams, RegistryPullSecretParams } from "./types"

/** How long to wait for the Deployment rollout to become available. */
const ROLLOUT_TIMEOUT_MS = 120_000
/** Interval between pod status checks while waiting for readiness. */
const ROLLOUT_POLL_INTERVAL_MS = 5_000

/**
 * High-level facade for Kubernetes operations.
 *
 * Deploy a container image to Kubernetes:
 *  1. Ensure the namespace exists (idempotent)
 *  2. Ensure the image pull secret exists (idempotent)
 *  3. Ensure the Deployment exists (create or patch — idempotent)
 *  4. Ensure the Service exists (create or skip — idempotent)
 *  5. Wait for the rollout to become available
 */
export class KubernetesClient {
  private readonly http: KubeHttpClient
  private readonly namespaces: NamespaceApi
  private readonly deployments: DeploymentApi
  private readonly services: ServiceApi
  private readonly secrets: SecretApi

  constructor(http?: KubeHttpClient) {
    this.http = http ?? new KubeHttpClient()
    this.namespaces = new NamespaceApi(this.http)
    this.deployments = new DeploymentApi(this.http)
    this.services = new ServiceApi(this.http)
    this.secrets = new SecretApi(this.http)
  }

  async listNamespaces(): Promise<string[]> {
    return this.namespaces.list()
  }

  async ensureNamespace(name: string): Promise<string> {
    return this.namespaces.ensure(name)
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

    await this.deployments.ensure(params)
    await this.services.ensure(params)

    const rolloutReady = await this.waitForRollout(
      params.namespace,
      params.name,
      ROLLOUT_TIMEOUT_MS
    )

    return { rolloutReady }
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
        console.warn(
          `[k8s] Transient error while polling rollout of ${namespace}/${name}:`,
          error instanceof Error ? error.message : error
        )
      }

      await new Promise((resolve) =>
        setTimeout(resolve, ROLLOUT_POLL_INTERVAL_MS)
      )
    }

    return false
  }
}
