import { githubApp } from "@/features/github/github.client"
import prisma from "@/utils/db"
import { completeBuildService } from "@/features/builds/build.service"
import { deployWrapper } from "../wrapper/deployer.wrapper"
import type {
  BuildStartedRequest,
  BuildStartedResponse,
  BuildCompletedRequest,
  BuildCompletedResponse,
} from "@forge/contracts"
import type { sendUnaryData, ServerUnaryCall } from "@grpc/grpc-js"
import { isStaticFramework, normalizeFramework } from "@forge/frameworks"
import { decryptEnvVariables } from "@/utils/encryption"
import { pruneStaleArtifacts } from "@/features/builds/artifacts.service"

export const apiService = {
  async buildStarted(
    call: ServerUnaryCall<BuildStartedRequest, BuildStartedResponse>,
    callback: sendUnaryData<BuildStartedResponse>
  ) {
    try {
      const buildId = call.request.buildId
      if (!buildId) {
        throw new Error("Build ID is required")
      }
      const build = await prisma.build.update({
        where: {
          id: buildId,
        },
        include: {
          deployment: {
            include: {
              project: {
                include: {
                  githubRepository: true,
                  environmentVariables: true,
                },
              },
            },
          },
        },
        data: {
          status: "BUILDING",
          startedAt: new Date(),
          deployment: {
            update: {
              data: {
                status: "BUILDING",
              },
            },
          },
        },
      })

      if (!build) {
        throw new Error("Build not found")
      }
      if (!build.deployment.project.githubRepository) {
        throw new Error("GitHub repository not found")
      }
      if (!build.deployment.project.githubRepository.installationId) {
        throw new Error("GitHub installation not found")
      }
      const { token } = (await githubApp.octokit.auth({
        type: "installation",
        installationId:
          build.deployment.project.githubRepository.installationId,
      })) as { token: string }

      if (!token) {
        throw new Error("GitHub installation token not found")
      }

      const framework = normalizeFramework(
        build.deployment.project.githubRepository.framework
      )

      /*
       * Build-time environment variables only matter to static builds, where
       * the builder runs install/build itself. Container images get their
       * configuration at runtime, so there is no reason to hand those
       * plaintext secrets out over gRPC. Decryption happens here because the
       * API is the only service holding ENV_ENCRYPTION_SECRET.
       */
      const { values: environmentVariables, failedKeys } = isStaticFramework(
        framework
      )
        ? decryptEnvVariables(build.deployment.project.environmentVariables)
        : { values: {}, failedKeys: [] }

      if (failedKeys.length > 0) {
        /*
         * The build proceeds with the variables that are readable — one row
         * written under an older key must not block every build. Loud,
         * because the artifact will be missing those values.
         */
        console.error(
          `[build ${build.id}] Could not decrypt environment variable(s): ${failedKeys.join(
            ", "
          )} — not injected into the build.`
        )
      }

      callback(null, {
        accessToken: token,
        repoFullName: build.deployment.project.githubRepository.fullName,
        projectId: build.deployment.project.id,
        deploymentId: build.deployment.id,
        branch: build.deployment.branch,
        commitSha: build.deployment.commitSha,
        buildId: build.id,
        framework,
        environmentVariables,
      })
    } catch (error) {
      callback(error as Error, null)
      return
    }
  },

  async buildCompleted(
    call: ServerUnaryCall<BuildCompletedRequest, BuildCompletedResponse>,
    callback: sendUnaryData<BuildCompletedResponse>
  ) {
    try {
      const request = call.request

      if (!request.buildId) {
        throw new Error("Build ID is required")
      }

      if (!["SUCCEEDED", "FAILED", "CANCELLED"].includes(request.status)) {
        throw new Error(`Invalid build status: ${request.status}`)
      }

      const updatedBuild = await completeBuildService({
        buildId: request.buildId,
        status: request.status as "SUCCEEDED" | "FAILED" | "CANCELLED",
        imageUrl: request.imageUrl || undefined,
        imageTag: request.imageTag || undefined,
        artifactBucket: request.artifactBucket || undefined,
        artifactKey: request.artifactKey || undefined,
      })

      /*
       * A successful static build has just uploaded its output under a fresh
       * "<projectId>/<deploymentId>/" prefix, so the project's older artifact
       * sets can be pruned. This is what makes "env change → rebuild" leave
       * exactly one artifact set behind. Container builds produce images
       * instead, which are pruned with the project.
       */
      if (request.status === "SUCCEEDED" && request.artifactKey) {
        const pruningWarnings = await pruneStaleArtifacts(
          updatedBuild.deployment.projectId,
          updatedBuild.deployment.id
        )

        for (const warning of pruningWarnings) {
          console.warn(`[build ${request.buildId}] ${warning}`)
        }
      }

      if (request.status === "SUCCEEDED" && updatedBuild.deployment) {
        try {
          const resources = await prisma.deploymentResource.findUnique({
            where: { deploymentId: updatedBuild.deployment.id },
          })

          await deployWrapper({
            deploymentId: updatedBuild.deployment.id,
            projectId: updatedBuild.deployment.projectId,
            buildId: request.buildId,
            imageUrl: request.imageUrl || "",
            imageTag: request.imageTag || "",
            artifactBucket: request.artifactBucket || "",
            artifactKey: request.artifactKey || "",
            strategy: request.strategy || "",
            framework: request.framework || "",
            cpuMillicores: resources?.cpuMillicores ?? 0,
            memoryMb: resources?.memoryMb ?? 0,
            ephemeralStorageMb: resources?.ephemeralStorageMb ?? 0,
            autoscalingEnabled: resources?.autoscalingEnabled ?? false,
          })
        } catch (deployError) {
          console.error("Failed to forward build to deployer:", deployError)

          /*
           * The deployer never received the job, so no one will report a
           * final status — fail the deployment here instead of leaving it
           * stuck in BUILDING.
           */
          await prisma.deployment.update({
            where: { id: updatedBuild.deployment.id },
            data: {
              status: "FAILED",
              completedAt: new Date(),
            },
          })
        }
      }

      callback(null, {
        success: true,
        message: "Build completed",
      })
    } catch (error) {
      callback(error as Error, null)
      return
    }
  },
}
