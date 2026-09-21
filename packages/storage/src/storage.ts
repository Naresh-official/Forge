import fs from "fs"
import path from "path"
import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  PutObjectCommand,
  type BucketLocationConstraint,
} from "@aws-sdk/client-s3"

export interface StorageConfig {
  /**
   * AWS region for the bucket,
   * e.g. "us-east-1".
   */
  region: string

  /** AWS access key ID (IAM user credentials). */
  accessKeyId: string

  /** AWS secret access key. */
  secretAccessKey: string

  /** Name of the S3 bucket for build artifacts. */
  bucket: string
}

export interface UploadDirectoryInput {
  config: StorageConfig

  /** Local directory whose contents will be uploaded recursively. */
  directoryPath: string

  /**
   * Optional prefix prepended to every object key,
   * e.g. "<projectId>/<deploymentId>/<repo-name>". Keys are otherwise
   * relative to directoryPath.
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

export function createStorageClient(config: StorageConfig): S3Client {
  return new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })
}

/**
 * Returns the HTTP status code carried by an S3 error, if any.
 */
function statusCodeOf(error: unknown): number | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "$metadata" in error &&
    typeof error.$metadata === "object" &&
    error.$metadata !== null &&
    "httpStatusCode" in error.$metadata
  ) {
    return (error.$metadata as { httpStatusCode?: number }).httpStatusCode
  }

  return undefined
}

/**
 * Creates the bucket when it does not exist (404 from HeadBucket).
 *
 * us-east-1 is special-cased: it must NOT receive a
 * CreateBucketConfiguration, while every other region requires one.
 */
async function ensureBucket(
  client: S3Client,
  bucket: string,
  region: string
): Promise<void> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }))
    return
  } catch (error) {
    if (statusCodeOf(error) !== 404) {
      throw error
    }
  }

  await client.send(
    new CreateBucketCommand({
      Bucket: bucket,
      ...(region === "us-east-1"
        ? {}
        : {
            CreateBucketConfiguration: {
              LocationConstraint: region as BucketLocationConstraint,
            },
          }),
    })
  )
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

  await ensureBucket(client, config.bucket, config.region)

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

    const stat = await fs.promises.stat(file)

    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: objectKey,
        Body: fs.createReadStream(file),
        ContentLength: stat.size,
      })
    )

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
