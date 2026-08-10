export type Project = {
    id: string
    name: string
    repo: string
    framework: string
    branch: string
    status: "Production" | "Preview" | "Failed"
    updated: string
    url: string
}
export type Deployment = {
    id: string
    project: string
    status: "Ready" | "Building" | "Failed" | "Queued" | "Cancelled"
    branch: string
    commit: string
    message: string
    environment: "Production" | "Preview" | "Development"
    duration: string
    created: string
}

export const projects: Project[] = [
    {
        id: "atlas-console",
        name: "atlas-console",
        repo: "acme/atlas-console",
        framework: "Next.js",
        branch: "main",
        status: "Production",
        updated: "12 min ago",
        url: "atlas-console.forge.run",
    },
    {
        id: "signal-api",
        name: "signal-api",
        repo: "acme/signal-api",
        framework: "Node.js",
        branch: "release",
        status: "Production",
        updated: "34 min ago",
        url: "signal-api.forge.run",
    },
    {
        id: "northstar-web",
        name: "northstar-web",
        repo: "acme/northstar-web",
        framework: "Astro",
        branch: "main",
        status: "Preview",
        updated: "2 hours ago",
        url: "northstar-web.forge.run",
    },
    {
        id: "forge-docs",
        name: "forge-docs",
        repo: "acme/forge-docs",
        framework: "Next.js",
        branch: "main",
        status: "Production",
        updated: "Yesterday",
        url: "docs.forge.run",
    },
]

export const deployments: Deployment[] = [
    {
        id: "dpl_8f3a21c",
        project: "atlas-console",
        status: "Ready",
        branch: "main",
        commit: "8f3a21c",
        message: "Improve workspace navigation",
        environment: "Production",
        duration: "42s",
        created: "12 min ago",
    },
    {
        id: "dpl_71e2bd0",
        project: "signal-api",
        status: "Ready",
        branch: "release",
        commit: "71e2bd0",
        message: "Add rate limit headers",
        environment: "Production",
        duration: "31s",
        created: "34 min ago",
    },
    {
        id: "dpl_0ad93f4",
        project: "northstar-web",
        status: "Building",
        branch: "feature/hero",
        commit: "0ad93f4",
        message: "Refresh launch page",
        environment: "Preview",
        duration: "—",
        created: "2 hours ago",
    },
    {
        id: "dpl_23c1e88",
        project: "forge-docs",
        status: "Failed",
        branch: "main",
        commit: "23c1e88",
        message: "Update API reference",
        environment: "Production",
        duration: "1m 04s",
        created: "Yesterday",
    },
]

export const logs = [
    "Installing dependencies...",
    "Resolved 428 packages in 1.8s",
    "Building application...",
    "Compiling 146 modules",
    "Optimizing assets...",
    "Uploading build artifacts...",
    "Starting deployment...",
    "Deployment ready.",
]
export const domains = [
    {
        domain: "atlas.acme.co",
        project: "atlas-console",
        environment: "Production",
        status: "Configured",
        ssl: "Active",
        created: "Aug 01, 2026",
    },
    {
        domain: "preview.acme.co",
        project: "northstar-web",
        environment: "Preview",
        status: "Verifying",
        ssl: "Pending",
        created: "Aug 07, 2026",
    },
]
export const envVars = [
    {
        name: "NEXT_PUBLIC_API_URL",
        value: "https://api.acme.co",
        environment: "Production",
        updated: "2 days ago",
    },
    {
        name: "DATABASE_URL",
        value: "postgres://forge...",
        environment: "Production",
        updated: "5 days ago",
    },
    {
        name: "ENABLE_ANALYTICS",
        value: "true",
        environment: "Preview",
        updated: "Aug 01, 2026",
    },
]
export const notifications = [
    "Deployment atlas-console succeeded",
    "Build warning in northstar-web",
    "Domain atlas.acme.co verified",
    "Project forge-docs created",
]

export function getProject(id: string) {
    return projects.find((project) => project.id === id) ?? projects[0]
}
export function getDeployment(id: string) {
    return (
        deployments.find((deployment) => deployment.id === id) ?? deployments[0]
    )
}

export const navItems = [
    "Overview",
    "Projects",
    "Deployments",
    "Domains",
    "Environments",
    "Settings",
]
export const projectTabs = [
    "Overview",
    "Deployments",
    "Logs",
    "Domains",
    "Environment Variables",
    "Resources",
    "Settings",
]
