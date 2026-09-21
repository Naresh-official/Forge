import { z } from "zod"
import { loadEnv, loadYamlConfig } from "./shared"

// 1. Load the global env and static YAML configs
loadEnv()
const yamlConfig = loadYamlConfig()

// 2. Define the Zod validation schema for the Deployer service
export const deployerSchema = z.object({
  grpcPort: z.number().int().positive().default(8003),
  redisUrl: z.url().default("redis://localhost:6379"),
  nodeEnv: z.string().default("production"),
  defaultQueueOptions: z.object({
    name: z.string(),
    defaultJobOptions: z.object({
      attempts: z.number().positive().default(2),
      backoff: z.number().positive().default(3000),
    }),
  }),
  workerCount: z.int().positive(),
  apiGRPCUrl: z.string().default("localhost:8001"),
})

// 3. Merge static yaml configs and env variables
const merged = {
  ...yamlConfig.deployer,
  redisUrl: process.env.REDIS_URL || undefined,
  nodeEnv: process.env.NODE_ENV || "production",
  apiGRPCUrl: process.env.API_GRPC_URL || "localhost:8001",
}

// 4. Validate and export
export const deployerConfig = deployerSchema.parse(merged)
export type DeployerConfig = z.infer<typeof deployerSchema>
export default deployerConfig
