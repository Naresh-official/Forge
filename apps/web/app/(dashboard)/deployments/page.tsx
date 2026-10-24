import { PageHeader } from "../_components/page-header"
import { DeploymentsView } from "./components/deployments-view"

export default function DeploymentsPage() {
  return (
    <>
      <PageHeader
        title="Deployments"
        description="Every build, preview, and production release across your projects — the 50 most recent."
      />
      <DeploymentsView />
    </>
  )
}
