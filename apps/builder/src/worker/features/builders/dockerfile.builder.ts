import { runCommand } from "../../process/run-command"
import type { BuildLogger } from "../logs/build-logs"

interface DockerfileBuildInput {
    projectPath: string
    dockerfile: string
    buildId: string
    logger: BuildLogger
}

interface DockerfileBuildResult {
    imageName: string
}

export async function buildDockerfileProject(
    input: DockerfileBuildInput
): Promise<DockerfileBuildResult> {
    const { projectPath, dockerfile, buildId, logger } = input

    try {
        /*
         * Tag the image with the build id so every build
         * produces a unique, identifiable image.
         */
        const imageName = `forge-${buildId}`

        await runCommand(
            "docker",
            ["build", "--file", dockerfile, "--tag", imageName, projectPath],
            {
                cwd: projectPath,

                onStdout: (data) => {
                    logger.stdout(data)
                },

                onStderr: (data) => {
                    logger.stderr(data)
                },
            }
        )

        return {
            imageName,
        }
    } finally {
        logger.close()
    }
}
