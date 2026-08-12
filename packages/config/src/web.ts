import { z } from "zod"
import { loadEnv, loadYamlConfig } from "./shared"

// 1. Load the global env and static YAML configs
loadEnv()
const yamlConfig = loadYamlConfig()

// 2. Define the Zod validation schema for the Web service
export const webSchema = z.object({
    port: z.number().int().positive().default(3000),
    env: z.string().default("production"),
    apiUrl: z.url().default("http://localhost:8000"),
    apiBaseRoute: z.string().default("/api/v1"),
    authSecret: z.string(),
    authGithubId: z.string(),
    authGithubSecret: z.string(),
})

// 3. Merge static yaml configs and env variables
const merged = {
    ...yamlConfig.web,
    apiUrl: process.env.NEXT_PUBLIC_API_URL || undefined,
    env: process.env.NODE_ENV || "production",
    authSecret: process.env.AUTH_SECRET || undefined,
    authGithubId: process.env.AUTH_GITHUB_ID || undefined,
    authGithubSecret: process.env.AUTH_GITHUB_SECRET || undefined,
}

// 4. Validate and export
export const webConfig = webSchema.parse(merged)
export type WebConfig = z.infer<typeof webSchema>
export default webConfig
