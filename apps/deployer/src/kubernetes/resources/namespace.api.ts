import { KubeHttpClient, hasHttpStatus } from "../http/kube-http.client"
import { buildNamespaceManifest } from "../manifests/namespace.manifest"

export class NamespaceApi {
  constructor(private readonly http: KubeHttpClient) {}

  async list(): Promise<string[]> {
    const body = await this.http.get<{
      items: Array<{ metadata: { name: string } }>
    }>("/api/v1/namespaces")
    return body.items.map((ns) => ns.metadata.name)
  }

  /**
   * Deletes the namespace and everything in it (Deployment, Service, HPA,
   * pull secret). Missing namespaces are ignored so deletion is idempotent.
   */
  async remove(name: string): Promise<void> {
    try {
      await this.http.delete(`/api/v1/namespaces/${name}`)
    } catch (error) {
      if (hasHttpStatus(error, 404)) {
        return
      }
      throw error
    }
  }

  /**
   * Create the namespace if it does not already exist.
   * Returns the namespace name. Idempotent.
   */
  async ensure(name: string): Promise<string> {
    try {
      await this.http.post("/api/v1/namespaces", buildNamespaceManifest(name))
      return name
    } catch (error) {
      // 409 AlreadyExists — nothing to do
      if (hasHttpStatus(error, 409)) {
        return name
      }
      throw error
    }
  }
}
