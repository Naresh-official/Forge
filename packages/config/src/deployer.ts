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
  dockerRegistry: z.object({
    registryId: z.string().min(1), // AWS account id
    region: z.string().min(1),
    accessKeyId: z.string().min(1),
    secretAccessKey: z.string().min(1),
    /** Single ECR repository all built images are pushed into. */
    repository: z.string().min(1),
  }),
})

// 3. Merge static yaml configs and env variables
const merged = {
  ...yamlConfig.deployer,
  redisUrl: process.env.REDIS_URL || undefined,
  nodeEnv: process.env.NODE_ENV || "production",
  apiGRPCUrl: process.env.API_GRPC_URL || "localhost:8001",
  dockerRegistry: {
    ...(yamlConfig.deployer?.dockerRegistry ?? {}),
    registryId: process.env.ECR_REGISTRY_ID || undefined,
    region: process.env.AWS_REGION || undefined,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || undefined,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || undefined,
    repository: process.env.ECR_REPOSITORY || undefined,
  },
}

// 4. Validate and export
export const deployerConfig = deployerSchema.parse(merged)
export type DeployerConfig = z.infer<typeof deployerSchema>
export default deployerConfig
