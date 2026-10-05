/**
 * Canonical, lowercase framework identifiers.
 *
 * The API persists these as the uppercase Prisma `Framework` enum
 * (`framework.toUpperCase()`), and the builder receives them from the API
 * so detection only ever happens once, at repository import time.
 */
export type PackageRunner = "npm" | "pnpm" | "yarn" | "bun" | "unknown"

export type Framework =
  | "nextjs"
  | "vite"
  | "react"
  | "vue"
  | "nuxt"
  | "svelte"
  | "sveltekit"
  | "astro"
  | "angular"
  | "remix"
  | "nestjs"
  | "express"
  | "unknown"

export const FRAMEWORKS: readonly Framework[] = [
  "nextjs",
  "vite",
  "react",
  "vue",
  "nuxt",
  "svelte",
  "sveltekit",
  "astro",
  "angular",
  "remix",
  "nestjs",
  "express",
  "unknown",
]

/**
 * Frameworks whose build output is a static site that can be uploaded to
 * object storage. Everything else runs a server and must be containerized
 * and deployed to Kubernetes.
 */
const STATIC_FRAMEWORKS: readonly Framework[] = [
  "vite",
  "react",
  "vue",
  "svelte",
  "sveltekit",
  "astro",
  "angular",
]

export function isStaticFramework(framework: Framework): boolean {
  return STATIC_FRAMEWORKS.includes(framework)
}

/** Accepts an unknown/upper/lower-case value and returns a valid Framework. */
export function normalizeFramework(
  value: string | null | undefined
): Framework {
  if (!value) {
    return "unknown"
  }

  const lowered = value.toLowerCase()

  return (FRAMEWORKS as readonly string[]).includes(lowered)
    ? (lowered as Framework)
    : "unknown"
}

/** The subset of package.json needed for framework detection. */
export interface PackageJsonLike {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

/**
 * Detects the framework a project uses from its package.json dependency
 * graph. Pure — callers are responsible for reading package.json (from disk
 * in the builder, from the GitHub Contents API in the control plane).
 */
export function detectFramework(packageJson: PackageJsonLike): Framework {
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  }

  // Full-stack frameworks first.
  if (dependencies["next"]) {
    return "nextjs"
  }

  if (dependencies["@remix-run/react"]) {
    return "remix"
  }

  if (dependencies["nuxt"]) {
    return "nuxt"
  }

  if (dependencies["@sveltejs/kit"]) {
    return "sveltekit"
  }

  if (dependencies["astro"]) {
    return "astro"
  }

  if (dependencies["@angular/core"]) {
    return "angular"
  }

  if (dependencies["@nestjs/core"]) {
    return "nestjs"
  }

  // Backend frameworks.
  if (dependencies["express"]) {
    return "express"
  }

  // Frontend frameworks.
  if (dependencies["svelte"]) {
    return "svelte"
  }

  if (dependencies["react"]) {
    // Vite + React is still a React project.
    return "react"
  }

  if (dependencies["vue"]) {
    // Nuxt was checked above, so this is a plain Vue project.
    return "vue"
  }

  // Vite without React/Vue/Svelte/etc.
  if (dependencies["vite"]) {
    return "vite"
  }

  return "unknown"
}
