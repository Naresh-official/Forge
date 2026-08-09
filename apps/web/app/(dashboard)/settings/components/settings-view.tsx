"use client"

import { useRouter } from "next/navigation"
import { StatusBadge } from "../../_components/ui"

const sections = ["profile", "preferences", "notifications"] as const

export function SettingsView({
  section,
}: {
  section: (typeof sections)[number]
}) {
  const router = useRouter()
  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-[-.045em] capitalize">
          {section}
        </h1>
        <p className="mt-2 text-xs text-muted-foreground">
          Manage your Forge account and workspace preferences.
        </p>
      </div>
      <div className="grid max-w-4xl grid-cols-[170px_minmax(0,650px)] gap-5 max-md:grid-cols-1">
        <nav className="flex flex-col gap-1 max-md:flex-row max-md:overflow-auto">
          {sections.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => router.push(`/settings/${item}`)}
              className={[
                "rounded-md px-3 py-2 text-left text-sm capitalize",
                section === item
                  ? "border border-border bg-card text-foreground"
                  : "text-muted-foreground hover:bg-accent",
              ].join(" ")}
            >
              {item}
            </button>
          ))}
        </nav>
        <article className="min-h-72 rounded-lg border border-border bg-card p-[18px]">
          {section === "profile" && <Profile />}
          {section === "preferences" && <Preferences />}
          {section === "notifications" && <Notifications />}
        </article>
      </div>
    </>
  )
}

function Profile() {
  return (
    <>
      <div className="mb-5 flex items-center gap-3 border-b border-border pb-5">
        <div className="grid size-11 place-items-center rounded-md bg-secondary text-sm font-bold text-primary">
          JD
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-semibold">Jordan Davis</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            @jordandavis · GitHub connected
          </p>
        </div>
        <StatusBadge status="Connected" />
      </div>
      <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
        {[
          ["Display name", "Jordan Davis"],
          ["GitHub username", "jordandavis"],
        ].map(([label, value]) => (
          <label
            key={label}
            className="flex flex-col gap-1.5 text-sm text-muted-foreground"
          >
            {label}
            <input
              defaultValue={value}
              className="rounded-md border border-border bg-background px-2.5 py-2 text-[11px] text-foreground outline-none"
            />
          </label>
        ))}
      </div>
    </>
  )
}

function Preferences() {
  return (
    <>
      <h2 className="text-sm font-semibold">Preferences</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Customize your Forge workspace.
      </p>
      <label className="mt-5 flex items-center justify-between border-t border-border py-4 text-sm">
        <span>
          <strong className="block text-[11px]">Compact mode</strong>
          <small className="text-muted-foreground">
            Reduce spacing in dense tables and navigation.
          </small>
        </span>
        <input type="checkbox" className="accent-primary" />
      </label>
      <label className="flex flex-col gap-1.5 text-sm text-muted-foreground">
        Theme
        <select
          defaultValue="System"
          className="rounded-md border border-border bg-background px-2.5 py-2 text-[11px] text-foreground"
        >
          <option>System</option>
          <option>Dark</option>
          <option>Light</option>
        </select>
      </label>
    </>
  )
}

function Notifications() {
  return (
    <>
      <h2 className="text-sm font-semibold">Notifications</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Choose which events should notify you.
      </p>
      {[
        "Deployment success",
        "Deployment failure",
        "Build failure",
        "Domain problems",
      ].map((item) => (
        <label
          key={item}
          className="flex items-center justify-between border-t border-border py-4 text-sm"
        >
          <span>
            <strong className="block text-[11px]">{item}</strong>
            <small className="text-muted-foreground">
              Receive updates about {item.toLowerCase()}.
            </small>
          </span>
          <input type="checkbox" defaultChecked className="accent-primary" />
        </label>
      ))}
    </>
  )
}
