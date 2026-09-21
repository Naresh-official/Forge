export interface ContainerEnvVar {
  name: string
  value: string
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

export interface DeployContainerParams {
  /** Namespace for the deployment — e.g. forge-project-<projectId>-<deploymentId> */
  namespace: string
  /** Unique name for the Deployment + Service */
  name: string
  /** Full container image reference including registry, repo and tag */
  image: string
  /** Container port the app listens on */
  containerPort: number
  /** Optional environment variables to inject into the container */
  env?: ContainerEnvVar[]
  /**
   * Optional imagePullSecret reference. When set, the Deployment pulls
   * the image through this Secret (required for private ECR repos).
   */
  imagePullSecret?: string
  /** Credentials used to create the imagePullSecret (ECR token). */
  pullSecretCredentials?: RegistryPullSecretParams
}
