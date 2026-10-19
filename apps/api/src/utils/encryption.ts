import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto"
import { apiConfig } from "@forge/config"
import { ApiError } from "@forge/types/apiResponses"

/*
 * Project environment variables are encrypted at rest with a key that only
 * the API knows (ENV_ENCRYPTION_SECRET). Ciphertexts are self-describing so
 * the format can evolve: v1:<iv>:<authTag>:<ciphertext>, all base64.
 */
const ALGORITHM = "aes-256-gcm"
const VERSION = "v1"
const IV_BYTES = 12
const TAG_BYTES = 16

function encryptionKey(): Buffer {
  const secret = apiConfig.envEncryptionSecret

  if (!secret) {
    throw new ApiError(
      500,
      "ENV_ENCRYPTION_SECRET is not configured on the API."
    )
  }

  // Derive a fixed 32-byte key from the configured secret.
  return createHash("sha256").update(secret, "utf8").digest()
}

export function encryptEnvValue(plaintext: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv)
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])

  return [
    VERSION,
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    ciphertext.toString("base64"),
  ].join(":")
}

/**
 * Decrypts a value produced by {@link encryptEnvValue}.
 *
 * Rows written by a different key or ciphertext layout (a rotated secret, an
 * older format) are rejected here rather than surfacing as an obscure crypto
 * error — see {@link decryptEnvVariables} for how callers cope with them.
 */
export function decryptEnvValue(payload: string): string {
  const parts = payload.split(":")
  const [version, iv, tag, ciphertext] = parts

  if (
    version !== VERSION ||
    parts.length !== 4 ||
    iv === undefined ||
    tag === undefined ||
    ciphertext === undefined
  ) {
    throw new Error("Unsupported environment variable ciphertext format.")
  }

  const ivBytes = Buffer.from(iv, "base64")
  const tagBytes = Buffer.from(tag, "base64")

  // A short IV/tag is a format mismatch, not an auth failure — checking up
  // front also avoids Node's truncated-auth-tag deprecation path.
  if (ivBytes.length !== IV_BYTES || tagBytes.length !== TAG_BYTES) {
    throw new Error("Unsupported environment variable ciphertext format.")
  }

  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), ivBytes)
  decipher.setAuthTag(tagBytes)

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8")
}

/** True when a stored value can still be read with the current key. */
export function isEnvValueReadable(payload: string): boolean {
  try {
    decryptEnvValue(payload)
    return true
  } catch {
    return false
  }
}

export interface DecryptedEnvironment {
  /** Variables that decrypted successfully, keyed by name. */
  values: Record<string, string>
  /**
   * Variables whose stored ciphertext could not be decrypted (written with a
   * different ENV_ENCRYPTION_SECRET or an older format). Callers surface
   * these loudly and carry on: one unreadable row must not block a build or
   * stop the rest of a project's configuration from reaching its workload.
   * Re-entering the value through the API re-encrypts it with the current key.
   */
  failedKeys: string[]
}

/**
 * Turns stored (encrypted) rows into the plaintext map handed to consumers,
 * isolating per-row failures.
 *
 * A missing key is a server misconfiguration rather than a bad row, so it
 * still fails the call outright.
 */
export function decryptEnvVariables(
  variables: { key: string; valueEncrypted: string }[]
): DecryptedEnvironment {
  // Fail fast when the API has no key at all, instead of reporting every
  // variable as unreadable.
  encryptionKey()

  const values: Record<string, string> = {}
  const failedKeys: string[] = []

  for (const variable of variables) {
    try {
      values[variable.key] = decryptEnvValue(variable.valueEncrypted)
    } catch {
      failedKeys.push(variable.key)
    }
  }

  return { values, failedKeys }
}
