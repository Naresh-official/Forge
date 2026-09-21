import { KubeHttpClient } from "./http/kube-http.client"
import { NamespaceApi } from "./resources/namespace.api"
import { DeploymentApi } from "./resources/deployment.api"
import { ServiceApi } from "./resources/service.api"
import type { DeployContainerParams } from "./types"

/**
 * High-level facade for Kubernetes operations.
 *
 * Deploy a container image to Kubernetes:
 *  1. Ensure the namespace exists
 *  2. Create the Deployment
 *  3. Create the Service
 */
export class KubernetesClient {
  private readonly http: KubeHttpClient
  private readonly namespaces: NamespaceApi
  private readonly deployments: DeploymentApi
  private readonly services: ServiceApi

  constructor(http?: KubeHttpClient) {
    this.http = http ?? new KubeHttpClient()
    this.namespaces = new NamespaceApi(this.http)
    this.deployments = new DeploymentApi(this.http)
    this.services = new ServiceApi(this.http)
  }

  async listNamespaces(): Promise<string[]> {
    return this.namespaces.list()
  }

  async ensureNamespace(name: string): Promise<string> {
    return this.namespaces.ensure(name)
  }

  async createDeployment(params: DeployContainerParams): Promise<void> {
    await this.deployments.create(params)
  }

  async createService(params: DeployContainerParams): Promise<void> {
    await this.services.create(params)
  }

  async deployContainer(params: DeployContainerParams): Promise<void> {
    await this.ensureNamespace(params.namespace)
    await this.createDeployment(params)
    await this.createService(params)
  }
}
