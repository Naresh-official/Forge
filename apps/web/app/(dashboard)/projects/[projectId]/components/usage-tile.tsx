import { Progress } from "@forge/ui/components/progress"

/** One live metric: the percentage of what the workload was granted. */
export function UsageTile({
  label,
  percent,
  detail,
  progress,
}: {
  label: string
  percent: string
  detail: string
  progress?: number | null
}) {
  return (
    <div className="rounded-md border border-border p-3">
      <span className="text-[9px] text-muted-foreground">{label}</span>
      <strong className="mt-2 block font-mono text-lg">{percent}</strong>
      <small className="mt-1 block text-[9px] text-muted-foreground">
        {detail}
      </small>
      {progress !== null && progress !== undefined && (
        <Progress
          value={Math.min(100, Math.max(0, progress))}
          className="mt-2 block"
        />
      )}
    </div>
  )
}
