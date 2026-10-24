import { GitBranch } from "lucide-react"
import type { ProjectDeploymentItem } from "@forge/types/project"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@forge/ui/components/table"
import {
  formatDeploymentDuration,
  formatRelativeTime,
} from "@/lib/deployment-format"
import { StatusBadge } from "../../../_components/status-badge"

const HEADINGS = [
  "Status",
  "Deployment",
  "Branch",
  "Commit",
  "Duration",
  "Created",
]

/** Deployment table used by the project overview and deployments tab. */
export function DeploymentRows({
  deployments,
  onSelect,
}: {
  deployments: ProjectDeploymentItem[]
  onSelect: (deployment: ProjectDeploymentItem) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {HEADINGS.map((heading) => (
            <TableHead
              key={heading}
              className="px-3 text-[9px] tracking-widest text-muted-foreground uppercase"
            >
              {heading}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {deployments.map((deployment) => (
          <TableRow
            key={deployment.id}
            tabIndex={0}
            onClick={() => onSelect(deployment)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                onSelect(deployment)
              }
            }}
            className="cursor-pointer focus-visible:bg-primary/[.035] focus-visible:outline-none"
          >
            <TableCell className="px-3 py-3">
              <StatusBadge status={deployment.status} />
            </TableCell>

            <TableCell className="px-3 py-3">
              <strong className="text-[11px]">
                #{deployment.deploymentNumber}
              </strong>
              <small className="mt-1 block max-w-64 truncate text-[9px] text-muted-foreground">
                {deployment.commitMessage || "No commit message"}
              </small>
            </TableCell>

            <TableCell className="px-3 py-3 font-mono text-sm text-muted-foreground">
              <GitBranch className="mr-1 inline size-3.5" />
              {deployment.branch}
            </TableCell>

            <TableCell className="px-3 py-3 font-mono text-sm text-primary">
              {deployment.commitSha.slice(0, 7)}
            </TableCell>

            <TableCell className="px-3 py-3 text-[11px]">
              {formatDeploymentDuration(deployment)}
            </TableCell>

            <TableCell className="px-3 py-3 text-sm text-muted-foreground">
              <span title={new Date(deployment.createdAt).toLocaleString()}>
                {formatRelativeTime(deployment.createdAt)}
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
