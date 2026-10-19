import https from "node:https"
import axios from "axios"
import { KubeConfig } from "@kubernetes/client-node"

/**
 * Low-level, authenticated HTTP client for the Kubernetes API server.
 *
 * Loads the default kubeconfig (in-cluster service account or local
 * kubeconfig file) and exposes minimal GET/POST/PATCH helpers that
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

  /**
   * Full replace of an existing resource. Unlike a merge-patch this drops
   * fields absent from the body, which is what an environment Secret needs:
   * a removed variable must not survive a redeploy.
   */
  async put<T>(path: string, body: unknown): Promise<T> {
    const response = await axios.put<T>(`${this.baseUrl}${path}`, body, {
      httpsAgent: this.agent,
    })
    return response.data
  }

  /**
   * JSON merge-patch (RFC 7386). Lists are replaced wholesale, which makes
   * this suitable for reconciling `spec` of existing resources.
   */
  async patch<T>(path: string, body: unknown): Promise<T> {
    const response = await axios.patch<T>(`${this.baseUrl}${path}`, body, {
      httpsAgent: this.agent,
      headers: { "Content-Type": "application/merge-patch+json" },
    })
    return response.data
  }

  /**
   * Strategic-merge patch (`application/strategic-merge-patch+json`).
   *
   * Merges typed lists by their declared merge key — `env` entries merge on
   * `name` and may be removed with an explicit `$patch: delete`, which a JSON
   * merge patch cannot express without shipping the whole list.
   */
  async strategicPatch<T>(path: string, body: unknown): Promise<T> {
    const response = await axios.patch<T>(`${this.baseUrl}${path}`, body, {
      httpsAgent: this.agent,
      headers: {
        "Content-Type": "application/strategic-merge-patch+json",
      },
    })
    return response.data
  }

  async delete<T>(path: string): Promise<T> {
    const response = await axios.delete<T>(`${this.baseUrl}${path}`, {
      httpsAgent: this.agent,
    })
    return response.data
  }
}

/**
 * True when the error is an Axios error carrying the given HTTP status
 * (e.g. 409 Conflict when a resource already exists).
 */
export function hasHttpStatus(error: unknown, status: number): boolean {
  return axios.isAxiosError(error) && error.response?.status === status
}
