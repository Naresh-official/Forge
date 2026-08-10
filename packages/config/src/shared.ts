import fs from "fs"
import path from "path"
import dotenv from "dotenv"
import { parse } from "yaml"

// Helper to find the monorepo workspace root directory
export function findWorkspaceRoot(startDir: string): string {
    let current = startDir
    while (true) {
        const parent = path.dirname(current)
        if (parent === current) {
            return startDir
        }
        if (
            fs.existsSync(path.join(current, "turbo.json")) ||
            fs.existsSync(path.join(current, "bun.lock")) ||
            fs.existsSync(path.join(current, "pnpm-workspace.yaml"))
        ) {
            return current
        }
        current = parent
    }
}

// Resolve current directory
export const currentDir =
    import.meta.dirname ||
    (typeof import.meta.url !== "undefined"
        ? path.dirname(new URL(import.meta.url).pathname)
        : process.cwd())

let envLoaded = false

// Load the global .env file from the workspace root
export function loadEnv(): void {
    if (envLoaded) return
    const workspaceRoot = findWorkspaceRoot(currentDir)
    const envPath = path.join(workspaceRoot, ".env")
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath })
    }
    envLoaded = true
}

// Load and parse the config.yaml file from within the package src directory
export function loadYamlConfig(): Record<string, any> {
    const yamlPath = path.join(currentDir, "config.yaml")
    if (!fs.existsSync(yamlPath)) {
        throw new Error(
            `Configuration file config.yaml not found at: ${yamlPath}`
        )
    }
    const rawYamlContent = fs.readFileSync(yamlPath, "utf-8")
    return parse(rawYamlContent) || {}
}
