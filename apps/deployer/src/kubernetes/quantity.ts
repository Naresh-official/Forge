/**
 * Kubernetes resource quantities ("250m", "12345678n", "512Mi", "1G") are
 * opaque strings. The metrics API also reports CPU as nanocores and memory in
 * binary suffixes, so usage and allocation have to be normalised before they
 * can be compared or shown.
 */

const CPU_SUFFIXES: Record<string, number> = {
  n: 1 / 1_000_000,
  u: 1 / 1_000,
  m: 1,
}

const MEMORY_SUFFIX_MULTIPLIERS: Record<string, number> = {
  Ki: 1 / 1024,
  Mi: 1,
  Gi: 1024,
  Ti: 1024 * 1024,
  K: 1000 / (1024 * 1024),
  M: 1_000_000 / (1024 * 1024),
  G: 1_000_000_000 / (1024 * 1024),
  T: 1_000_000_000_000 / (1024 * 1024),
}

/** Matches a quantity such as `250m`, `0.5`, `12345678n` or `512Mi`. */
const QUANTITY_PATTERN = /^(-?\d+(?:\.\d+)?)([A-Za-z]+)?$/

function splitQuantity(
  value: string | undefined | null
): { amount: number; suffix: string } | null {
  if (typeof value !== "string") {
    return null
  }

  const match = QUANTITY_PATTERN.exec(value.trim())

  if (!match) {
    return null
  }

  return { amount: Number(match[1]), suffix: match[2] ?? "" }
}

/**
 * CPU quantity → millicores. Returns `null` for a missing or unparseable
 * value, so callers can distinguish "no reading" from zero usage.
 */
export function parseCpuMillicores(
  value: string | undefined | null
): number | null {
  const parsed = splitQuantity(value)

  if (!parsed) {
    return null
  }

  const multiplier = parsed.suffix === "" ? 1000 : CPU_SUFFIXES[parsed.suffix]

  if (multiplier === undefined) {
    return null
  }

  return parsed.amount * multiplier
}

/**
 * Memory quantity → MiB. Plain numbers and `K`/`M`/`G` suffixes are decimal
 * bytes; `Ki`/`Mi`/`Gi` are binary. Returns `null` when unparseable.
 */
export function parseMemoryMb(value: string | undefined | null): number | null {
  const parsed = splitQuantity(value)

  if (!parsed) {
    return null
  }

  if (parsed.suffix === "") {
    // No suffix means plain bytes.
    return parsed.amount / (1024 * 1024)
  }

  const multiplier = MEMORY_SUFFIX_MULTIPLIERS[parsed.suffix]

  return multiplier === undefined ? null : parsed.amount * multiplier
}
