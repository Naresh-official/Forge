"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { Button } from "@forge/ui/components/button"

/** Clipboard affordance — the only part of the shared UI kit that needs state. */
export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      aria-label="Copy"
      onClick={async () => {
        await navigator.clipboard?.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      }}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </Button>
  )
}
