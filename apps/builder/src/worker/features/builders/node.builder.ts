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
    outputDirectory?: string
}

/*
 * Frameworks whose build output is a static site that can be
 * uploaded to object storage. Everything else runs a server
 * and is containerized instead.
 */
const STATIC_FRAMEWORKS: Framework[] = [
    "vite",
    "react",
    "vue",
    "svelte",
    "sveltekit",
    "astro",
    "angular",
]

export function isStaticFramework(framework: Framework): boolean {
    return STATIC_FRAMEWORKS.includes(framework)
}

interface PackageJson {
    scripts?: {
        build?: string
    }
}

function readPackageJson(projectPath: string): PackageJson | null {
    const packageJsonPath = path.join(projectPath, "package.json")

    if (!fs.existsSync(packageJsonPath)) {
        return null
    }

    try {
        return JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"))
    } catch {
        return null
    }
}

function getInstallCommand(
    runner: PackageRunner,
    projectPath: string
): {
    command: string
    args: string[]
} {
    switch (runner) {
        case "npm":
            /*
             * npm ci requires an existing lockfile. Fall back
             * to npm install for lockfile-less projects.
             */
            if (fs.existsSync(path.join(projectPath, "package-lock.json"))) {
                return {
                    command: "npm",
                    args: ["ci"],
                }
            }

            return {
                command: "npm",
                args: ["install"],
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

/*
 * Candidate output directories per framework, in priority order.
 * The first directory that exists after the build is used.
 */
function getOutputDirectoryCandidates(framework: Framework): string[] {
    switch (framework) {
        case "nextjs":
            return [".next"]

        case "nuxt":
            /*
             * nuxi build outputs to .output, nuxi generate
             * outputs to dist.
             */
            return [".output", "dist"]

        case "remix":
            return ["build"]

        case "sveltekit":
            return ["build", "dist"]

        case "vite":
        case "react":
        case "vue":
        case "svelte":
        case "astro":
        case "angular":
        case "nestjs":
        case "express":
        case "unknown":
            return ["dist"]
    }
}

/*
 * Frameworks without a well-known output directory.
 * For these the build output is best-effort.
 */
function hasStandardOutputDirectory(framework: Framework): boolean {
    return framework !== "express" && framework !== "unknown"
}

function findOutputDirectory(
    projectPath: string,
    framework: Framework
): string | undefined {
    for (const candidate of getOutputDirectoryCandidates(framework)) {
        const directory = path.join(projectPath, candidate)

        if (fs.existsSync(directory)) {
            return directory
        }
    }

    return undefined
}

export async function buildNodeProject(
    input: NodeBuildInput
): Promise<NodeBuildResult> {
    const { projectPath, packageRunner, framework, logger } = input

    try {
        const install = getInstallCommand(packageRunner, projectPath)

        await runCommand(install.command, install.args, {
            cwd: projectPath,

            onStdout: (data) => {
                logger.stdout(data)
            },

            onStderr: (data) => {
                logger.stderr(data)
            },
        })

        const packageJson = readPackageJson(projectPath)
        const hasBuildScript = packageJson?.scripts?.build !== undefined

        /*
         * Projects without a build script (e.g. plain JavaScript
         * Express apps) are install-only and still buildable.
         */
        if (hasBuildScript) {
            await runCommand(packageRunner, ["run", "build"], {
                cwd: projectPath,

                onStdout: (data) => {
                    logger.stdout(data)
                },

                onStderr: (data) => {
                    logger.stderr(data)
                },
            })
        }

        const outputDirectory = findOutputDirectory(projectPath, framework)

        if (
            hasBuildScript &&
            hasStandardOutputDirectory(framework) &&
            outputDirectory === undefined
        ) {
            throw new Error(
                `Build completed but output directory was not found for framework: ${framework}`
            )
        }

        return {
            outputDirectory,
        }
    } finally {
        logger.close()
    }
}
