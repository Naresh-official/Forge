"use client"

import { useState } from "react"
import { getProject, envVars } from "@/lib/forge-data"
import { Button } from "@forge/ui/components/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@forge/ui/components/table"
import { Tabs, TabsList, TabsTrigger } from "@forge/ui/components/tabs"
import { CopyButton, PageHeader } from "../../../_components/ui"
import { ProjectHeader } from "./project-header"

const ENVIRONMENTS = ["Production", "Preview", "Development"] as const

export function ProjectEnvironmentVariables({
  projectId,
}: {
  projectId: string
}) {
  const project = getProject(projectId)
  const [visible, setVisible] = useState<string[]>([])
  if (!project) return <div>Project not found.</div>
  return (
    <>
      <ProjectHeader project={project} />
      <PageHeader
        title="Environment variables"
        description="Secrets and configuration scoped to each environment."
        action="Add variable"
      />
      <Tabs defaultValue="Production">
        <TabsList variant="line" className="mb-4 gap-1 border-b border-border">
          {ENVIRONMENTS.map((environment) => (
            <TabsTrigger
              key={environment}
              value={environment}
              className="px-3 py-2 text-sm"
            >
              {environment}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Table className="mt-4">
        <TableHeader>
          <TableRow>
            {["Variable", "Value", "Environment", "Updated", "Actions"].map(
              (h) => (
                <TableHead
                  key={h}
                  className="px-3 text-[9px] tracking-widest text-muted-foreground uppercase"
                >
                  {h}
                </TableHead>
              )
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {envVars.map((v) => (
            <TableRow key={v.name}>
              <TableCell className="px-3 py-3">
                <code className="text-sm text-primary">{v.name}</code>
              </TableCell>
              <TableCell className="px-3 py-3 font-mono text-sm text-muted-foreground">
                {visible.includes(v.name) ? v.value : "••••••••••••••"}{" "}
                <Button
                  type="button"
                  variant="link"
                  size="xs"
                  className="ml-2"
                  onClick={() =>
                    setVisible((cur) =>
                      cur.includes(v.name)
                        ? cur.filter((n) => n !== v.name)
                        : [...cur, v.name]
                    )
                  }
                >
                  {visible.includes(v.name) ? "Hide" : "Reveal"}
                </Button>
              </TableCell>
              <TableCell className="px-3 py-3 text-[11px]">
                {v.environment}
              </TableCell>
              <TableCell className="px-3 py-3 text-sm text-muted-foreground">
                {v.updated}
              </TableCell>
              <TableCell className="px-3 py-3">
                <CopyButton value={v.value} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  )
}
