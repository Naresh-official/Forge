import { RedisClient } from "bun"
import { Queue, createBunRedisClient } from "bullmq"
import { deployerConfig } from "@forge/config"

export const rawClient = new RedisClient(deployerConfig.redisUrl)

export const connection = createBunRedisClient(rawClient)

export type DeployerQueueJob = {
    deploymentId: string
    projectId: string
    buildId: string
    imageUrl?: string
    imageTag?: string
    artifactBucket?: string
    artifactKey?: string
    strategy?: string
    framework?: string
}

export const deployerQueue = new Queue<DeployerQueueJob>(
    deployerConfig.defaultQueueOptions.name,
    {
        connection,
        defaultJobOptions: deployerConfig.defaultQueueOptions.defaultJobOptions,
    }
)
