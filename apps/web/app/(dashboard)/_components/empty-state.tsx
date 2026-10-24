import { Plus } from "lucide-react"
import { Button } from "@forge/ui/components/button"
import { Card } from "@forge/ui/components/card"

/** Dashed placeholder for an empty collection. No client boundary of its own. */
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
