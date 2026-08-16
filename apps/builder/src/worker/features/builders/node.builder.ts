import fs from "fs"
import path from "path"
import type { Framework, PackageRunner } from "../detect"
import { runCommand } from "../../process/run-command"
import type { BuildLogger } from "../logs/build-logs"

interface NodeBuildInput {
    projectPath: string
    packageRunner: PackageRunner
    framework: Framework
    logger: BuildLogger
}

interface NodeBuildResult {
    outputDirectory: string
}

function getInstallCommand(runner: PackageRunner): {
    command: string
    args: string[]
} {
    switch (runner) {
        case "npm":
            return {
                command: "npm",
                args: ["ci"],
            }

        case "pnpm":
            return {
                command: "pnpm",
                args: ["install", "--frozen-lockfile"],
            }

        case "yarn":
            return {
                command: "yarn",
                args: ["install", "--frozen-lockfile"],
            }

        case "bun":
            return {
                command: "bun",
                args: ["install", "--frozen-lockfile"],
            }

        default:
            throw new Error(`Unsupported package runner: ${runner}`)
    }
}

function getOutputDirectory(projectPath: string, framework: Framework): string {
    switch (framework) {
        case "nextjs":
            return path.join(projectPath, ".next")

        case "vite":
        case "react":
        case "vue":
        case "svelte":
        case "sveltekit":
        case "astro":
        case "angular":
            return path.join(projectPath, "dist")

        default:
            throw new Error(
                `Cannot determine output directory for framework: ${framework}`
            )
    }
}

export async function buildNodeProject(
    input: NodeBuildInput
): Promise<NodeBuildResult> {
    const { projectPath, packageRunner, framework, logger } = input

    try {
        const install = getInstallCommand(packageRunner)

        await runCommand(install.command, install.args, {
            cwd: projectPath,

            onStdout: (data) => {
                logger.stdout(data)
            },

            onStderr: (data) => {
                logger.stderr(data)
            },
        })

        await runCommand(packageRunner, ["run", "build"], {
            cwd: projectPath,

            onStdout: (data) => {
                logger.stdout(data)
            },

            onStderr: (data) => {
                logger.stderr(data)
            },
        })

        const outputDirectory = getOutputDirectory(projectPath, framework)

        if (!fs.existsSync(outputDirectory)) {
            throw new Error(
                `Build completed but output directory was not found: ${outputDirectory}`
            )
        }

        return {
            outputDirectory,
        }
    } finally {
        logger.close()
    }
}
