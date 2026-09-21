import fs from "fs"
import path from "path"
import { Client as MinioClient } from "minio"

export interface StorageConfig {
  /**
   * Full endpoint URL of the S3-compatible server,
   * e.g. "http://localhost:9000" for a local MinIO instance.
   */
  endpoint: string

  accessKey: string
  secretKey: string
  bucket: string

  /** Defaults to "us-east-1". */
  region?: string

  /** Defaults to false (http). */
  useSSL?: boolean
}

export interface UploadDirectoryInput {
  config: StorageConfig

  /** Local directory whose contents will be uploaded recursively. */
  directoryPath: string

  /**
   * Optional prefix prepended to every object key,
   * e.g. "deployments/123". Keys are otherwise relative to directoryPath.
   */
  objectPrefix?: string
}

export interface UploadDirectoryResult {
  bucket: string

  /** Object keys written to the bucket. */
  uploadedKeys: string[]

  fileCount: number
  totalBytes: number
}

export function createStorageClient(config: StorageConfig): MinioClient {
  const url = new URL(config.endpoint)

  return new MinioClient({
    endPoint: url.hostname,
    port: url.port ? Number(url.port) : config.useSSL ? 443 : 80,
    useSSL: config.useSSL ?? false,
    accessKey: config.accessKey,
    secretKey: config.secretKey,
    region: config.region ?? "us-east-1",
  })
}

async function ensureBucket(
  client: MinioClient,
  bucket: string,
  region: string
): Promise<void> {
  const exists = await client.bucketExists(bucket)

  if (!exists) {
    await client.makeBucket(bucket, region)
  }
}

function listFilesRecursive(directoryPath: string): string[] {
  const files: string[] = []

  for (const entry of fs.readdirSync(directoryPath, {
    withFileTypes: true,
  })) {
    const fullPath = path.join(directoryPath, entry.name)

    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(fullPath))
    } else if (entry.isFile()) {
      files.push(fullPath)
    }
  }

  return files
}

export async function uploadDirectory(
  input: UploadDirectoryInput
): Promise<UploadDirectoryResult> {
  const { config, directoryPath, objectPrefix } = input

  const client = createStorageClient(config)
  const region = config.region ?? "us-east-1"

  await ensureBucket(client, config.bucket, region)

  const files = listFilesRecursive(directoryPath)
  const prefix = (objectPrefix ?? "").replace(/^\/+|\/+$/g, "")

  const uploadedKeys: string[] = []
  let totalBytes = 0

  for (const file of files) {
    const relativeKey = path
      .relative(directoryPath, file)
      .split(path.sep)
      .join("/")

    const objectKey = prefix ? `${prefix}/${relativeKey}` : relativeKey

    await client.fPutObject(config.bucket, objectKey, file)

    const stat = await fs.promises.stat(file)
    totalBytes += stat.size
    uploadedKeys.push(objectKey)
  }

  return {
    bucket: config.bucket,
    uploadedKeys,
    fileCount: files.length,
    totalBytes,
  }
}

export { MinioClient }
export type { BucketItem } from "minio"
