"use client"

import { Check, Copy, Plus, X } from "lucide-react"
import { useState } from "react"

export function StatusBadge({ status }: { status: string }) {
    const good = [
        "Ready",
        "Production",
        "Configured",
        "Active",
        "Operational",
        "Connected",
    ].includes(status)
    const warn = ["Building", "Preview", "Verifying", "Pending"].includes(
        status
    )

    return (
        <span
            className={[
                "inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-1 text-sm whitespace-nowrap",
                good
                    ? "text-emerald-400"
                    : warn
                      ? "text-amber-400"
                      : "text-rose-400",
            ].join(" ")}
        >
            <span
                className={[
                    "size-1.5 rounded-full",
                    good
                        ? "bg-emerald-400"
                        : warn
                          ? "bg-amber-400"
                          : "bg-rose-400",
                ].join(" ")}
            />
            {status}
        </span>
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
                    <p className="mt-2 text-xs text-muted-foreground">
                        {description}
                    </p>
                )}
            </div>
            {action && (
                <button
                    type="button"
                    onClick={onAction}
                    className="inline-flex items-center gap-2 rounded-md border border-primary bg-primary px-3.5 py-2.5 text-[11px] font-bold text-primary-foreground shadow-sm hover:opacity-90 max-sm:w-full max-sm:justify-center"
                >
                    <Plus className="size-3.5" />
                    {action}
                </button>
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
        <div className="flex min-h-60 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border text-muted-foreground">
            <div className="rounded-md border border-border p-2">□</div>
            <h3 className="mt-1 text-sm text-foreground">{title}</h3>
            <p className="mb-2 text-sm">There&apos;s nothing here yet.</p>
            {action && onAction && (
                <button
                    type="button"
                    onClick={onAction}
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-[11px] font-semibold text-primary-foreground"
                >
                    <Plus className="size-3.5" />
                    {action}
                </button>
            )}
        </div>
    )
}

export function CopyButton({ value }: { value: string }) {
    const [copied, setCopied] = useState(false)

    return (
        <button
            type="button"
            aria-label="Copy"
            className="grid size-7 place-items-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground"
            onClick={async () => {
                await navigator.clipboard?.writeText(value)
                setCopied(true)
                setTimeout(() => setCopied(false), 1200)
            }}
        >
            {copied ? (
                <Check className="size-3.5" />
            ) : (
                <Copy className="size-3.5" />
            )}
        </button>
    )
}

export function DataTable({ children }: { children: React.ReactNode }) {
    return (
        <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[650px] border-collapse text-left">
                {children}
            </table>
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
        <div className="fixed right-6 bottom-6 z-50 flex items-center gap-2 rounded-md border border-emerald-900 bg-emerald-950/90 px-3 py-2.5 text-[11px] text-emerald-200 shadow-xl max-sm:right-4 max-sm:bottom-4 max-sm:left-4">
            <Check className="size-3.5" />
            {message}
            <button
                type="button"
                onClick={onClose}
                aria-label="Dismiss"
                className="ml-2"
            >
                <X className="size-3.5" />
            </button>
        </div>
    )
}
