import { Check, X } from "lucide-react"
import { Alert, AlertTitle } from "@forge/ui/components/alert"
import { Button } from "@forge/ui/components/button"
import { cn } from "@forge/ui/lib/utils"

/** Floating confirmation message rendered by the toast provider. */
export function Toast({
  message,
  onClose,
  className,
}: {
  message: string
  onClose: () => void
  className?: string
}) {
  return (
    <Alert
      className={cn(
        "fixed right-6 bottom-6 z-50 flex w-fit items-center gap-2 rounded-md border-emerald-900 bg-emerald-950/90 px-3 py-2.5 text-[11px] text-emerald-200 shadow-xl max-sm:right-4 max-sm:bottom-4 max-sm:left-4",
        className
      )}
    >
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
