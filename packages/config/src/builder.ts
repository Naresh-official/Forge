import { z } from "zod"
import { loadEnv, loadYamlConfig } from "./shared"

// 1. Load the global env and static YAML configs
loadEnv()
const yamlConfig = loadYamlConfig()

// 2. Define the Zod validation schema for the Builder service
export const builderSchema = z.object({
  grpcPort: z.number().positive(),
  tempDir: z.string().default("/tmp/forge-builder"),
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
  storage: z.object({
    region: z.string().default("us-east-1"),
    accessKeyId: z.string().min(1),
    secretAccessKey: z.string().min(1),
    bucket: z.string().min(1),
  }),
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
  ...yamlConfig.builder,
  redisUrl: process.env.REDIS_URL || undefined,
  nodeEnv: process.env.NODE_ENV || "production",
  apiGRPCUrl: process.env.API_GRPC_URL || "localhost:8001",
  storage: {
    ...(yamlConfig.builder?.storage ?? {}),
    region: process.env.AWS_REGION || undefined,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || undefined,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || undefined,
    bucket: process.env.S3_BUCKET || undefined,
  },
  dockerRegistry: {
    ...(yamlConfig.builder?.dockerRegistry ?? {}),
    registryId: process.env.ECR_REGISTRY_ID || undefined,
    region: process.env.AWS_REGION || undefined,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || undefined,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || undefined,
    repository: process.env.ECR_REPOSITORY || undefined,
  },
}

// 4. Validate and export
export const builderConfig = builderSchema.parse(merged)
export type BuilderConfig = z.infer<typeof builderSchema>
export default builderConfig
