import { z } from "zod"
import { loadEnv, loadYamlConfig } from "./shared"

// 1. Load the global env and static YAML configs
loadEnv()
const yamlConfig = loadYamlConfig()

// 2. Define the Zod validation schema for the Builder service
export const builderSchema = z.object({
    port: z.number().positive(),
    tempDir: z.string().default("/tmp/forge-builder"),
    redisUrl: z.url().default("redis://localhost:6379"),
})

// 3. Merge static yaml configs and env variables
const merged = {
    ...yamlConfig.builder,
    redisUrl: process.env.REDIS_URL || undefined,
}

// 4. Validate and export
export const builderConfig = builderSchema.parse(merged)
export type BuilderConfig = z.infer<typeof builderSchema>
export default builderConfig
