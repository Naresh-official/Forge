import { RedisClient } from "bun"
import { Queue, createBunRedisClient } from "bullmq"
import { builderConfig } from "@forge/config"

export const rawClient = new RedisClient(builderConfig.redisUrl)

export const connection = createBunRedisClient(rawClient)

export type BuilderQueueJob = {
    buildId: string
}

export const builderQueue = new Queue<BuilderQueueJob>(
    builderConfig.defaultQueueOptions.name,
    {
        connection,
        defaultJobOptions: builderConfig.defaultQueueOptions.defaultJobOptions,
    }
)
