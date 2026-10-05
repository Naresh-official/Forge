const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
const API_BASE_ROUTE = process.env.NEXT_PUBLIC_API_BASE_ROUTE || "/api/v1"

const API_URL = `${API_BASE_URL.replace(/\/$/, "")}${API_BASE_ROUTE.replace(/\/$/, "")}`

// using @forge/config creates a dependency on node fs, and cannot be called from client side

/**
 * Absolute URL for an API route. Use this for links the browser navigates
 * to directly, such as OAuth/installation redirects.
 */
export function apiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${API_URL}${normalizedPath}`
}

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    credentials: "include",
  })

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`)
  }

  return response.json() as Promise<T>
}
