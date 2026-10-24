/** Label/value pair used across the project detail cards. */
export function Info({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[9px] text-muted-foreground">{label}</span>
      <strong className="text-[11px] font-medium">{children}</strong>
    </div>
  )
}
