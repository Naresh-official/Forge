import { AlertCircle, RefreshCw } from "lucide-react"
import { Alert, AlertTitle } from "@forge/ui/components/alert"
import { Button } from "@forge/ui/components/button"
import { cn } from "@forge/ui/lib/utils"

/**
 * One-line destructive notice with an optional retry. Used by every data view,
 * so it lives here instead of being redefined per file.
 */
export function InlineError({
  message,
  onRetry,
  className,
}: {
  message: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <Alert
      variant="destructive"
      className={cn(
        "mt-3 flex items-center gap-2 rounded-md border-rose-500/20 bg-rose-500/5 px-3 py-2.5 text-[11px] text-rose-300",
        className
      )}
    >
      <AlertCircle className="size-3.5 shrink-0" />
      <AlertTitle className="flex-1 text-[11px] font-normal text-inherit">
        {message}
      </AlertTitle>
      {onRetry && (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={onRetry}
          className="shrink-0 gap-1 text-rose-200 hover:bg-transparent hover:text-rose-100"
        >
          <RefreshCw className="size-3" />
          Retry
        </Button>
      )}
    </Alert>
  )
}
