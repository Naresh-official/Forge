import fs from "fs"
import path from "path"

export type PackageRunner = "npm" | "pnpm" | "yarn" | "bun" | "unknown"

export type Framework =
    | "nextjs"
    | "vite"
    | "react"
    | "vue"
    | "nuxt"
    | "svelte"
    | "sveltekit"
    | "astro"
    | "angular"
    | "remix"
    | "nestjs"
    | "express"
    | "unknown"

export type BuildStrategy = "dockerfile" | "docker-compose" | "node" | "unknown"

export interface ProjectDetection {
    strategy: BuildStrategy

    packageRunner?: PackageRunner
    packageManagerVersion?: string

    framework?: Framework

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
    const candidates = [
        "Dockerfile",
        "Dockerfile.prod",
        "Dockerfile.production",
    ]

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

function detectFramework(packageJson: PackageJson): Framework {
    const dependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
    }

    /*
     * Full-stack frameworks first.
     */
    if (dependencies["next"]) {
        return "nextjs"
    }

    if (dependencies["@remix-run/react"]) {
        return "remix"
    }

    if (dependencies["nuxt"]) {
        return "nuxt"
    }

    if (dependencies["@sveltejs/kit"]) {
        return "sveltekit"
    }

    if (dependencies["astro"]) {
        return "astro"
    }

    if (dependencies["@angular/core"]) {
        return "angular"
    }

    if (dependencies["@nestjs/core"]) {
        return "nestjs"
    }

    /*
     * Backend frameworks.
     */
    if (dependencies["express"]) {
        return "express"
    }

    /*
     * Frontend frameworks.
     */
    if (dependencies["svelte"]) {
        return "svelte"
    }

    if (dependencies["react"]) {
        /*
         * Vite + React is still a React project.
         */
        return "react"
    }

    if (dependencies["vue"]) {
        /*
         * Nuxt was checked above, so this is
         * a plain Vue project.
         */
        return "vue"
    }

    /*
     * Vite without React/Vue/Svelte/etc.
     */
    if (dependencies["vite"]) {
        return "vite"
    }

    return "unknown"
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

        const framework = detectFramework(packageJson)

        return {
            strategy: "node",
            packageRunner: packageRunner.runner,
            packageManagerVersion: packageRunner.version,
            framework,
        }
    }

    return {
        strategy: "unknown",
    }
}
