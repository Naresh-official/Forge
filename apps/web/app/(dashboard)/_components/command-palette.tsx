"use client"

import { ArrowUpRight, Search } from "lucide-react"
import { useRouter } from "next/navigation"

const routes = [
  ["Projects", "/projects"],
  ["Deployments", "/deployments"],
  ["Domains", "/domains"],
  ["Documentation", "/docs"],
  ["Settings", "/settings"],
] as const

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter()

  return (
    <div className="fixed inset-0 z-50 grid place-items-start bg-black/60 pt-[17vh] backdrop-blur-sm" onClick={onClose}>
      <div className="w-[min(550px,calc(100vw-30px))] overflow-hidden rounded-lg border border-border bg-popover shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 border-b border-border p-3.5">
          <Search className="size-4 text-muted-foreground" />
          <input autoFocus placeholder="Search projects, deployments, settings..." className="min-w-0 flex-1 bg-transparent text-xs outline-none" />
          <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 text-[9px]">ESC</kbd>
        </div>
        <div className="p-2">
          <span className="px-2 py-1.5 text-[9px] uppercase tracking-widest text-muted-foreground">Navigate</span>
          {routes.map(([label, href]) => (
            <button key={href} type="button" onClick={() => { onClose(); router.push(href) }} className="flex w-full items-center gap-2.5 rounded-md px-2 py-2.5 text-left text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground">
              <ArrowUpRight className="size-3.5 text-primary" />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
