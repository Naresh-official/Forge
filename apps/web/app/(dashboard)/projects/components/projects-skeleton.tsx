import { Card } from "@forge/ui/components/card"
import { Skeleton } from "@forge/ui/components/skeleton"

/** Placeholder grid shown while the project list loads. */
export function ProjectsSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="gap-2 p-[17px]">
          <div className="flex items-center justify-between">
            <Skeleton className="size-4" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <Skeleton className="mt-4 h-5 w-3/4" />
          <Skeleton className="mt-2 mb-5 h-4 w-1/2" />
          <div className="flex items-center justify-between border-t border-border pt-3">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-14" />
          </div>
          <div className="mt-4 flex justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-12" />
          </div>
        </Card>
      ))}
    </div>
  )
}
