import fs from "fs"
import path from "path"
import { builderConfig } from "@forge/config"
import type { Framework, PackageRunner } from "../detect"
import type { BuildLogger } from "../logs/build-logs"
import { buildDockerfileProject } from "./dockerfile.builder"

interface NodeContainerInput {
  projectPath: string
  packageRunner: PackageRunner
  framework: Framework
  buildId: string
  logger: BuildLogger
}

interface NodeContainerResult {
  imageName: string
  dockerfile: string
}

interface PackageJson {
  scripts?: Record<string, string>
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

function getRunnerStartCommand(runner: PackageRunner): string[] {
  switch (runner) {
    case "npm":
      return ["npm", "run", "start"]

    case "pnpm":
      return ["pnpm", "run", "start"]

    case "yarn":
      return ["yarn", "start"]

    case "bun":
      return ["bun", "run", "start"]

    default:
      return ["npm", "run", "start"]
  }
}

function findEntryFile(projectPath: string): string | undefined {
  const candidates = [
    "dist/main.js",
    "dist/index.js",
    "src/main.js",
    "src/index.js",
    "index.js",
    "server.js",
    "app.js",
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(projectPath, candidate))) {
      return candidate
    }
  }

  return undefined
}

function getStartCommand(input: {
  projectPath: string
  packageRunner: PackageRunner
  framework: Framework
  packageJson: PackageJson
}): { command: string[]; needsBun: boolean } {
  const { projectPath, packageRunner, framework, packageJson } = input

  const startScript = packageJson.scripts?.start

  if (typeof startScript === "string" && startScript.trim() !== "") {
    return {
      command: getRunnerStartCommand(packageRunner),
      needsBun: packageRunner === "bun",
    }
  }

  switch (framework) {
    case "nextjs":
      return {
        command: ["npx", "next", "start", "-p", "3000"],
        needsBun: false,
      }

    case "nuxt":
      return {
        command: ["node", ".output/server/index.mjs"],
        needsBun: false,
      }

    case "remix":
      return {
        command: ["npx", "remix-serve", "build"],
        needsBun: false,
      }

    case "nestjs":
    case "express":
    case "unknown": {
      const entry = findEntryFile(projectPath)

      if (entry) {
        return {
          command: ["node", entry],
          needsBun: false,
        }
      }

      throw new Error(
        `Cannot determine start command for framework: ${framework}`
      )
    }

    default:
      throw new Error(`Cannot containerize framework: ${framework}`)
  }
}

/*
 * Generates a runtime Dockerfile for a server-side Node project.
 *
 * The project has already been installed and built on the worker host,
 * so the image copies the whole project (including node_modules and the
 * built output) and just runs the start command.
 */
function generateDockerfile(input: {
  startCommand: string[]
  needsBun: boolean
}): string {
  const lines = [
    "FROM node:20-alpine",
    "WORKDIR /app",
    "COPY . .",
    "ENV NODE_ENV=production",
    "ENV PORT=3000",
    "EXPOSE 3000",
    `CMD ${JSON.stringify(input.startCommand)}`,
  ]

  if (input.needsBun) {
    lines.splice(1, 0, "RUN npm install -g bun")
  }

  return `${lines.join("\n")}\n`
}

export async function containerizeNodeProject(
  input: NodeContainerInput
): Promise<NodeContainerResult> {
  const { projectPath, packageRunner, framework, buildId, logger } = input

  const packageJson = readPackageJson(projectPath) ?? {}

  const { command: startCommand, needsBun } = getStartCommand({
    projectPath,
    packageRunner,
    framework,
    packageJson,
  })

  const dockerfilePath = path.join(
    builderConfig.tempDir,
    `${buildId}.Dockerfile`
  )

  fs.mkdirSync(path.dirname(dockerfilePath), {
    recursive: true,
  })

  fs.writeFileSync(
    dockerfilePath,
    generateDockerfile({
      startCommand,
      needsBun,
    })
  )

  const { imageName } = await buildDockerfileProject({
    projectPath,
    dockerfile: dockerfilePath,
    buildId,
    logger,
  })

  return {
    imageName,
    dockerfile: dockerfilePath,
  }
}
