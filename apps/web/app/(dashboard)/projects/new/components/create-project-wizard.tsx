"use client"

import { ArrowLeft, ArrowUpRight, Check, GitBranch, Rocket, Search, Settings2, Trash2, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useToast } from "../../../_components/toast-provider"

const repos = ["storefront", "forge-docs", "api", "dashboard", "landing-page"]

export function CreateProjectWizard() {
  const router = useRouter()
  const { notify } = useToast()
  const [step, setStep] = useState(1)
  const [repo, setRepo] = useState("storefront")
  const [vars, setVars] = useState(2)

  return (
    <>
      <button type="button" onClick={() => router.push("/projects")} className="mb-5 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <ArrowLeft className="size-3.5" /> Projects
      </button>

      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-[-.045em]">Create a project</h1>
        <p className="mt-2 text-xs text-muted-foreground">
          Step {step} of 4 · {["Import a repository", "Configure project", "Environment variables", "Deploy"][step - 1]}
        </p>
      </div>

      <div className="max-w-4xl">
        <div className="mb-3 flex gap-6 max-sm:justify-between max-sm:gap-2">
          {["Repository", "Configure", "Variables", "Deploy"].map((label, i) => (
            <button key={label} type="button" disabled={i + 1 > step} onClick={() => setStep(i + 1)} className={["flex items-center gap-2 text-sm", step === i + 1 ? "text-foreground" : "text-muted-foreground"].join(" ")}>
              <span className={["grid size-5 place-items-center rounded-full border", step > i + 1 || step === i + 1 ? "border-primary bg-primary text-primary-foreground" : "border-border"].join(" ")}>
                {step > i + 1 ? <Check className="size-3" /> : i + 1}
              </span>
              <span className="max-sm:hidden">{label}</span>
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-border bg-card p-6 max-sm:p-4">
          {step === 1 && (
            <>
              <StepTitle icon={<GitBranch className="size-5" />} title="Import a repository" description="Choose a GitHub repository to deploy with Forge." />
              <div className="mt-5 flex h-9 items-center gap-2 rounded-md border border-border bg-background px-2.5">
                <Search className="size-3.5 text-muted-foreground" />
                <input placeholder="Search repositories" className="flex-1 bg-transparent text-[11px] outline-none" />
              </div>
              <div className="mt-3 space-y-1.5">
                {repos.map((name) => (
                  <button key={name} type="button" onClick={() => setRepo(name)} className={["flex w-full items-center gap-3 rounded-md border p-2.5 text-left", repo === name ? "border-primary bg-primary/5" : "border-border"].join(" ")}>
                    <span className="grid size-7 place-items-center rounded-md bg-secondary text-xs text-primary">{name[0].toUpperCase()}</span>
                    <span className="flex flex-1 flex-col gap-1"><strong className="text-[11px]">acme/{name}</strong><small className="text-[9px] text-muted-foreground">Updated 2 hours ago · main</small></span>
                    <span className="text-[9px] text-muted-foreground">Private</span>
                  </button>
                ))}
              </div>
              <Actions><NextButton onClick={() => setStep(2)} /></Actions>
            </>
          )}

          {step === 2 && (
            <>
              <StepTitle icon={<Settings2 className="size-5" />} title="Configure project" description="Forge detected sensible defaults for your repository." />
              <div className="mt-5 grid grid-cols-2 gap-4 max-sm:grid-cols-1">
                {[["Project name", "storefront"], ["Framework", "Next.js"], ["Root directory", "./"], ["Build command", "pnpm build"], ["Install command", "pnpm install"], ["Output directory", ".next"]].map(([label, value]) => (
                  <label key={label} className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                    {label}
                    <input defaultValue={value} className="rounded-md border border-border bg-background px-2.5 py-2 text-[11px] text-foreground outline-none focus:ring-1 focus:ring-ring" />
                  </label>
                ))}
              </div>
              <Actions><NextButton onClick={() => setStep(3)} /></Actions>
            </>
          )}

          {step === 3 && (
            <>
              <StepTitle icon={<span className="grid size-5 place-items-center rounded border border-primary text-primary">✓</span>} title="Environment variables" description="Add secrets and configuration for your deployment." />
              <div className="mt-5 space-y-1.5">
                <div className="flex items-center gap-3 rounded-md border border-border p-3">
                  <code className="text-sm text-primary">NEXT_PUBLIC_API_URL</code><span className="flex-1 font-mono text-sm text-muted-foreground">••••••••••••••</span>
                  <button type="button" onClick={() => setVars(vars + 1)} className="inline-flex items-center gap-1 text-sm text-muted-foreground"><Plus className="size-3.5" />Add variable</button>
                </div>
                <div className="flex items-center gap-3 rounded-md border border-border p-3">
                  <code className="text-sm text-primary">DATABASE_URL</code><span className="flex-1 font-mono text-sm text-muted-foreground">••••••••••••••</span>
                  <button type="button" onClick={() => setVars(Math.max(0, vars - 1))} aria-label="Delete variable" className="text-muted-foreground"><Trash2 className="size-3.5" /></button>
                </div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{vars} variables configured.</p>
              <Actions><NextButton onClick={() => setStep(4)} /></Actions>
            </>
          )}

          {step === 4 && (
            <>
              <StepTitle icon={<Rocket className="size-5" />} title="Ready to deploy" description="Review your configuration before creating the project." />
              <div className="mt-5 grid grid-cols-2 gap-5 border-t border-border pt-5 max-sm:grid-cols-1">
                {[
                  ["Repository", `acme/${repo}`],
                  ["Framework", "Next.js"],
                  ["Branch", "main"],
                  ["Environment variables", String(vars)],
                ].map(([label, value]) => <div key={label} className="flex flex-col gap-1.5"><span className="text-[9px] text-muted-foreground">{label}</span><strong className="text-[11px] font-medium">{value}</strong></div>)}
              </div>
              <Actions>
                <button type="button" onClick={() => setStep(3)} className="rounded-md border border-border bg-card px-3 py-2 text-[11px]">Back</button>
                <button type="button" onClick={() => { notify("Project created and deployment started"); router.push("/projects/atlas-console/deployments/dpl_8f3a21c") }} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-[11px] font-bold text-primary-foreground">
                  Deploy project <Rocket className="size-3.5" />
                </button>
              </Actions>
            </>
          )}
        </div>
      </div>
    </>
  )
}

function StepTitle({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return <div className="flex items-start gap-3"><span className="text-primary">{icon}</span><div><h2 className="text-[15px] font-semibold">{title}</h2><p className="mt-1 text-[11px] text-muted-foreground">{description}</p></div></div>
}

function Actions({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 flex justify-end gap-2">{children}</div>
}

function NextButton({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-[11px] font-bold text-primary-foreground">Continue <ArrowUpRight className="size-3.5" /></button>
}
