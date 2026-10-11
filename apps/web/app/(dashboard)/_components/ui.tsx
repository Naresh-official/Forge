"use client"

import { Check, Copy, Plus, X } from "lucide-react"
import { useState } from "react"
import { Alert, AlertTitle } from "@forge/ui/components/alert"
import { Badge } from "@forge/ui/components/badge"
import { Button } from "@forge/ui/components/button"
import { Card } from "@forge/ui/components/card"
import { Table } from "@forge/ui/components/table"
import { cn } from "@forge/ui/lib/utils"

export function StatusBadge({ status }: { status?: string }) {
  const norm = (status ?? "").toUpperCase()
  const good = [
    "READY",
    "PRODUCTION",
    "CONFIGURED",
    "ACTIVE",
    "OPERATIONAL",
    "CONNECTED",
    "SUCCESS",
  ].includes(norm)
  const warn = [
    "BUILDING",
    "DEPLOYING",
    "PREVIEW",
    "VERIFYING",
    "PENDING",
    "QUEUED",
    "PAUSED",
  ].includes(norm)

  const formattedStatus =
    status && status.length > 0
      ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
      : "Unknown"

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 px-2 py-1 text-sm",
        good ? "text-emerald-400" : warn ? "text-amber-400" : "text-rose-400"
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          good ? "bg-emerald-400" : warn ? "bg-amber-400" : "bg-rose-400"
        )}
      />
      {formattedStatus}
    </Badge>
  )
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  onAction,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: string
  onAction?: () => void
}) {
  return (
    <div className="mb-8 flex items-end justify-between gap-5 max-sm:flex-col max-sm:items-start">
      <div>
        {eyebrow && (
          <p className="mb-2.5 font-mono text-[9px] tracking-[0.12em] text-muted-foreground uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="text-3xl font-semibold tracking-[-0.045em] max-sm:text-[26px]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {action && (
        <Button
          type="button"
          size="lg"
          onClick={onAction}
          className="gap-2 px-3.5 py-2.5 text-[11px] font-bold max-sm:w-full"
        >
          <Plus className="size-3.5" />
          {action}
        </Button>
      )}
    </div>
  )
}

export function EmptyState({
  title,
  action,
  onAction,
}: {
  title: string
  action?: string
  onAction?: () => void
}) {
  return (
    <Card className="flex min-h-60 flex-col items-center justify-center gap-2 border border-dashed border-border text-muted-foreground ring-0">
      <div className="rounded-md border border-border p-2">□</div>
      <h3 className="mt-1 text-sm text-foreground">{title}</h3>
      <p className="mb-2 text-sm">There&apos;s nothing here yet.</p>
      {action && onAction && (
        <Button
          type="button"
          onClick={onAction}
          className="gap-2 py-2 text-[11px] font-semibold"
        >
          <Plus className="size-3.5" />
          {action}
        </Button>
      )}
    </Card>
  )
}

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

export function DataTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <Table>
        {children}
      </Table>
    </div>
  )
}

export function Toast({
  message,
  onClose,
}: {
  message: string
  onClose: () => void
}) {
  return (
    <Alert className="fixed right-6 bottom-6 z-50 flex w-fit items-center gap-2 rounded-md border-emerald-900 bg-emerald-950/90 px-3 py-2.5 text-[11px] text-emerald-200 shadow-xl max-sm:right-4 max-sm:bottom-4 max-sm:left-4">
      <Check className="size-3.5" />
      <AlertTitle className="text-[11px] font-normal text-inherit">
        {message}
      </AlertTitle>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        onClick={onClose}
        aria-label="Dismiss"
        className="ml-2 text-inherit"
      >
        <X className="size-3.5" />
      </Button>
    </Alert>
  )
}
