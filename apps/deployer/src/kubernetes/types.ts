export interface ContainerEnvVar {
  name: string
  value: string
}

export interface DeployContainerParams {
  /** Namespace for the deployment — e.g. forge-project-<buildId> */
  namespace: string
  /** Unique name for the Deployment + Service */
  name: string
  /** Full container image reference including registry, repo and tag */
  image: string
  /** Container port the app listens on */
  containerPort: number
  /** Optional environment variables to inject into the container */
  env?: ContainerEnvVar[]
}
