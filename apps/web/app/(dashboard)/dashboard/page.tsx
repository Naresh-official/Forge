import { auth } from "@/auth"
import { PageHeader } from "../_components/page-header"
import { DashboardMetrics } from "./components/dashboard-metrics"
import { DashboardView } from "./components/dashboard-view"

export default async function DashboardPage() {
  const session = await auth()
  const firstName = session?.user?.name?.trim().split(/\s+/)[0]

  return (
    <>
      <PageHeader
        eyebrow={new Date().toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
        title={`Good morning${firstName ? `, ${firstName}` : ""}`}
        description="Here's what's happening across your workspace."
        action="New project"
        actionHref="/projects/new"
      />
      <DashboardMetrics />
      <DashboardView />
    </>
  )
}
