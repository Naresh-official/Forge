"use client"

import { domains } from "@/lib/forge-data"
import { useToast } from "../../_components/toast-provider"
import {
    DataTable,
    EmptyState,
    PageHeader,
    StatusBadge,
} from "../../_components/ui"

export function DomainsView({ projectId }: { projectId?: string }) {
    const { notify } = useToast()
    const list = projectId
        ? domains.filter((d) => d.project === projectId)
        : domains

    return (
        <>
            <PageHeader
                title="Domains"
                description="Manage custom domains and SSL certificates."
                action="Add domain"
                onAction={() => notify("Add domain dialog opened")}
            />
            {list.length ? (
                <DataTable>
                    <thead>
                        <tr className="text-[9px] tracking-widest text-muted-foreground uppercase">
                            {[
                                "Domain",
                                "Project",
                                "Environment",
                                "Status",
                                "SSL",
                                "Created",
                            ].map((h) => (
                                <th
                                    key={h}
                                    className="px-3 pb-2 text-left font-semibold"
                                >
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {list.map((d) => (
                            <tr
                                key={d.domain}
                                className="border-t border-border"
                            >
                                <td className="px-3 py-3 text-[11px] font-semibold">
                                    {d.domain}
                                </td>
                                <td className="px-3 py-3 text-[11px]">
                                    {d.project}
                                </td>
                                <td className="px-3 py-3 text-[11px]">
                                    {d.environment}
                                </td>
                                <td className="px-3 py-3">
                                    <StatusBadge status={d.status} />
                                </td>
                                <td className="px-3 py-3">
                                    <StatusBadge status={d.ssl} />
                                </td>
                                <td className="px-3 py-3 text-sm text-muted-foreground">
                                    {d.created}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </DataTable>
            ) : (
                <EmptyState
                    title="No custom domains."
                    action="Add a domain"
                    onAction={() => notify("Add domain dialog opened")}
                />
            )}
        </>
    )
}
