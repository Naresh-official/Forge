import https from "node:https"
import axios from "axios"
import { KubeConfig } from "@kubernetes/client-node"

/**
 * Low-level, authenticated HTTP client for the Kubernetes API server.
 *
 * Loads the default kubeconfig (in-cluster service account or local
 * kubeconfig file) and exposes minimal GET/POST helpers that
 * transparently handle TLS certificates.
 */
export class KubeHttpClient {
  private readonly baseUrl: string
  private readonly agent: https.Agent

  constructor() {
    const kc = new KubeConfig()
    kc.loadFromDefault()

    const cluster = kc.getCurrentCluster()!
    const user = kc.getCurrentUser()!

    this.baseUrl = cluster.server

    this.agent = new https.Agent({
      ca: cluster.caData ? Buffer.from(cluster.caData, "base64") : undefined,
      cert: user.certData ? Buffer.from(user.certData, "base64") : undefined,
      key: user.keyData ? Buffer.from(user.keyData, "base64") : undefined,
    })
  }

  async get<T>(path: string): Promise<T> {
    const response = await axios.get<T>(`${this.baseUrl}${path}`, {
      httpsAgent: this.agent,
    })
    return response.data
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const response = await axios.post<T>(`${this.baseUrl}${path}`, body, {
      httpsAgent: this.agent,
    })
    return response.data
  }
}
