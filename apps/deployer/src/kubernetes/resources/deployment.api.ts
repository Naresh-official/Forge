import { KubeHttpClient, hasHttpStatus } from "../http/kube-http.client"
import { buildDeploymentManifest } from "../manifests/deployment.manifest"
import { ENV_SECRET_HASH_ANNOTATION } from "../constants"
import type { DeployContainerParams } from "../types"

/** The subset of a container env entry this API needs to reason about. */
interface ContainerEnvEntry {
  name?: string
  valueFrom?: { secretKeyRef?: { name?: string; key?: string } }
}

interface RunningDeployment {
  spec?: {
    template?: {
      spec?: {
        containers?: Array<{ name?: string; env?: ContainerEnvEntry[] }>
      }
    }
  }
}

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
