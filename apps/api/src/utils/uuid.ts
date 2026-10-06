const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * True when `value` is a canonical UUID.
 *
 * Prisma passes ids straight to Postgres, which throws on a malformed UUID
 * before application code can return a clean 404. Use this to treat stale or
 * mock identifiers as "not found" instead of a 500.
 */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}
