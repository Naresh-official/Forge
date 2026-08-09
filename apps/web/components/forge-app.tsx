"use client"

import { useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  Bell,
  Box,
  Check,
  ChevronDown,
  CircleDot,
  Copy,
  ExternalLink,
  GitBranch,
  Globe2,
  LayoutDashboard,
  LifeBuoy,
  Menu,
  MoreHorizontal,
  Plus,
  Rocket,
  Search,
  Server,
  Settings2,
  Sparkles,
  Terminal,
  Trash2,
  X,
} from "lucide-react"
import {
  deployments,
  domains,
  envVars,
  getDeployment,
  getProject,
  logs,
  navItems,
  notifications,
  projectTabs,
  projects,
  type Deployment,
  type Project,
} from "@/lib/forge-data"

function StatusBadge({ status }: { status: string }) {
  const good = [
    "Ready",
    "Production",
    "Configured",
    "Active",
    "Operational",
  ].includes(status)
  const warn = ["Building", "Preview", "Verifying", "Pending"].includes(status)
  return (
    <span className={`status-badge ${good ? "good" : warn ? "warn" : "bad"}`}>
      <span />
      {status}
    </span>
  )
}
function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      className="icon-button compact"
      aria-label="Copy"
      onClick={() => {
        navigator.clipboard?.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      }}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  )
}
function EmptyState({
  title,
  action,
  onAction,
}: {
  title: string
  action: string
  onAction?: () => void
}) {
  return (
    <div className="empty-state">
      <Box size={20} />
      <h3>{title}</h3>
      <p>There&apos;s nothing here yet.</p>
      {onAction && (
        <button className="primary-button" onClick={onAction}>
          <Plus size={14} />
          {action}
        </button>
      )}
    </div>
  )
}
function PageHeader({
  eyebrow,
  title,
  description,
  action,
  onAction,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: string
  onAction?: () => void
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="lede">{description}</p>}
      </div>
      {action && (
        <button className="primary-button" onClick={onAction}>
          <Plus size={15} />
          {action}
        </button>
      )}
    </div>
  )
}
function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="table-wrap">
      <table>{children}</table>
    </div>
  )
}

