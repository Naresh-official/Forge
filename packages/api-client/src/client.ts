import { webConfig } from "@workspace/config"

const API_URL = webConfig.apiUrl + webConfig.apiBaseRoute

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...options?.headers,
        },
    })

    if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`)
    }

    return response.json() as Promise<T>
}
