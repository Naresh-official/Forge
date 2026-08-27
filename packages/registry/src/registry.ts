import { spawn } from "child_process"

export interface RegistryConfig {
    /**
     * Registry host, e.g. "localhost:5000" for a local
     * docker registry container.
     */
    url: string

    username?: string
    password?: string
}

export interface DockerOutputHandlers {
    onStdout?: (data: string) => void
    onStderr?: (data: string) => void
}

export interface PushImageInput extends DockerOutputHandlers {
    config: RegistryConfig

    /** Local image to push, e.g. "forge-<buildId>". */
    imageName: string

    /**
     * Repository (path) under the registry, e.g. "octocat/hello-world".
     * Defaults to the image name without a tag.
     */
    repository?: string

    /** Defaults to "latest". */
    tag?: string
}

export interface PushImageResult {
    /** Fully qualified image reference, e.g. "localhost:5000/repo:tag". */
    imageRef: string
}

export interface PushComposeImagesInput extends DockerOutputHandlers {
    config: RegistryConfig

    /** Absolute path to the docker-compose file. */
    composeFile: string

    /** Working directory for the compose command. */
    cwd?: string

    /**
     * Repository (path) under the registry that services are pushed to,
     * e.g. "octocat/hello-world". Each service becomes
     * "<url>/<repository>/<service>:<tag>".
     */
    repository: string

    /** Defaults to "latest". */
    tag?: string
}

export interface PushComposeImagesResult {
    imageRefs: string[]
}

interface SpawnDockerOptions extends DockerOutputHandlers {
    args: string[]
    cwd?: string
    /** When set, written to stdin (e.g. docker login --password-stdin). */
    stdinInput?: string
}

function spawnDocker(options: SpawnDockerOptions): Promise<void> {
    const { args, cwd, stdinInput } = options

    return new Promise((resolve, reject) => {
        const child = spawn("docker", args, {
            cwd,
            stdio: ["pipe", "pipe", "pipe"],
        })

        child.stdout.on("data", (data: Buffer) => {
            options.onStdout?.(data.toString())
        })

        child.stderr.on("data", (data: Buffer) => {
            options.onStderr?.(data.toString())
        })

        if (stdinInput !== undefined) {
            child.stdin.write(stdinInput)
            child.stdin.end()
        } else {
            child.stdin.end()
        }

        child.on("error", reject)

        child.on("close", (code) => {
            if (code === 0) {
                resolve()
                return
            }

            reject(
                new Error(`docker ${args.join(" ")} exited with code ${code}`)
            )
        })
    })
}

function runDockerCaptured(options: SpawnDockerOptions): Promise<string> {
    const { args, cwd } = options

    return new Promise((resolve, reject) => {
        const child = spawn("docker", args, {
            cwd,
            stdio: ["ignore", "pipe", "pipe"],
        })

        let stdout = ""

        child.stdout.on("data", (data: Buffer) => {
            stdout += data.toString()
            options.onStdout?.(data.toString())
        })

        child.stderr.on("data", (data: Buffer) => {
            options.onStderr?.(data.toString())
        })

        child.on("error", reject)

        child.on("close", (code) => {
            if (code === 0) {
                resolve(stdout)
                return
            }

            reject(
                new Error(`docker ${args.join(" ")} exited with code ${code}`)
            )
        })
    })
}

async function loginIfNeeded(
    config: RegistryConfig,
    handlers: DockerOutputHandlers
): Promise<void> {
    if (!config.username) {
        return
    }

    await spawnDocker({
        args: [
            "login",
            config.url,
            "--username",
            config.username,
            "--password-stdin",
        ],
        stdinInput: config.password ?? "",
        ...handlers,
    })
}

export async function pushImage(
    input: PushImageInput
): Promise<PushImageResult> {
    const { config, imageName } = input

    const repository = input.repository ?? imageName.split(":")[0] ?? imageName
    const tag = input.tag ?? "latest"
    const imageRef = `${config.url}/${repository}:${tag}`

    await loginIfNeeded(config, input)

    await spawnDocker({
        args: ["tag", imageName, imageRef],
        ...input,
    })

    await spawnDocker({
        args: ["push", imageRef],
        ...input,
    })

    return {
        imageRef,
    }
}

interface ComposeService {
    build?: unknown
    image?: string
}

interface ResolvedComposeConfig {
    name?: string
    services?: Record<string, ComposeService>
}

/**
 * Pushes every service in the compose file that has a build section,
 * including services that don't declare an `image:` name. Compose build
 * tags such images as "<project>-<service>:latest", so this resolves the
 * compose config, tags each built image under the configured registry
 * (as "<url>/<repository>/<service>:<tag>") and pushes it.
 *
 * Services that declare an image already pointing at the configured
 * registry are pushed as-is.
 */
export async function pushComposeImages(
    input: PushComposeImagesInput
): Promise<PushComposeImagesResult> {
    const { config, composeFile, cwd, repository, tag = "latest" } = input

    await loginIfNeeded(config, input)

    const stdout = await runDockerCaptured({
        args: [
            "compose",
            "--file",
            composeFile,
            "config",
            "--no-interpolate",
            "--format",
            "json",
        ],
        cwd,
        ...input,
    })

    const resolved = JSON.parse(stdout) as ResolvedComposeConfig
    const projectName = resolved.name ?? "forge"
    const services = resolved.services ?? {}

    const imageRefs: string[] = []

    for (const [serviceName, service] of Object.entries(services)) {
        if (!service.build) {
            continue
        }

        const declaredImage = service.image

        // Image name produced by "docker compose build".
        const localImage = declaredImage ?? `${projectName}-${serviceName}`

        // Push target: respect registry images declared in the compose
        // file, otherwise route every service into our registry.
        const targetImage =
            declaredImage && declaredImage.startsWith(`${config.url}/`)
                ? declaredImage
                : `${config.url}/${repository}/${serviceName}:${tag}`

        await spawnDocker({
            args: ["tag", localImage, targetImage],
            cwd,
            ...input,
        })

        await spawnDocker({
            args: ["push", targetImage],
            cwd,
            ...input,
        })

        imageRefs.push(targetImage)
    }

    return {
        imageRefs,
    }
}
