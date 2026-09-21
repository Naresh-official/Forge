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
    endpoint: z.string().default("http://localhost:9000"),
    accessKey: z.string().default("minioadmin"),
    secretKey: z.string().default("minioadmin"),
    bucket: z.string().default("forge-artifacts"),
    region: z.string().default("us-east-1"),
    useSSL: z.boolean().default(false),
  }),
  dockerRegistry: z.object({
    url: z.string().default("localhost:5000"),
    username: z.string().optional(),
    password: z.string().optional(),
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
    endpoint: process.env.MINIO_ENDPOINT || undefined,
    accessKey: process.env.MINIO_ACCESS_KEY || undefined,
    secretKey: process.env.MINIO_SECRET_KEY || undefined,
    bucket: process.env.MINIO_BUCKET || undefined,
    region: process.env.MINIO_REGION || undefined,
    useSSL:
      process.env.MINIO_USE_SSL !== undefined
        ? process.env.MINIO_USE_SSL === "true"
        : undefined,
  },
  dockerRegistry: {
    ...(yamlConfig.builder?.dockerRegistry ?? {}),
    url: process.env.DOCKER_REGISTRY_URL || undefined,
    username: process.env.DOCKER_REGISTRY_USERNAME || undefined,
    password: process.env.DOCKER_REGISTRY_PASSWORD || undefined,
  },
}

// 4. Validate and export
export const builderConfig = builderSchema.parse(merged)
export type BuilderConfig = z.infer<typeof builderSchema>
export default builderConfig
