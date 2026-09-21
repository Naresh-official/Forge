import { spawn } from "child_process"

export interface RegistryConfig {
  /**
   * Public hostname of the ECR registry,
   * e.g. "123456789012.dkr.ecr.us-east-1.amazonaws.com".
   */
  registryId?: string

  /** AWS region of the ECR registry. */
  region: string

  /** AWS access key ID (IAM user credentials). */
  accessKeyId: string

  /** AWS secret access key. */
  secretAccessKey: string
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
   * Repository (path) under the registry, e.g. "forge-project".
   * Defaults to the image name without a tag.
   */
  repository?: string

  /**
   * Tag for the pushed image. Since Docker tags cannot contain slashes,
   * namespaced identities such as "<projectId>/<deploymentId>/<repo-name>"
   * must be joined with "." instead — see buildImageTag.
   */
  tag?: string
}

/**
 * Builds the tag identifying an image inside the single "forge-project"
 * ECR repository: "<projectId>.<deploymentId>.<repoName>", with a "-dev"
 * suffix appended when isDev is true.
 *
 * Docker tags cannot contain "/", so the path structure
 * "<projectId>/<deploymentId>/<repoName>" is flattened with ".".
 */
export function buildImageTag(
  projectId: string,
  deploymentId: string,
  repoName: string,
  isDev: boolean
): string {
  const normalizedRepoName = normalizeRepository(repoName).replace(
    /[^a-z0-9._-]/g,
    "-"
  )

  const tag = `${projectId}.${deploymentId}.${normalizedRepoName}`

  return isDev ? `${tag}-dev` : tag
}

export interface PushImageResult {
  /** Fully qualified image reference, e.g. "123456789012.dkr.ecr.us-east-1.amazonaws.com/repo:tag". */
  imageRef: string
}

export interface PushComposeImagesInput extends DockerOutputHandlers {
  config: RegistryConfig

  /** Absolute path to the docker-compose file. */
  composeFile: string

  /** Working directory for the compose command. */
  cwd?: string

  /**
   * Single repository all service images are pushed into,
   * e.g. "forge-project". Each service becomes
   * "<registry>/<repository>:<tag>.<service>".
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

interface ComposeService {
  build?: unknown
  image?: string
}

interface ResolvedComposeConfig {
  name?: string
  services?: Record<string, ComposeService>
}

/*
 * Docker repository names must be lowercase. GitHub repo full names
 * ("Owner/repo") frequently contain uppercase characters, so every
 * repository path we hand to docker is normalized here.
 */
function normalizeRepository(repository: string): string {
  return repository.toLowerCase()
}

function formatDockerError(
  args: string[],
  code: number | null,
  stderr: string
): Error {
  const details = stderr.trim()

  return new Error(
    `docker ${args.join(" ")} exited with code ${code}` +
      (details ? `: ${details}` : "")
  )
}

function spawnDocker(options: SpawnDockerOptions): Promise<void> {
  const { args, cwd, stdinInput } = options

  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
    })

    let stderr = ""

    child.stdout.on("data", (data: Buffer) => {
      options.onStdout?.(data.toString())
    })

    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString()
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

      reject(formatDockerError(args, code, stderr))
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
    let stderr = ""

    child.stdout.on("data", (data: Buffer) => {
      stdout += data.toString()
      options.onStdout?.(data.toString())
    })

    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString()
      options.onStderr?.(data.toString())
    })

    child.on("error", reject)

    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout)
        return
      }

      reject(formatDockerError(args, code, stderr))
    })
  })
}

function decodeAuthorizationToken(authorizationToken: string): {
  username: string
  password: string
} {
  const decoded = Buffer.from(authorizationToken, "base64").toString("utf-8")

  const separatorIndex = decoded.indexOf(":")

  if (separatorIndex === -1) {
    throw new Error("Malformed ECR authorization token")
  }

  return {
    username: decoded.slice(0, separatorIndex),
    password: decoded.slice(separatorIndex + 1),
  }
}

export interface EcrAuthorizationToken {
  /** Registry host, e.g. "123456789012.dkr.ecr.us-east-1.amazonaws.com". */
  registryHost: string

  /** Always "AWS" for ECR. */
  username: string

  /** Short-lived password decoded from the authorization token. */
  password: string
}

/**
 * Fetches a short-lived (12h) ECR authorization token via the ECR
 * GetAuthorizationToken API and decodes it into docker login credentials.
 *
 * Used by pushImage/pushComposeImages for "docker login" and by the
 * deployer to build Kubernetes imagePullSecrets.
 */
