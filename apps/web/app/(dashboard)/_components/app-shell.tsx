"use client"

import { useEffect, useState } from "react"
import { CommandPalette } from "./command-palette"
import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"
import { ToastProvider } from "./toast-provider"

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileNav, setMobileNav] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setSearchOpen(true)
      }
      if (event.key === "Escape") setSearchOpen(false)
    }
    window.addEventListener("keydown", listener)
    return () => window.removeEventListener("keydown", listener)
  }, [])

  return (
    <ToastProvider>
      <div className="min-h-screen bg-background text-foreground">
        <div className="flex min-h-screen">
          <Sidebar mobile={mobileNav} onClose={() => setMobileNav(false)} />
          <main className="min-w-0 flex-1">
            <Topbar onMenu={() => setMobileNav(true)} onSearch={() => setSearchOpen(true)} />
            <div className="mx-auto max-w-[1440px] px-[clamp(17px,4vw,50px)] py-10 max-sm:py-7">
              {children}
            </div>
          </main>
        </div>

        {searchOpen && <CommandPalette onClose={() => setSearchOpen(false)} />}
      </div>
    </ToastProvider>
  )
}
