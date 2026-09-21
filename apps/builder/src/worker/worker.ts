import fs from "fs"
import path from "path"
import { Worker } from "bullmq"
import { builderConfig } from "@forge/config"
import { uploadDirectory } from "@forge/storage"
import { pushImage, pushComposeImages } from "@forge/registry"
import { connection, type BuilderQueueJob } from "@/queue/queue"
import { buildStarted, buildCompleted } from "@/gRPC/wrapper/api.wrapper"
import { cloneGitRepository } from "./features/git"
import { detectProject } from "./features/detect"
import {
  buildNodeProject,
  isStaticFramework,
} from "./features/builders/node.builder"
import { containerizeNodeProject } from "./features/builders/node.container"
import { buildDockerfileProject } from "./features/builders/dockerfile.builder"
import { buildDockerComposeProject } from "./features/builders/docker-compose.builder"
import { createBuildLogger } from "./features/logs/build-logs"

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

    console.log(`[Worker ${workerId}] Processing build ${buildId}`)

    const report: BuildReport = {
      status: "FAILED",
    }

    let repoPath: string | undefined

    try {
      const response = await buildStarted({
        buildId,
      })

      console.log(response)

      repoPath = await cloneGitRepository(response)

      /*
       * Each builder closes the logger it receives, so create a
       * fresh one for every step of the pipeline.
       */
      const createLogger = () => createBuildLogger(repoPath!, buildId)

      const detection = detectProject(repoPath)

      report.strategy = detection.strategy
      report.framework = detection.framework
      report.packageRunner = detection.packageRunner

      switch (detection.strategy) {
        case "node": {
          if (detection.packageRunner === undefined) {
            throw new Error("Package runner is undefined")
          }

          if (detection.framework === undefined) {
            throw new Error("Framework is undefined")
          }

          const output = await buildNodeProject({
            projectPath: repoPath,
            packageRunner: detection.packageRunner,
            framework: detection.framework,
            logger: createLogger(),
          })

          console.log({ output })

          if (isStaticFramework(detection.framework)) {
            if (output.outputDirectory === undefined) {
              throw new Error("Static build produced no output directory")
            }

            const upload = await uploadDirectory({
              config: builderConfig.storage,
              directoryPath: output.outputDirectory,
              objectPrefix: `deployments/${response.deploymentId}`,
            })

            console.log({ upload })

            report.artifactBucket = builderConfig.storage.bucket
            report.artifactKey = `deployments/${response.deploymentId}/`
          } else {
            const container = await containerizeNodeProject({
              projectPath: repoPath,
              packageRunner: detection.packageRunner,
              framework: detection.framework,
              buildId,
              logger: createLogger(),
            })

            console.log({ container })

            const pushLogger = createLogger()

            try {
              const push = await pushImage({
                config: builderConfig.dockerRegistry,
                imageName: container.imageName,
                repository: response.repoFullName,
                tag: response.commitSha,
                onStdout: (data) => pushLogger.stdout(data),
                onStderr: (data) => pushLogger.stderr(data),
              })

              console.log({ push })
            } finally {
              pushLogger.close()
            }

            report.imageUrl = `${builderConfig.dockerRegistry.url}/${response.repoFullName.toLowerCase()}`
            report.imageTag = response.commitSha
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

          console.log({ output })

          const pushLogger = createLogger()

          try {
            const push = await pushImage({
              config: builderConfig.dockerRegistry,
              imageName: output.imageName,
              repository: response.repoFullName,
              tag: response.commitSha,
              onStdout: (data) => pushLogger.stdout(data),
              onStderr: (data) => pushLogger.stderr(data),
            })

            console.log({ push })
          } finally {
            pushLogger.close()
          }

          report.imageUrl = `${builderConfig.dockerRegistry.url}/${response.repoFullName.toLowerCase()}`
          report.imageTag = response.commitSha

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

          console.log({ output })

          const pushLogger = createLogger()

          try {
            const push = await pushComposeImages({
              config: builderConfig.dockerRegistry,
              composeFile: detection.composeFile,
              cwd: repoPath,
              repository: response.repoFullName,
              tag: response.commitSha,
              onStdout: (data) => pushLogger.stdout(data),
              onStderr: (data) => pushLogger.stderr(data),
            })

            console.log({ push })
          } finally {
            pushLogger.close()
          }

          report.imageUrl = `${builderConfig.dockerRegistry.url}/${response.repoFullName.toLowerCase()}`
          report.imageTag = response.commitSha

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
        console.error(
          `[Worker ${workerId}] Failed to report build ${buildId}:`,
          reportError
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
  console.log(`[Worker ${workerId}] Ready`)
})

worker.on("error", (error) => {
  console.error(`[Worker ${workerId}] Error:`, error)
})

worker.on("failed", (job, error) => {
  console.error(`[Worker ${workerId}] Job ${job?.id} failed:`, error)
})

worker.on("completed", (job, result) => {
  console.log(`[Worker ${workerId}] Job ${job.id} completed:`, result)
})

async function shutdown(signal: string) {
  console.log(`[Worker ${workerId}] Received ${signal}, shutting down...`)

  await worker.close()

  console.log(`[Worker ${workerId}] Shutdown complete`)

  process.exit(0)
}

process.on("SIGINT", () => {
  void shutdown("SIGINT")
})

process.on("SIGTERM", () => {
  void shutdown("SIGTERM")
})
