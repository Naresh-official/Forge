import { AlertCircle, RefreshCw } from "lucide-react"
import { Alert, AlertTitle } from "@forge/ui/components/alert"
import { Button } from "@forge/ui/components/button"

/** Full-card failure state for the project list. */
export function ProjectsErrorState({
  error,
  onRetry,
}: {
  error?: unknown
  onRetry?: () => void
}) {
  const errorMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Failed to load projects. Please try again."

  return (
    <Alert
      variant="destructive"
      className="flex min-h-60 flex-col items-center justify-center gap-3 border-rose-500/20 bg-rose-500/5 p-8 text-center text-rose-300"
    >
      <div className="rounded-full border border-rose-500/30 bg-rose-500/10 p-3 text-rose-400">
        <AlertCircle className="size-6" />
      </div>
      <div className="grid gap-1">
        <AlertTitle className="text-sm font-semibold text-foreground">
          Error loading projects
        </AlertTitle>
        <p className="text-xs text-muted-foreground">{errorMessage}</p>
      </div>
      {onRetry && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="mt-2 gap-1.5 text-xs"
        >
          <RefreshCw className="size-3.5" />
          Retry
        </Button>
      )}
    </Alert>
  )
}
