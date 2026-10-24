import { PageHeader } from "../_components/page-header"
import { ProjectsView } from "./components/projects-view"

export default function ProjectsPage() {
  return (
    <>
      <PageHeader
        title="Projects"
        description="Manage your applications and deployments."
        action="New project"
        actionHref="/projects/new"
      />
      <ProjectsView />
    </>
  )
}
