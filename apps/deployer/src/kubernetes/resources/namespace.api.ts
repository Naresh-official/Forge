import { KubeHttpClient } from "../http/kube-http.client"
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
   * Create the namespace if it does not already exist.
   * Returns the namespace name.
   */
  async ensure(name: string): Promise<string> {
    const existing = await this.list()
    if (existing.includes(name)) {
      return name
    }

    await this.http.post("/api/v1/namespaces", buildNamespaceManifest(name))

    return name
  }
}
