import { z } from "zod"
import { loadEnv, loadYamlConfig } from "./shared"

// 1. Load the global env and static YAML configs
loadEnv()
const yamlConfig = loadYamlConfig()

// 2. Define the Zod validation schema for the API service
export const apiSchema = z.object({
    port: z.number().int().positive().default(3001),
    nodeEnv: z.string().default("production"),
    databaseUrl: z.string(),
    directUrl: z.string(),
    github: z.object({
        appSlug: z.string(),
        appId: z.string(),
        privateKeyPath: z.string(),
    }),
})

// 3. Merge static yaml configs and env variables
const merged = {
    ...yamlConfig.api,
    databaseUrl: process.env.DATABASE_URL || undefined,
    directUrl: process.env.DIRECT_URL || undefined,
    nodeEnv: process.env.NODE_ENV || "production",
    github: {
        appSlug: process.env.GITHUB_APP_SLUG || undefined,
        appId: process.env.GITHUB_APP_ID || undefined,
        privateKeyPath: process.env.GITHUB_APP_PRIVATE_KEY_PATH || undefined,
    },
}

// 4. Validate and export
export const apiConfig = apiSchema.parse(merged)
export type ApiConfig = z.infer<typeof apiSchema>
export default apiConfig
