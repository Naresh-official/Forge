import type { Metadata } from "next"
import "@forge/ui/globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { QueryProvider } from "@/components/query-provider"

export const metadata: Metadata = {
  title: "Forge",
  description: "Developer platform",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <QueryProvider>
          <ThemeProvider forcedTheme="dark">{children}</ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
