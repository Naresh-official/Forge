"use client"

import { useQuery } from "@tanstack/react-query"
import { listProjects } from "@forge/api-client/project"
import { ProjectsView } from "./components/projects-view"

export default function ProjectsPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["projects"],
    queryFn: listProjects,
  })

  return (
    <ProjectsView
      projects={data?.data ?? []}
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={() => refetch()}
    />
  )
}
