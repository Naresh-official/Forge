/** One label/value pair in the "Ready to deploy" review. */
export function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[9px] text-muted-foreground">{label}</span>
      <strong className="truncate text-[11px] font-medium">{value}</strong>
    </div>
  )
}
