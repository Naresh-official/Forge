/** Icon + title + description block at the top of each wizard step. */
export function StepTitle({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-primary">{icon}</span>
      <div>
        <h2 className="text-[15px] font-semibold">{title}</h2>
        <p className="mt-1 text-[11px] text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}
