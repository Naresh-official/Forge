import z from "zod"

export const projectFrameworkEnum = z.enum([
  "NEXTJS",
  "VITE",
  "REACT",
  "VUE",
  "NUXT",
  "SVELTE",
  "SVELTEKIT",
  "ASTRO",
  "ANGULAR",
  "REMIX",
  "NESTJS",
  "EXPRESS",
  "UNKNOWN",
])

export type ProjectFramework = z.infer<typeof projectFrameworkEnum>

export type ProjectDeployment = {
  branch: string
  status: "QUEUED" | "BUILDING" | "DEPLOYING" | "READY" | "FAILED" | "CANCELLED"
}

export type ProjectGithubRepository = {
  fullName: string
  defaultBranch: string
}

export type ProjectListItem = {
  id: string
  name: string
  slug: string
  /** Detected from the linked repository; null when no repository is linked. */
  framework: ProjectFramework | null
  createdAt: Date
  updatedAt: Date
  deployments: ProjectDeployment
  githubRepository: ProjectGithubRepository | null
}

export type ListProjectsResponse = ProjectListItem[]

/** Lightweight project reference used where only a link target is needed. */
export type ProjectNameItem = {
  id: string
  name: string
}

export type ListProjectNamesResponse = ProjectNameItem[]
