"use client"

import { useEffect, useState } from "react"
import { Clock3 } from "lucide-react"

/** "60s" reads badly for the polling hint — say "minute" from 60s up. */
function formatInterval(ms: number) {
  const seconds = ms / 1000
  return seconds >= 60 && seconds % 60 === 0
    ? `${seconds / 60} min`
    : `${seconds}s`
}

/**
 * "Updated 12s ago" tag. Ticks every second so the age stays truthful
 * between the refetches.
 */
export function LastUpdated({
  timestamp,
  intervalMs,
}: {
  timestamp: number
  intervalMs: number
}) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const seconds = Math.max(0, Math.round((now - timestamp) / 1000))
  const relative =
    seconds < 5
      ? "just now"
      : seconds < 60
        ? `${seconds}s ago`
        : `${Math.floor(seconds / 60)}m ago`

  return (
    <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
      <Clock3 className="size-3" />
      Updated {relative}
      <span className="text-muted-foreground/60">
        · refreshes every {formatInterval(intervalMs)}
      </span>
    </span>
  )
}
