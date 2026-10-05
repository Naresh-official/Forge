import fs from "fs"
import path from "path"
import { Worker } from "bullmq"
import { builderConfig } from "@forge/config"
import { uploadDirectory } from "@forge/storage"
import { buildImageTag, pushImage, pushComposeImages } from "@forge/registry"
import { connection, type BuilderQueueJob } from "@/queue/queue"
import { buildStarted, buildCompleted } from "@/gRPC/wrapper/api.wrapper"
import { cloneGitRepository } from "./features/git"
import { detectProject } from "./features/detect"
import { buildNodeProject } from "./features/builders/node.builder"
import { isStaticFramework, normalizeFramework } from "@forge/frameworks"
import { containerizeNodeProject } from "./features/builders/node.container"
import { buildDockerfileProject } from "./features/builders/dockerfile.builder"
import { buildDockerComposeProject } from "./features/builders/docker-compose.builder"
import { createBuildLogger } from "./features/logs/build-logs"
import logger from "@/utils/logger"

const workerId = process.env.WORKER_ID ?? "unknown"

interface BuildReport {
  status: "SUCCEEDED" | "FAILED" | "CANCELLED"
  message?: string
  imageUrl?: string
  imageTag?: string
  artifactBucket?: string
  artifactKey?: string
  strategy?: string
  framework?: string
  packageRunner?: string
}

