export interface ContainerEnvVar {
  name: string
  value: string
}

/**
 * A deployment's project environment variables, materialised as a Kubernetes
 * Secret in the deployment namespace. Values arrive decrypted from the API
 * over gRPC — the deployer never holds the encryption key.
 */
export interface EnvSecretParams {
  /** Secret name — see `envSecretNameForDeployment`. */
  name: string
  /** Plaintext variables, keyed by variable name. */
  variables: Record<string, string>
}

/** CPU/memory/storage the container is granted (requests equal limits). */
export interface ContainerResources {
  cpuMillicores: number
  memoryMb: number
  ephemeralStorageMb: number
}

/**
 * Credentials for a docker-registry imagePullSecret (e.g. Amazon ECR).
 */
export interface RegistryPullSecretParams {
  /** Registry host, e.g. "123456789012.dkr.ecr.us-east-1.amazonaws.com". */
  registryHost: string
  /** Usually "AWS" for ECR tokens. */
  username: string
  /** Short-lived token password. */
  password: string
}

/**
 * Reconcile params for pushing a changed variable set to a running workload.
 * Unlike {@link DeployContainerParams} this touches only the env Secret and
 * the pod template — never the image or resource plan.
 */
export interface SyncEnvironmentParams extends WorkloadRef {
  /** Name of the namespace Secret holding the variables. */
  secretName: string
  /** Plaintext variables, decrypted by the API and sent over gRPC. */
  variables: Record<string, string>
}

/**
 * Autoscaler state for a workload. Only present when the deployment runs
 * with an HPA. `currentCpuUtilization` is a percentage of pod requests and
 * is null until the autoscaler has a CPU reading.
 */
export interface AutoscalingSnapshot {
  minReplicas: number
  maxReplicas: number
  targetCpuUtilization: number
  currentCpuUtilization: number | null
  currentReplicas: number
  desiredReplicas: number
  /** Short state label, e.g. "Steady", "Scaling up", "At maximum replicas". */
  status: string
  /** The autoscaler's own explanation for the current state. */
  message: string
}

/**
 * A deployment's live resource picture: what it was granted, what it uses
 * right now, how many replicas run and (when enabled) its autoscaler state.
 */
export interface WorkloadMetrics {
  /** False when the deployment has no Kubernetes workload at all. */
  available: boolean
  /** Why the workload is unavailable — empty when `available` is true. */
  message: string
  replicasDesired: number
  replicasReady: number
  /** CPU consumption across the workload's pods, in millicores. */
  cpuUsageMillicores: number
  /** CPU granted across the workload's replicas, in millicores. */
  cpuRequestMillicores: number
  /** Memory consumption across the workload's pods, in MiB. */
  memoryUsageMb: number
  /** Memory granted across the workload's replicas, in MiB. */
  memoryRequestMb: number
  /** False when the cluster's metrics API has no readings. */
  metricsAvailable: boolean
  /** Newest pod metric sample (RFC 3339), null when there is none. */
  metricsTimestamp: string | null
  autoscaling: AutoscalingSnapshot | null
}

/** Identifies a workload (Deployment + Service [+ HPA]) by namespace/name. */
export interface WorkloadRef {
  /** Namespace for the deployment — e.g. forge-project-<projectId>-<deploymentId> */
  namespace: string
  /** Unique name for the Deployment + Service */
  name: string
}

/** Parameters for scaling an existing workload (pause/resume). */
export interface ScaleWorkloadParams extends WorkloadRef {
  /** Desired replica count: 0 pauses, 1 resumes. */
  replicas: number
  /** When true, the HPA is removed on pause and recreated on resume. */
  autoscalingEnabled?: boolean
}

export interface DeployContainerParams extends WorkloadRef {
  /** Full container image reference including registry, repo and tag */
  image: string
  /** Container port the app listens on */
  containerPort: number
  /**
   * Forge identity attached to pod template labels (`forge.dev/project-id`,
   * `forge.dev/deployment-id`). Runtime log collection (Fluent Bit) uses
   * these labels to route logs — they are the authoritative association
   * between a pod and its Forge deployment, since namespace names truncate
   * the deploymentId at 63 chars.
   */
  projectId?: string
  deploymentId?: string
  /** Optional literal environment variables to inject into the container */
  env?: ContainerEnvVar[]
  /**
   * Optional project variables. When set, they are stored in a Secret in the
   * deployment namespace and injected into the container with
   * `secretKeyRef`, so pod manifests never carry plaintext values.
   */
  envSecret?: EnvSecretParams
  /**
   * Optional imagePullSecret reference. When set, the Deployment pulls
   * the image through this Secret (required for private ECR repos).
   */
  imagePullSecret?: string
  /** Credentials used to create the imagePullSecret (ECR token). */
  pullSecretCredentials?: RegistryPullSecretParams
  /** Resource plan for the container. Falls back to Basic when omitted. */
  resources?: ContainerResources
  /**
   * When true the deployer creates a HorizontalPodAutoscaler (CPU-based,
   * 1..HPA_MAX_REPLICAS) instead of running a fixed replica count.
   */
  autoscalingEnabled?: boolean
}
