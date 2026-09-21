import { builderConfig } from "@forge/config"
import type { BuildStartedResponse } from "@forge/contracts"
import simpleGit from "simple-git"
import fs from "fs"

export async function cloneGitRepository(input: BuildStartedResponse) {
  const targetPath = `${builderConfig.tempDir}/${input.projectId}/${input.deploymentId}/${input.buildId}`

  if (fs.existsSync(targetPath))
    fs.rmSync(targetPath, {
      recursive: true,
      force: true,
    })

  await simpleGit().clone(
    `https://x-access-token:${input.accessToken}@github.com/${input.repoFullName}.git`,
    targetPath,
    {
      "--depth": "1",
      "--revision": input.commitSha,
    }
  )
  return targetPath
}