export default function ForgeApp() {
  const pathname = usePathname()
  const router = useRouter()
  const [theme, setTheme] = useState<"dark" | "light">("dark")
  const [searchOpen, setSearchOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [toast, setToast] = useState("")
  const [mobileNav, setMobileNav] = useState(false)
  const notify = (text: string) => {
    setToast(text)
    setTimeout(() => setToast(""), 2400)
  }
  const go = (href: string) => {
    setMobileNav(false)
    router.push(href)
  }
  const projectMatch = pathname.match(/^\/projects\/([^/]+)/)
  const project = projectMatch ? getProject(projectMatch[1]) : null
  const isPublic =
    pathname === "/" || pathname === "/login" || pathname === "/docs"
  if (pathname === "/login")
    return (
      <div className="public-center">
        <div className="login-card">
          <div className="brand-row centered">
            <div className="brand-mark">
              <Sparkles size={15} />
            </div>
            <span>forge</span>
          </div>
          <p className="eyebrow">Developer platform</p>
          <h1>Ship without friction.</h1>
          <p>Connect GitHub and deploy your next idea in seconds.</p>
          <button className="github-button" onClick={() => go("/dashboard")}>
            <GitBranch size={16} />
            Continue with GitHub
          </button>
          <small>
            GitHub is the only authentication provider supported by Forge.
          </small>
        </div>
      </div>
    )
  if (pathname === "/docs") return <Docs onNavigate={go} />
  return (
    <div className={theme === "light" ? "forge-shell light" : "forge-shell"}>
      {!isPublic && (
        <Sidebar
          pathname={pathname}
          onNavigate={go}
          mobile={mobileNav}
          onClose={() => setMobileNav(false)}
        />
      )}
      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumbs">
            <button className="mobile-menu" onClick={() => setMobileNav(true)}>
              <Menu size={17} />
            </button>
            <span>Acme Cloud</span>
            <span>/</span>
            <strong>{project?.name ?? routeTitle(pathname)}</strong>
          </div>
          <div className="top-actions">
            <button
              className="command-trigger"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={15} />
              <span>Search</span>
              <kbd>⌘ K</kbd>
            </button>
            <button
              className="icon-button"
              aria-label="Toggle theme"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <CircleDot size={17} />
            </button>
            <div className="notification-wrap">
              <button
                className="icon-button"
                aria-label="Notifications"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
              >
                <Bell size={17} />
                <span className="notification-dot" />
              </button>
              {notificationsOpen && (
                <div className="notification-popover">
                  <strong>Notifications</strong>
                  {notifications.map((item) => (
                    <p key={item}>
                      <span className="status-dot" />
                      {item}
                    </p>
                  ))}
                  <button
                    className="text-button"
                    onClick={() => notify("Notifications marked as read")}
                  >
                    Mark all as read
                  </button>
                </div>
              )}
            </div>
            <button
              className="avatar-button"
              onClick={() => go("/settings/profile")}
            >
              JD
            </button>
          </div>
        </header>
        <div className="content-wrap">
          {renderRoute(pathname, project?.id ?? "", go, notify)}
        </div>
      </main>
      {searchOpen && (
        <CommandPalette onClose={() => setSearchOpen(false)} onNavigate={go} />
      )}
      {toast && (
        <div className="toast">
          <Check size={15} />
          {toast}
          <button onClick={() => setToast("")} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

function Sidebar({
  pathname,
  onNavigate,
  mobile,
  onClose,
}: {
  pathname: string
  onNavigate: (href: string) => void
  mobile: boolean
  onClose: () => void
}) {
  return (
    <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
      <div className="brand-row">
        <div className="brand-mark">
          <Sparkles size={15} />
        </div>
        <span>forge</span>
        <span className="brand-version">cloud</span>
        <button className="mobile-close" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <button className="workspace-switcher">
        <span className="workspace-avatar">AC</span>
        <span className="workspace-copy">
          <strong>Acme Cloud</strong>
          <small>Personal workspace</small>
        </span>
        <ChevronDown size={14} />
      </button>
      <div className="sidebar-label">Workspace</div>
      <nav className="main-nav">
        {navItems.map((item) => (
          <button
            key={item}
            className={`nav-item ${pathname === `/${item.toLowerCase()}` || (item === "Overview" && pathname === "/dashboard") ? "active" : ""}`}
            onClick={() =>
              onNavigate(
                item === "Overview" ? "/dashboard" : `/${item.toLowerCase()}`
              )
            }
          >
            {item === "Overview" ? (
              <LayoutDashboard size={16} />
            ) : item === "Projects" ? (
              <Box size={16} />
            ) : item === "Deployments" ? (
              <Rocket size={16} />
            ) : item === "Domains" ? (
              <Globe2 size={16} />
            ) : item === "Environments" ? (
              <Server size={16} />
            ) : (
              <Settings2 size={16} />
            )}
            {item}
          </button>
        ))}
      </nav>
      <div className="sidebar-label project-label">
        Your projects{" "}
        <button
          onClick={() => onNavigate("/projects/new")}
          aria-label="Create project"
        >
          <Plus size={14} />
        </button>
      </div>
      <div className="project-nav">
        {projects.map((item) => (
          <button
            key={item.id}
            className="project-nav-item"
            onClick={() => onNavigate(`/projects/${item.id}`)}
          >
            <span className="project-dot" />
            {item.name}
          </button>
        ))}
      </div>
      <div className="sidebar-bottom">
        <button className="nav-item" onClick={() => onNavigate("/docs")}>
          <LifeBuoy size={16} />
          Documentation
        </button>
        <button className="nav-item" onClick={() => onNavigate("/settings")}>
          <Settings2 size={16} />
          Settings
        </button>
        <div className="profile-row">
          <div className="profile-avatar">JD</div>
          <span>
            <strong>Jordan Davis</strong>
            <small>jordan@acme.co</small>
          </span>
          <MoreHorizontal size={15} />
        </div>
      </div>
    </aside>
  )
}

function routeTitle(pathname: string) {
  if (pathname === "/dashboard") return "Overview"
  if (pathname === "/") return "Overview"
  return (
    pathname.split("/").filter(Boolean).pop()?.replaceAll("-", " ") ??
    "Overview"
  )
}

function renderRoute(
  pathname: string,
  projectId: string,
  go: (href: string) => void,
  notify: (text: string) => void
) {
  if (pathname === "/" || pathname === "/dashboard")
    return <Dashboard go={go} notify={notify} />
  if (pathname === "/projects") return <Projects go={go} />
  if (pathname === "/projects/new")
    return <NewProject go={go} notify={notify} />
  if (pathname === "/deployments") return <Deployments go={go} />
  if (pathname === "/domains") return <Domains go={go} notify={notify} />
  if (pathname === "/environments") return <Environments notify={notify} />
  if (pathname.startsWith("/settings"))
    return <SettingsPage pathname={pathname} notify={notify} />
  if (projectId)
    return (
      <ProjectWorkspace
        pathname={pathname}
        projectId={projectId}
        go={go}
        notify={notify}
      />
    )
  return (
    <EmptyState
      title="Page not found"
      action="Back to overview"
      onAction={() => go("/dashboard")}
    />
  )
}

function Dashboard({
  go,
  notify,
}: {
  go: (href: string) => void
  notify: (text: string) => void
}) {
  return (
    <>
      <PageHeader
        eyebrow="Friday, August 8, 2026"
        title="Good morning, Jordan"
        description="Here's what's happening across your workspace."
        action="New project"
        onAction={() => go("/projects/new")}
      />
      <section className="metric-grid">
        {[
          ["Active projects", "03"],
          ["Deployments", "128"],
          ["Success rate", "99.8%"],
          ["Avg. response", "184ms"],
        ].map(([label, value]) => (
          <article className="metric-card" key={label}>
            <div className="metric-top">
              <span>{label}</span>
              <Activity size={16} />
            </div>
            <div className="metric-value">{value}</div>
            <div className="metric-foot">
              <span className="positive">+18.4%</span> from last month
            </div>
          </article>
        ))}
      </section>
      <section className="dashboard-grid">
        <article className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <h2>Deployment activity</h2>
              <p>Successful builds over the last 30 days</p>
            </div>
            <button className="text-button" onClick={() => go("/deployments")}>
              View all <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="chart-area">
            <div className="chart-y">
              <span>40</span>
              <span>30</span>
              <span>20</span>
              <span>10</span>
              <span>0</span>
            </div>
            <div className="bar-chart">
              {[
                24, 31, 28, 34, 27, 35, 32, 38, 30, 34, 26, 39, 34, 36, 31, 37,
                35, 40, 34, 38, 32, 35, 39, 31, 36, 40, 35, 38, 34, 39,
              ].map((height, i) => (
                <div
                  key={i}
                  className="bar"
                  style={{ height: `${height * 2}px` }}
                >
                  <span />
                </div>
              ))}
            </div>
          </div>
        </article>
        <article className="panel status-panel">
          <div className="panel-heading">
            <div>
              <h2>System status</h2>
              <p>All systems operational</p>
            </div>
            <span className="live-indicator">
              <span />
              Live
            </span>
          </div>
          <div className="system-list">
            <div>
              <span className="system-icon cyan">
                <Globe2 size={15} />
              </span>
              <span>
                <strong>Edge network</strong>
                <small>Global availability</small>
              </span>
              <StatusBadge status="Operational" />
            </div>
            <div>
              <span className="system-icon violet">
                <Server size={15} />
              </span>
              <span>
                <strong>Build pipeline</strong>
                <small>CI/CD workers</small>
              </span>
              <StatusBadge status="Operational" />
            </div>
          </div>
          <button
            className="status-link"
            onClick={() => notify("Status page opened")}
          >
            View status page <ExternalLink size={13} />
          </button>
        </article>
      </section>
      <article className="panel projects-panel">
        <div className="panel-heading">
          <div>
            <h2>Recent projects</h2>
            <p>Your most recently updated environments</p>
          </div>
          <button className="outline-button" onClick={() => go("/projects")}>
            View projects
          </button>
        </div>
        <Table>
          <thead>
            <tr>
              <th>Project</th>
              <th>Framework</th>
              <th>Branch</th>
              <th>Status</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id} onClick={() => go(`/projects/${p.id}`)}>
                <td>
                  <div className="project-cell">
                    <span className="project-dot" />
                    <strong>{p.name}</strong>
                  </div>
                </td>
                <td>
                  <span className="framework-badge">{p.framework}</span>
                </td>
                <td>
                  <span className="branch">
                    <GitBranch size={14} />
                    {p.branch}
                  </span>
                </td>
                <td>
                  <StatusBadge status={p.status} />
                </td>
                <td className="muted-cell">{p.updated}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </article>
    </>
  )
}

function Projects({ go }: { go: (href: string) => void }) {
  const [query, setQuery] = useState("")
  const filtered = projects.filter((p) =>
    `${p.name} ${p.repo}`.toLowerCase().includes(query.toLowerCase())
  )
  return (
    <>
      <PageHeader
        title="Projects"
        description="Manage your applications and deployments."
        action="New project"
        onAction={() => go("/projects/new")}
      />
      <div className="toolbar">
        <div className="search-field">
          <Search size={15} />
          <input
            placeholder="Search projects"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button className="outline-button">
          Status <ChevronDown size={14} />
        </button>
        <button className="outline-button">
          Framework <ChevronDown size={14} />
        </button>
        <button className="outline-button">
          Sort <ChevronDown size={14} />
        </button>
      </div>
      <div className="project-grid">
        {filtered.map((p) => (
          <button
            className="project-card"
            key={p.id}
            onClick={() => go(`/projects/${p.id}`)}
          >
            <div className="project-card-top">
              <span className="project-dot" />
              <StatusBadge status={p.status} />
            </div>
            <h3>{p.name}</h3>
            <p>{p.repo}</p>
            <div className="project-meta">
              <span>
                <GitBranch size={13} />
                {p.branch}
              </span>
              <span>{p.framework}</span>
            </div>
            <div className="project-card-foot">
              <span>{p.url}</span>
              <span>{p.updated}</span>
            </div>
          </button>
        ))}
      </div>
    </>
  )
}

function NewProject({
  go,
  notify,
}: {
  go: (href: string) => void
  notify: (text: string) => void
}) {
  const [step, setStep] = useState(1)
  const [repo, setRepo] = useState("storefront")
  const [vars, setVars] = useState(2)
  return (
    <>
      <button className="back-link" onClick={() => go("/projects")}>
        <ArrowLeft size={14} />
        Projects
      </button>
      <PageHeader
        title="Create a project"
        description={`Step ${step} of 4 · ${["Import a repository", "Configure project", "Environment variables", "Deploy"][step - 1]}`}
      />
      <div className="wizard">
        <div className="wizard-steps">
          {["Repository", "Configure", "Variables", "Deploy"].map(
            (label, i) => (
              <button
                key={label}
                className={
                  step === i + 1 ? "active" : step > i + 1 ? "complete" : ""
                }
                onClick={() => i + 1 <= step && setStep(i + 1)}
              >
                <span>{step > i + 1 ? <Check size={13} /> : i + 1}</span>
                {label}
              </button>
            )
          )}
        </div>
        <div className="wizard-card">
          {step === 1 && (
            <>
              <div className="section-title">
                <GitBranch size={20} />
                <div>
                  <h2>Import a repository</h2>
                  <p>Choose a GitHub repository to deploy with Forge.</p>
                </div>
              </div>
              <div className="search-field full">
                <Search size={15} />
                <input placeholder="Search repositories" />
              </div>
              <div className="repo-list">
                {[
                  "storefront",
                  "forge-docs",
                  "api",
                  "dashboard",
                  "landing-page",
                ].map((name) => (
                  <button
                    key={name}
                    className={repo === name ? "repo-row selected" : "repo-row"}
                    onClick={() => setRepo(name)}
                  >
                    <span className="repo-avatar">{name[0].toUpperCase()}</span>
                    <span>
                      <strong>acme/{name}</strong>
                      <small>Updated 2 hours ago · main</small>
                    </span>
                    <span className="repo-visibility">Private</span>
                  </button>
                ))}
              </div>
              <div className="wizard-actions">
                <button className="primary-button" onClick={() => setStep(2)}>
                  Continue <ArrowUpRight size={14} />
                </button>
              </div>
            </>
          )}
          {step === 2 && <WizardConfigure onNext={() => setStep(3)} />}
          {step === 3 && (
            <WizardVariables
              vars={vars}
              setVars={setVars}
              onNext={() => setStep(4)}
            />
          )}
          {step === 4 && (
            <>
              <div className="section-title">
                <Rocket size={20} />
                <div>
                  <h2>Ready to deploy</h2>
                  <p>Review your configuration before creating the project.</p>
                </div>
              </div>
              <div className="summary-list">
                <div>
                  <span>Repository</span>
                  <strong>acme/{repo}</strong>
                </div>
                <div>
                  <span>Framework</span>
                  <strong>Next.js</strong>
                </div>
                <div>
                  <span>Branch</span>
                  <strong>main</strong>
                </div>
                <div>
                  <span>Environment variables</span>
                  <strong>{vars}</strong>
                </div>
              </div>
              <div className="wizard-actions">
                <button className="outline-button" onClick={() => setStep(3)}>
                  Back
                </button>
                <button
                  className="primary-button"
                  onClick={() => {
                    notify("Project created and deployment started")
                    go("/projects/atlas-console/deployments/dpl_8f3a21c")
                  }}
                >
                  Deploy project <Rocket size={14} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
function WizardConfigure({ onNext }: { onNext: () => void }) {
  return (
    <>
      <div className="section-title">
        <Settings2 size={20} />
        <div>
          <h2>Configure project</h2>
          <p>Forge detected sensible defaults for your repository.</p>
        </div>
      </div>
      <div className="form-grid">
        {[
          ["Project name", "storefront"],
          ["Framework", "Next.js"],
          ["Root directory", "./"],
          ["Build command", "pnpm build"],
          ["Install command", "pnpm install"],
          ["Output directory", ".next"],
        ].map(([label, value]) => (
          <label key={label}>
            {label}
            <input defaultValue={value} />
          </label>
        ))}
      </div>
      <div className="wizard-actions">
        <button className="primary-button" onClick={onNext}>
          Continue <ArrowUpRight size={14} />
        </button>
      </div>
    </>
  )
}
function WizardVariables({
  vars,
  setVars,
  onNext,
}: {
  vars: number
  setVars: (value: number) => void
  onNext: () => void
}) {
  return (
    <>
      <div className="section-title">
        <ShieldCheckIcon />
        <div>
          <h2>Environment variables</h2>
          <p>Add secrets and configuration for your deployment.</p>
        </div>
      </div>
      <div className="env-editor">
        <div>
          <code>NEXT_PUBLIC_API_URL</code>
          <span>••••••••••••••</span>
          <button onClick={() => setVars(vars + 1)}>
            <Plus size={14} />
            Add variable
          </button>
        </div>
        <div>
          <code>DATABASE_URL</code>
          <span>••••••••••••••</span>
          <button
            aria-label="Delete variable"
            onClick={() => setVars(Math.max(0, vars - 1))}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className="wizard-actions">
        <button className="primary-button" onClick={onNext}>
          Continue <ArrowUpRight size={14} />
        </button>
      </div>
    </>
  )
}
function ShieldCheckIcon() {
  return (
    <span className="section-icon">
      <Check size={16} />
    </span>
  )
}

function Deployments({ go }: { go: (href: string) => void }) {
  return (
    <>
      <PageHeader
        title="Deployments"
        description="Every build, preview, and production release across your projects."
      />
      <div className="toolbar">
        <div className="search-field">
          <Search size={15} />
          <input placeholder="Search deployments" />
        </div>
        <button className="outline-button">
          Project <ChevronDown size={14} />
        </button>
        <button className="outline-button">
          Environment <ChevronDown size={14} />
        </button>
        <button className="outline-button">
          Status <ChevronDown size={14} />
        </button>
      </div>
      <DeploymentTable
        onSelect={(d) => go(`/projects/${d.project}/deployments/${d.id}`)}
      />
    </>
  )
}
function DeploymentTable({
  onSelect,
}: {
  onSelect: (deployment: Deployment) => void
}) {
  return (
    <Table>
      <thead>
        <tr>
          <th>Status</th>
          <th>Deployment</th>
          <th>Project</th>
          <th>Branch</th>
          <th>Commit</th>
          <th>Environment</th>
          <th>Duration</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
        {deployments.map((d) => (
          <tr key={d.id} onClick={() => onSelect(d)}>
            <td>
              <StatusBadge status={d.status} />
            </td>
            <td>
              <strong>{d.id}</strong>
              <small className="table-sub">{d.message}</small>
            </td>
            <td>{d.project}</td>
            <td>
              <span className="branch">
                <GitBranch size={13} />
                {d.branch}
              </span>
            </td>
            <td>
              <code>{d.commit}</code>
            </td>
            <td>{d.environment}</td>
            <td>{d.duration}</td>
            <td className="muted-cell">{d.created}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}

function ProjectWorkspace({
  pathname,
  projectId,
  go,
  notify,
}: {
  pathname: string
  projectId: string
  go: (href: string) => void
  notify: (text: string) => void
}) {
  const project = getProject(projectId)
  const deploymentId = pathname.split("/deployments/")[1]
  if (deploymentId)
    return (
      <DeploymentDetail
        project={project}
        deployment={getDeployment(deploymentId)}
        notify={notify}
      />
    )
  const tab =
    pathname.split("/").pop() === projectId
      ? "Overview"
      : (pathname.split("/").pop()?.replaceAll("-", " ") ?? "Overview")
  if (pathname.endsWith("/deployments"))
    return (
      <>
        <ProjectHeader project={project} go={go} />
        <PageHeader
          title="Deployments"
          description="Deployment history for this project."
          action="Deploy"
          onAction={() => notify("Deployment started")}
        />
        <DeploymentTable
          onSelect={(d) => go(`/projects/${project.id}/deployments/${d.id}`)}
        />
      </>
    )
  if (pathname.endsWith("/logs"))
    return (
      <>
        <ProjectHeader project={project} go={go} />
        <PageHeader
          title="Logs"
          description="Build and runtime logs for this project."
        />
        <LogViewer />
      </>
    )
  if (pathname.endsWith("/domains"))
    return (
      <>
        <ProjectHeader project={project} go={go} />
        <Domains projectId={project.id} go={go} notify={notify} />
      </>
    )
  if (pathname.endsWith("/environment-variables"))
    return (
      <>
        <ProjectHeader project={project} go={go} />
        <EnvironmentVariables />
      </>
    )
  if (pathname.endsWith("/resources"))
    return (
      <>
        <ProjectHeader project={project} go={go} />
        <Resources />
      </>
    )
  if (pathname.endsWith("/settings"))
    return (
      <>
        <ProjectHeader project={project} go={go} />
        <SettingsPage pathname={pathname} notify={notify} />
      </>
    )
  return (
    <>
      <ProjectHeader project={project} go={go} />
      <PageHeader
        title="Project overview"
        description="A calm view of what is running in production."
        action="Deploy"
        onAction={() => notify("Deployment started")}
      />
      <section className="dashboard-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <h2>Production deployment</h2>
              <p>{deployments[0].message}</p>
            </div>
            <StatusBadge status="Ready" />
          </div>
          <div className="info-grid">
            <div>
              <span>Deployment</span>
              <strong>{deployments[0].id}</strong>
            </div>
            <div>
              <span>Commit</span>
              <strong>{deployments[0].commit}</strong>
            </div>
            <div>
              <span>Branch</span>
              <strong>main</strong>
            </div>
            <div>
              <span>Build duration</span>
              <strong>42s</strong>
            </div>
          </div>
          <div className="button-row">
            <button
              className="outline-button"
              onClick={() => notify("Opening deployment")}
            >
              Visit <ExternalLink size={14} />
            </button>
            <button
              className="outline-button"
              onClick={() => notify("Redeploy started")}
            >
              Redeploy
            </button>
            <button
              className="outline-button"
              onClick={() => notify("Rollback successful")}
            >
              Rollback
            </button>
          </div>
        </article>
        <Resources compact />
      </section>
      <article className="panel">
        <div className="panel-heading">
          <div>
            <h2>Latest deployments</h2>
            <p>Recent activity for {project.name}</p>
          </div>
          <button
            className="text-button"
            onClick={() => go(`/projects/${project.id}/deployments`)}
          >
            View all <ArrowUpRight size={14} />
          </button>
        </div>
        <DeploymentTable
          onSelect={(d) => go(`/projects/${project.id}/deployments/${d.id}`)}
        />
      </article>
    </>
  )
}
function ProjectHeader({
  project,
  go,
}: {
  project: Project
  go: (href: string) => void
}) {
  return (
    <div className="project-header">
      <div>
        <button className="back-link" onClick={() => go("/projects")}>
          <ArrowLeft size={14} />
          Projects
        </button>
        <div className="project-title">
          <span className="project-dot" />
          <h1>{project.name}</h1>
          <StatusBadge status={project.status} />
        </div>
        <p>
          {project.repo} · <a href={`https://${project.url}`}>{project.url}</a>
        </p>
      </div>
      <div className="button-row">
        <button className="primary-button">
          Deploy <Rocket size={14} />
        </button>
        <button
          className="outline-button"
          onClick={() => go(`/projects/${project.id}/settings`)}
        >
          Settings
        </button>
      </div>
      <nav className="project-tabs">
        {projectTabs.map((tab) => (
          <button
            key={tab}
            className="project-tab"
            onClick={() =>
              go(
                `/projects/${project.id}/${tab === "Overview" ? "" : tab.toLowerCase().replaceAll(" ", "-")}`
              )
            }
          >
            {tab}
          </button>
        ))}
      </nav>
    </div>
  )
}
function DeploymentDetail({
  project,
  deployment,
  notify,
}: {
  project: Project
  deployment: Deployment
  notify: (text: string) => void
}) {
  return (
    <>
      <button className="back-link" onClick={() => history.back()}>
        <ArrowLeft size={14} />
        {project.name} deployments
      </button>
      <PageHeader
        eyebrow={deployment.id}
        title="Production deployment"
        description={`${deployment.message} · ${deployment.created}`}
      />
      <div className="button-row detail-actions">
        <StatusBadge status={deployment.status} />
        <button
          className="outline-button"
          onClick={() => notify("Opening deployment")}
        >
          Visit <ExternalLink size={14} />
        </button>
        <button
          className="outline-button"
          onClick={() => notify("Redeploy started")}
        >
          Redeploy
        </button>
        <button
          className="outline-button"
          onClick={() => notify("Rollback successful")}
        >
          Rollback
        </button>
      </div>
      <article className="panel timeline-panel">
        <div className="panel-heading">
          <div>
            <h2>Deployment timeline</h2>
            <p>Build pipeline events</p>
          </div>
        </div>
        <div className="deploy-timeline">
          {["Queued", "Building", "Uploading", "Deploying", "Ready"].map(
            (stage, i) => (
              <div
                className={i === 4 ? "deploy-stage current" : "deploy-stage"}
                key={stage}
              >
                <span>
                  {i < 4 ? <Check size={13} /> : <Rocket size={13} />}
                </span>
                <strong>{stage}</strong>
                <small>
                  {i < 4 ? `${[2, 31, 6, 3][i]}s · completed` : "Ready now"}
                </small>
              </div>
            )
          )}
        </div>
      </article>
      <div className="dashboard-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <h2>Deployment information</h2>
              <p>Runtime and source details</p>
            </div>
          </div>
          <div className="info-grid">
            <div>
              <span>Project</span>
              <strong>{project.name}</strong>
            </div>
            <div>
              <span>Environment</span>
              <strong>{deployment.environment}</strong>
            </div>
            <div>
              <span>Commit SHA</span>
              <strong>{deployment.commit}</strong>
            </div>
            <div>
              <span>Region</span>
              <strong>iad1 · Washington, DC</strong>
            </div>
            <div>
              <span>Runtime</span>
              <strong>Node.js 22</strong>
            </div>
            <div>
              <span>Author</span>
              <strong>Jordan Davis</strong>
            </div>
          </div>
        </article>
        <LogViewer />
      </div>
    </>
  )
}
function LogViewer() {
  return (
    <article className="panel log-panel">
      <div className="panel-heading">
        <div>
          <h2>Build logs</h2>
          <p>Live deployment output</p>
        </div>
        <div className="button-row">
          <button className="icon-button compact" aria-label="Copy logs">
            <Copy size={14} />
          </button>
          <button className="outline-button">Pause</button>
        </div>
      </div>
      <div className="log-viewer">
        {logs.map((line, i) => (
          <div key={line}>
            <span>{String(i + 1).padStart(3, "0")}</span>
            <time>
              12:4{i}:0{i}
            </time>
            <code className={line.includes("ready") ? "log-success" : ""}>
              {line}
            </code>
          </div>
        ))}
      </div>
    </article>
  )
}

function Domains({
  projectId,
  go,
  notify,
}: {
  projectId?: string
  go: (href: string) => void
  notify: (text: string) => void
}) {
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
      <Table>
        <thead>
          <tr>
            <th>Domain</th>
            <th>Project</th>
            <th>Environment</th>
            <th>Status</th>
            <th>SSL</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {list.map((d) => (
            <tr key={d.domain}>
              <td>
                <strong>{d.domain}</strong>
              </td>
              <td>{d.project}</td>
              <td>{d.environment}</td>
              <td>
                <StatusBadge status={d.status} />
              </td>
              <td>
                <StatusBadge status={d.ssl} />
              </td>
              <td className="muted-cell">{d.created}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      {!list.length && (
        <EmptyState
          title="No custom domains."
          action="Add a domain"
          onAction={() => notify("Add domain dialog opened")}
        />
      )}
    </>
  )
}
function EnvironmentVariables() {
  const [visible, setVisible] = useState<string[]>([])
  return (
    <>
      <PageHeader
        title="Environment variables"
        description="Secrets and configuration scoped to each environment."
        action="Add variable"
      />
      <div className="tabs">
        <button className="active">Production</button>
        <button>Preview</button>
        <button>Development</button>
      </div>
      <Table>
        <thead>
          <tr>
            <th>Variable</th>
            <th>Value</th>
            <th>Environment</th>
            <th>Updated</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {envVars.map((v) => (
            <tr key={v.name}>
              <td>
                <code>{v.name}</code>
              </td>
              <td>
                <span className="masked">
                  {visible.includes(v.name) ? v.value : "••••••••••••••"}
                </span>
                <button
                  className="text-button"
                  onClick={() =>
                    setVisible((current) =>
                      current.includes(v.name)
                        ? current.filter((name) => name !== v.name)
                        : [...current, v.name]
                    )
                  }
                >
                  {visible.includes(v.name) ? "Hide" : "Reveal"}
                </button>
              </td>
              <td>{v.environment}</td>
              <td className="muted-cell">{v.updated}</td>
              <td>
                <CopyButton value={v.value} />
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  )
}
function Resources({ compact = false }: { compact?: boolean }) {
  return (
    <article className="panel resources-panel">
      <div className="panel-heading">
        <div>
          <h2>{compact ? "Resource overview" : "Resources"}</h2>
          <p>Current allocation and usage</p>
        </div>
      </div>
      <div className="resource-grid">
        {[
          ["CPU", "42%", "2 vCPU"],
          ["Memory", "1.8 GB", "of 4 GB"],
          ["Network", "842 GB", "this month"],
          ["Requests", "2.4M", "this month"],
        ].map(([label, value, meta]) => (
          <div className="resource-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{meta}</small>
            <div className="resource-bar">
              <span
                style={{
                  width:
                    label === "CPU"
                      ? "42%"
                      : label === "Memory"
                        ? "46%"
                        : "70%",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}
function Environments({ notify }: { notify: (text: string) => void }) {
  return (
    <>
      <PageHeader
        title="Environments"
        description="Production, preview, and development targets."
        action="Create environment"
        onAction={() => notify("Environment dialog opened")}
      />
      <div className="environment-grid">
        {["Production", "Preview", "Development"].map((name) => (
          <article className="panel environment-card" key={name}>
            <div className="panel-heading">
              <div>
                <h2>{name}</h2>
                <p>
                  {name === "Production"
                    ? "atlas-console.forge.run"
                    : `*.${name.toLowerCase()}.forge.run`}
                </p>
              </div>
              <StatusBadge status="Operational" />
            </div>
            <div className="info-grid">
              <div>
                <span>Latest deployment</span>
                <strong>{deployments[0].id}</strong>
              </div>
              <div>
                <span>Last deployed</span>
                <strong>12 min ago</strong>
              </div>
              <div>
                <span>Resources</span>
                <strong>2 vCPU · 4 GB</strong>
              </div>
            </div>
            <div className="button-row">
              <button
                className="outline-button"
                onClick={() => notify(`${name} settings opened`)}
              >
                Manage
              </button>
              <button className="icon-button compact" aria-label="More options">
                <MoreHorizontal size={14} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  )
}
function SettingsPage({
  pathname,
  notify,
}: {
  pathname: string
  notify: (text: string) => void
}) {
  const section = pathname.split("/").pop()
  return (
    <>
      <PageHeader
        title={
          section && section !== "settings"
            ? section.replaceAll("-", " ")
            : "Settings"
        }
        description="Manage your Forge account and workspace preferences."
      />
      <div className="settings-layout">
        <nav className="settings-nav">
          {["Profile", "Preferences", "Notifications"].map((item) => (
            <button
              className={section === item.toLowerCase() ? "active" : ""}
              key={item}
              onClick={() =>
                history.pushState({}, "", `/settings/${item.toLowerCase()}`)
              }
            >
              {item}
            </button>
          ))}
        </nav>
        <article className="panel settings-card">
          {section === "profile" ? (
            <>
              <div className="settings-profile">
                <div className="profile-avatar large">JD</div>
                <div>
                  <h2>Jordan Davis</h2>
                  <p>@jordandavis · GitHub connected</p>
                </div>
                <StatusBadge status="Connected" />
              </div>
              <div className="form-grid">
                <label>
                  Display name
                  <input defaultValue="Jordan Davis" />
                </label>
                <label>
                  GitHub username
                  <input defaultValue="jordandavis" />
                </label>
              </div>
            </>
          ) : section === "notifications" ? (
            <>
              <h2>Notifications</h2>
              <p className="muted-copy">
                Choose which events should notify you.
              </p>
              {[
                "Deployment success",
                "Deployment failure",
                "Build failure",
                "Domain problems",
              ].map((item) => (
                <label className="switch-row" key={item}>
                  <span>
                    <strong>{item}</strong>
                    <small>Receive updates about {item.toLowerCase()}.</small>
                  </span>
                  <input type="checkbox" defaultChecked />
                </label>
              ))}
            </>
          ) : (
            <>
              <h2>Preferences</h2>
              <p className="muted-copy">Customize your Forge workspace.</p>
              <label className="switch-row">
                <span>
                  <strong>Compact mode</strong>
                  <small>Reduce spacing in dense tables and navigation.</small>
                </span>
                <input type="checkbox" />
              </label>
              <label>
                Theme
                <select defaultValue="System">
                  <option>System</option>
                  <option>Dark</option>
                  <option>Light</option>
                </select>
              </label>
            </>
          )}
        </article>
      </div>
    </>
  )
}
function CommandPalette({
  onClose,
  onNavigate,
}: {
  onClose: () => void
  onNavigate: (href: string) => void
}) {
  return (
    <div className="command-overlay" onClick={onClose}>
      <div className="command-modal" onClick={(e) => e.stopPropagation()}>
        <div className="command-input">
          <Search size={17} />
          <input
            autoFocus
            placeholder="Search projects, deployments, settings..."
          />
          <kbd>ESC</kbd>
        </div>
        <div className="command-section">
          <span>Navigate</span>
          {[
            ["Projects", "/projects"],
            ["Deployments", "/deployments"],
            ["Domains", "/domains"],
            ["Documentation", "/docs"],
            ["Settings", "/settings"],
          ].map(([label, href]) => (
            <button
              key={href}
              onClick={() => {
                onClose()
                onNavigate(href)
              }}
            >
              <ArrowUpRight size={15} />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
function Docs({ onNavigate }: { onNavigate: (href: string) => void }) {
  return (
    <div className="docs-shell">
      <header className="docs-topbar">
        <button className="brand-row" onClick={() => onNavigate("/")}>
          <span className="brand-mark">
            <Sparkles size={15} />
          </span>
          <strong>forge</strong>
          <span>docs</span>
        </button>
        <div className="search-field">
          <Search size={15} />
          <input placeholder="Search documentation" />
        </div>
        <button className="outline-button" onClick={() => onNavigate("/login")}>
          Sign in
        </button>
      </header>
      <div className="docs-layout">
        <aside className="docs-sidebar">
          <strong>Getting started</strong>
          {[
            "Introduction",
            "Quickstart",
            "Creating a project",
            "Deploying",
          ].map((item) => (
            <button key={item}>{item}</button>
          ))}
          <strong>Projects</strong>
          {["Configuration", "Environment variables", "Domains"].map((item) => (
            <button key={item}>{item}</button>
          ))}
          <strong>Deployments</strong>
          {[
            "Deployments",
            "Preview deployments",
            "Production deployments",
            "Rollbacks",
          ].map((item) => (
            <button key={item}>{item}</button>
          ))}
        </aside>
        <main className="docs-content">
          <p className="eyebrow">Getting started</p>
          <h1>Build. Deploy. Ship.</h1>
          <p className="docs-lede">
            Forge gives every project a fast, reliable path from GitHub commit
            to production.
          </p>
          <div className="code-block">
            <div>
              <span>Terminal</span>
              <CopyButton value="pnpm create forge-app" />
            </div>
            <code>
              $ pnpm create forge-app
              <br />$ cd my-project
              <br />$ forge deploy
            </code>
          </div>
          <h2>How Forge works</h2>
          <div className="docs-steps">
            {[
              [
                "01",
                "Connect GitHub",
                "Choose a repository and import it into Forge.",
              ],
              [
                "02",
                "Configure your project",
                "Set your framework, build settings, and secrets.",
              ],
              [
                "03",
                "Deploy",
                "Every push creates a preview. Merge to ship production.",
              ],
            ].map(([number, title, text]) => (
              <article key={number}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </main>
        <aside className="docs-toc">
          <strong>On this page</strong>
          <a>Introduction</a>
          <a>How Forge works</a>
          <a>Next steps</a>
        </aside>
      </div>
    </div>
  )
}
