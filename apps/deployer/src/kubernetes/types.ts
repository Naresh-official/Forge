export interface ContainerEnvVar {
  name: string
  value: string
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
  /** Optional environment variables to inject into the container */
  env?: ContainerEnvVar[]
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