export async function getEcrAuthorizationToken(
  config: RegistryConfig
): Promise<EcrAuthorizationToken> {
  const { ECRClient, GetAuthorizationTokenCommand } =
    await import("@aws-sdk/client-ecr")

  const ecr = new ECRClient({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })

  const response = await ecr.send(
    new GetAuthorizationTokenCommand({
      ...(config.registryId ? { registryIds: [config.registryId] } : {}),
    })
  )

  const authorization = response.authorizationData?.[0]

  if (!authorization?.authorizationToken || !authorization.proxyEndpoint) {
    throw new Error("ECR returned no authorization data")
  }

  const { username, password } = decodeAuthorizationToken(
    authorization.authorizationToken
  )

  const registryHost = authorization.proxyEndpoint.replace(/^https?:\/\//, "")

  return {
    registryHost,
    username,
    password,
  }
}

/**
 * Creates the ECR repository if it does not exist.
 *
 * Unlike a self-hosted registry, ECR refuses pushes to repositories that
 * have not been created up-front, so this runs before every push.
 * "RepositoryNotFoundException"/409 AlreadyExistsException races are
 * treated as success.
 */
async function ensureEcrRepository(
  config: RegistryConfig,
  repository: string
): Promise<void> {
  const { ECRClient, DescribeRepositoriesCommand, CreateRepositoryCommand } =
    await import("@aws-sdk/client-ecr")

  const ecr = new ECRClient({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })

  try {
    await ecr.send(
      new DescribeRepositoriesCommand({
        repositoryNames: [repository],
        ...(config.registryId ? { registryId: config.registryId } : {}),
      })
    )
  } catch (error) {
    const name =
      typeof error === "object" && error !== null && "name" in error
        ? String((error as { name?: unknown }).name)
        : ""

    if (name !== "RepositoryNotFoundException") {
      throw error
    }

    try {
      await ecr.send(
        new CreateRepositoryCommand({
          repositoryName: repository,
          imageTagMutability: "MUTABLE",
          ...(config.registryId ? { registryId: config.registryId } : {}),
        })
      )
    } catch (createError) {
      const createName =
        typeof createError === "object" &&
        createError !== null &&
        "name" in createError
          ? String((createError as { name?: unknown }).name)
          : ""

      // Another worker created it first — fine.
      if (createName !== "RepositoryAlreadyExistsException") {
        throw createError
      }
    }
  }
}

/*
 * ECR requires an IAM-signed Docker login rather than static credentials.
 * We fetch a short-lived token via GetAuthorizationToken (SDK, not the CLI,
 * so no aws-cli dependency) and log in with it.
 */
async function loginIfNeeded(
  config: RegistryConfig,
  handlers: DockerOutputHandlers
): Promise<void> {
  const { registryHost, username, password } =
    await getEcrAuthorizationToken(config)

  await spawnDocker({
    args: ["login", registryHost, "--username", username, "--password-stdin"],
    stdinInput: password,
    ...handlers,
  })
}

/**
 * Builds the ECR repository name for an image.
 *
 * ECR repository names may contain lowercase alphanumerics, periods,
 * dashes and underscores, and can be namespaced with slashes.
 */
export async function pushImage(
  input: PushImageInput
): Promise<PushImageResult> {
  const { config, imageName } = input

  const registryHost = registryHostFrom(config)

  const repository = normalizeRepository(
    input.repository ?? imageName.split(":")[0] ?? imageName
  )
  const tag = input.tag ?? "latest"
  const imageRef = `${registryHost}/${repository}:${tag}`

  await loginIfNeeded(config, input)
  await ensureEcrRepository(config, repository)

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

/**
 * Derives the registry host from the AWS account id and region.
 */
function registryHostFrom(config: RegistryConfig): string {
  return `${config.registryId}.dkr.ecr.${config.region}.amazonaws.com`
}

/**
 * Pushes every service in the compose file that has a build section,
 * including services that don't declare an `image:` name. Compose build
 * tags such images as "<project>-<service>:latest", so this resolves the
 * compose config, tags each built image under the configured ECR registry
 * (as "<registry>/<repository>:<tag>.<service>") and pushes it.
 *
 * Services that declare an image already pointing at the configured
 * registry are pushed as-is.
 */
export async function pushComposeImages(
  input: PushComposeImagesInput
): Promise<PushComposeImagesResult> {
  const { config, composeFile, cwd, repository, tag = "latest" } = input

  const registryHost = registryHostFrom(config)

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
      declaredImage && declaredImage.startsWith(`${registryHost}/`)
        ? declaredImage
        : `${registryHost}/${normalizeRepository(repository)}:${tag}.${normalizeRepository(serviceName)}`

    // All services share the single repository.
    await ensureEcrRepository(config, normalizeRepository(repository))

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
