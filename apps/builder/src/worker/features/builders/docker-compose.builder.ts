import { runCommand } from "../../process/run-command"
import type { BuildLogger } from "../logs/build-logs"

interface DockerComposeBuildInput {
  projectPath: string
  composeFile: string
  logger: BuildLogger
}

interface DockerComposeBuildResult {
  composeFile: string
}

export async function buildDockerComposeProject(
  input: DockerComposeBuildInput
): Promise<DockerComposeBuildResult> {
  const { projectPath, composeFile, logger } = input

  try {
    await runCommand("docker", ["compose", "--file", composeFile, "build"], {
      cwd: projectPath,

      onStdout: (data) => {
        logger.stdout(data)
      },

      onStderr: (data) => {
        logger.stderr(data)
      },
    })

    return {
      composeFile,
    }
  } finally {
    logger.close()
  }
}
