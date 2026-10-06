import { z } from "zod"
import { loadEnv, loadYamlConfig } from "./shared"

// 1. Load the global env and static YAML configs
loadEnv()
const yamlConfig = loadYamlConfig()

// 2. Define the Zod validation schema for the API service
export const apiSchema = z.object({
  port: z.number().int().positive().default(8000),
  grpcPort: z.number().int().positive().default(8001),
  nodeEnv: z.string().default("production"),
  /** Required by the API only; defaults to empty so secondary consumers
   *  (log-router) that only need redis/logs config can parse the schema. */
  databaseUrl: z.string().default(""),
  directUrl: z.string().default(""),
  authSecret: z.string().default(""),
  github: z
    .object({
      appSlug: z.string().default(""),
      appId: z.string().default(""),
      privateKeyPath: z.string().default(""),
    })
    .default({}),
  allowedOrigins: z.array(z.url()).default(["http://localhost:3000"]),
  builderGRPCUrl: z.string().default("localhost:8002"),
  deployerGRPCUrl: z.string().default("localhost:8003"),
  /** Redis connection for live log streaming (SSE bridge). */
  redisUrl: z.string().default("redis://localhost:6379"),
  logRouter: z.object({
    /** Port the Fluent Bit Forward receiver listens on. */
    port: z.number().int().positive().default(8010),
  }),
  logs: z.object({
    /** S3 bucket persisted logs are read from (forge-logs). */
    bucket: z.string().min(1),
    region: z.string().min(1),
    /** Page size for the historical log listing. */
    listPageSize: z.number().int().positive().default(100),
  }),
  /** Redis replay buffer settings shared by builder and log-router. */
  liveHistoryLimit: z.number().int().positive().default(2000),
  liveHistoryTtlMs: z.number().int().positive().default(3_600_000),
  /** Object storage holding static build artifacts (deleted with a project). */
  storage: z.object({
    region: z.string().default("us-east-1"),
    accessKeyId: z.string().default(""),
    secretAccessKey: z.string().default(""),
    bucket: z.string().default(""),
  }),
  /** Container registry holding built images (deleted with a project). */
  dockerRegistry: z.object({
    registryId: z.string().default(""),
    region: z.string().default("us-east-1"),
    accessKeyId: z.string().default(""),
    secretAccessKey: z.string().default(""),
    repository: z.string().default(""),
  }),
})

// 3. Merge static yaml configs and env variables
const merged = {
  ...yamlConfig.api,
  databaseUrl: process.env.DATABASE_URL || undefined,
  directUrl: process.env.DIRECT_URL || undefined,
  nodeEnv: process.env.NODE_ENV || "production",
  authSecret: process.env.AUTH_SECRET || undefined,
  github: {
    appSlug: process.env.GITHUB_APP_SLUG || undefined,
    appId: process.env.GITHUB_APP_ID || undefined,
    privateKeyPath: process.env.GITHUB_APP_PRIVATE_KEY_PATH || undefined,
  },
  allowedOrigins: process.env.ALLOWED_ORIGIN_1
    ? [process.env.ALLOWED_ORIGIN_1]
    : undefined,
  builderGRPCUrl: process.env.BUILDER_GRPC_URL || "localhost:8002",
  deployerGRPCUrl: process.env.DEPLOYER_GRPC_URL || "localhost:8003",
  redisUrl: process.env.REDIS_URL || undefined,
  logRouter: {
    ...(yamlConfig.api?.logRouter ?? {}),
    port: process.env.LOG_ROUTER_PORT
      ? parseInt(process.env.LOG_ROUTER_PORT, 10)
      : (yamlConfig.api?.logRouter?.port ?? 8010),
  },
  logs: {
    ...(yamlConfig.api?.logs ?? {}),
    bucket: process.env.LOGS_BUCKET || undefined,
    region: process.env.AWS_REGION || undefined,
  },
  liveHistoryLimit: yamlConfig.api?.liveHistoryLimit ?? 2000,
  liveHistoryTtlMs: yamlConfig.api?.liveHistoryTtlMs ?? 3_600_000,
  storage: {
    ...(yamlConfig.api?.storage ?? {}),
    region: process.env.AWS_REGION || undefined,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || undefined,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || undefined,
    bucket: process.env.S3_BUCKET || undefined,
  },
  dockerRegistry: {
    ...(yamlConfig.api?.dockerRegistry ?? {}),
    registryId: process.env.ECR_REGISTRY_ID || undefined,
    region: process.env.AWS_REGION || undefined,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || undefined,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || undefined,
    repository: process.env.ECR_REPOSITORY || undefined,
  },
}

// 4. Validate and export
export const apiConfig = apiSchema.parse(merged)
export type ApiConfig = z.infer<typeof apiSchema>
export default apiConfig
