import fs from "fs"
import path from "path"

import type { PackageRunner } from "@forge/frameworks"

export type { Framework, PackageRunner } from "@forge/frameworks"

export type BuildStrategy = "dockerfile" | "docker-compose" | "node" | "unknown"

export interface ProjectDetection {
  strategy: BuildStrategy

  packageRunner?: PackageRunner
  packageManagerVersion?: string

  dockerfile?: string
  composeFile?: string
}

interface PackageJson {
  packageManager?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

function fileExists(projectPath: string, filename: string) {
  return fs.existsSync(path.join(projectPath, filename))
}

function findDockerfile(projectPath: string): string | undefined {
  const candidates = ["Dockerfile", "Dockerfile.prod", "Dockerfile.production"]

  for (const filename of candidates) {
    if (fileExists(projectPath, filename)) {
      return path.join(projectPath, filename)
    }
  }

  return undefined
}

function findComposeFile(projectPath: string): string | undefined {
  const candidates = [
    "compose.yaml",
    "compose.yml",
    "docker-compose.yaml",
    "docker-compose.yml",
  ]

  for (const filename of candidates) {
    if (fileExists(projectPath, filename)) {
      return path.join(projectPath, filename)
    }
  }

  return undefined
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

function detectPackageRunner(
  projectPath: string,
  packageJson: PackageJson
): {
  runner: PackageRunner
  version?: string
} {
  /*
   * packageManager has the highest priority.
   *
   * Example:
   * "packageManager": "pnpm@10.14.0"
   */
  if (typeof packageJson.packageManager === "string") {
    const [manager, version] = packageJson.packageManager.split("@")

    if (
      manager === "npm" ||
      manager === "pnpm" ||
      manager === "yarn" ||
      manager === "bun"
    ) {
      return {
        runner: manager,
        version,
      }
    }
  }

  /*
   * Fall back to lockfiles.
   */
  if (fileExists(projectPath, "pnpm-lock.yaml")) {
    return {
      runner: "pnpm",
    }
  }

  if (fileExists(projectPath, "yarn.lock")) {
    return {
      runner: "yarn",
    }
  }

  if (
    fileExists(projectPath, "bun.lock") ||
    fileExists(projectPath, "bun.lockb")
  ) {
    return {
      runner: "bun",
    }
  }

  if (fileExists(projectPath, "package-lock.json")) {
    return {
      runner: "npm",
    }
  }

  /*
   * A package.json without a lockfile most commonly
   * means npm, since npm is available with Node.js.
   */
  return {
    runner: "npm",
  }
}

export function detectProject(projectPath: string): ProjectDetection {
  const dockerfile = findDockerfile(projectPath)
  const composeFile = findComposeFile(projectPath)
  const packageJson = readPackageJson(projectPath)

  /*
   * Docker Compose gets priority when both Compose
   * and a Dockerfile exist because Compose may define
   * how the Dockerfile should actually be used.
   */
  if (composeFile) {
    return {
      strategy: "docker-compose",
      dockerfile,
      composeFile,
    }
  }

  /*
   * A Dockerfile means the repository defines its
   * own build environment.
   */
  if (dockerfile) {
    return {
      strategy: "dockerfile",
      dockerfile,
    }
  }

  /*
   * No Docker configuration.
   * Try to detect a Node.js project.
   */
  if (packageJson) {
    const packageRunner = detectPackageRunner(projectPath, packageJson)

    return {
      strategy: "node",
      packageRunner: packageRunner.runner,
      packageManagerVersion: packageRunner.version,
    }
  }

  return {
    strategy: "unknown",
  }
}