const worker = new Worker<BuilderQueueJob>(
  builderConfig.defaultQueueOptions.name,
  async (job) => {
    const { buildId } = job.data

    logger.info(`[Worker ${workerId}] Processing build ${buildId}`)

    const report: BuildReport = {
      status: "FAILED",
    }

    let repoPath: string | undefined

    try {
      const response = await buildStarted({
        buildId,
      })

      repoPath = await cloneGitRepository(response)

      /*
       * Images and artifacts are stored under
       * "<projectId>/<deploymentId>/<repo-name>" in the "forge-project"
       * S3 bucket / ECR repository. For ECR the structure is flattened
       * into the tag (Docker tags cannot contain "/"), and dev builds
       * get a "-dev" suffix.
       */
      const repoName = response.repoFullName.split("/").pop() ?? "repo"
      const objectPrefix = `${response.projectId}/${response.deploymentId}`
      const isDev = builderConfig.nodeEnv === "development"
      const imageTag = buildImageTag(
        response.projectId,
        response.deploymentId,
        repoName,
        isDev
      )

      /*
       * Each builder closes the logger it receives, so create a
       * fresh one for every step of the pipeline.
       */
      const createLogger = () => createBuildLogger(repoPath!, buildId)

      const detection = detectProject(repoPath)
      // Framework is detected once, at repository import time, and handed to
      // the builder by the API — it is never detected here.
      const framework = normalizeFramework(response.framework)

      report.strategy = detection.strategy
      report.framework = framework
      report.packageRunner = detection.packageRunner

      switch (detection.strategy) {
        case "node": {
          if (detection.packageRunner === undefined) {
            throw new Error("Package runner is undefined")
          }

          const output = await buildNodeProject({
            projectPath: repoPath,
            packageRunner: detection.packageRunner,
            framework,
            logger: createLogger(),
          })

          logger.info({ output }, "Build output")

          if (isStaticFramework(framework)) {
            if (output.outputDirectory === undefined) {
              throw new Error("Static build produced no output directory")
            }

            const upload = await uploadDirectory({
              config: builderConfig.storage,
              directoryPath: output.outputDirectory,
              objectPrefix,
            })

            logger.info({ upload }, "Artifact upload complete")

            report.artifactBucket = builderConfig.storage.bucket
            report.artifactKey = `${objectPrefix}/`
          } else {
            const container = await containerizeNodeProject({
              projectPath: repoPath,
              packageRunner: detection.packageRunner,
              framework,
              buildId,
              logger: createLogger(),
            })

            logger.info({ container }, "Container image built")

            const pushLogger = createLogger()

            try {
              const push = await pushImage({
                config: builderConfig.dockerRegistry,
                imageName: container.imageName,
                repository: builderConfig.dockerRegistry.repository,
                tag: imageTag,
                onStdout: (data) => pushLogger.stdout(data),
                onStderr: (data) => pushLogger.stderr(data),
              })

              logger.info({ push }, "Image pushed")

              report.imageUrl = push.imageRef.split(":")[0]
              report.imageTag = imageTag
            } finally {
              pushLogger.close()
            }
          }

          break
        }

        case "dockerfile": {
          if (detection.dockerfile === undefined) {
            throw new Error("Dockerfile is undefined")
          }

          const output = await buildDockerfileProject({
            projectPath: repoPath,
            dockerfile: detection.dockerfile,
            buildId,
            logger: createLogger(),
          })

          logger.info({ output }, "Build output")

          const pushLogger = createLogger()

          try {
            const push = await pushImage({
              config: builderConfig.dockerRegistry,
              imageName: output.imageName,
              repository: builderConfig.dockerRegistry.repository,
              tag: imageTag,
              onStdout: (data) => pushLogger.stdout(data),
              onStderr: (data) => pushLogger.stderr(data),
            })

            logger.info({ push }, "Image pushed")

            report.imageUrl = push.imageRef.split(":")[0]
            report.imageTag = imageTag
          } finally {
            pushLogger.close()
          }

          break
        }

        case "docker-compose": {
          if (detection.composeFile === undefined) {
            throw new Error("Compose file is undefined")
          }

          const output = await buildDockerComposeProject({
            projectPath: repoPath,
            composeFile: detection.composeFile,
            logger: createLogger(),
          })

          logger.info({ output }, "Build output")

          const pushLogger = createLogger()

          try {
            const push = await pushComposeImages({
              config: builderConfig.dockerRegistry,
              composeFile: detection.composeFile,
              cwd: repoPath,
              repository: builderConfig.dockerRegistry.repository,
              tag: imageTag,
              onStdout: (data) => pushLogger.stdout(data),
              onStderr: (data) => pushLogger.stderr(data),
            })

            logger.info({ push }, "Image pushed")

            report.imageUrl = push.imageRefs[0]?.split(":")[0] ?? ""
            report.imageTag = imageTag
          } finally {
            pushLogger.close()
          }

          break
        }

        default:
          throw new Error(`Cannot build project with unknown strategy`)
      }

      report.status = "SUCCEEDED"
      report.message = "Build completed"

      return {
        success: true,
      }
    } catch (error) {
      report.status = "FAILED"
      report.message = error instanceof Error ? error.message : String(error)

      throw error
    } finally {
      try {
        await buildCompleted({
          buildId,
          status: report.status,
          message: report.message ?? "",
          imageUrl: report.imageUrl ?? "",
          imageTag: report.imageTag ?? "",
          artifactBucket: report.artifactBucket ?? "",
          artifactKey: report.artifactKey ?? "",
          strategy: report.strategy ?? "",
          framework: report.framework ?? "",
          packageRunner: report.packageRunner ?? "",
        })
      } catch (reportError) {
        logger.error(
          reportError,
          `[Worker ${workerId}] Failed to report build ${buildId}`
        )
      }

      /*
       * Clean up the cloned project directory and any generated
       * Dockerfile after the build finishes.
       */
      if (repoPath) {
        fs.rmSync(repoPath, {
          recursive: true,
          force: true,
        })
      }

      const dockerfilePath = path.join(
        builderConfig.tempDir,
        `${buildId}.Dockerfile`
      )

      if (fs.existsSync(dockerfilePath)) {
        fs.rmSync(dockerfilePath, {
          force: true,
        })
      }
    }
  },
  {
    connection,
  }
)

worker.on("ready", () => {
  logger.info(`[Worker ${workerId}] Ready`)
})

worker.on("error", (error) => {
  logger.error(error, `[Worker ${workerId}] Error`)
})

worker.on("failed", (job, error) => {
  logger.error(error, `[Worker ${workerId}] Job ${job?.id} failed`)
})

worker.on("completed", (job, result) => {
  logger.info({ result }, `[Worker ${workerId}] Job ${job.id} completed`)
})

async function shutdown(signal: string) {
  logger.info(`[Worker ${workerId}] Received ${signal}, shutting down...`)

  await worker.close()

  logger.info(`[Worker ${workerId}] Shutdown complete`)

  process.exit(0)
}

process.on("SIGINT", () => {
  void shutdown("SIGINT")
})

process.on("SIGTERM", () => {
  void shutdown("SIGTERM")
})
