import type { Metadata } from "next"
import "@workspace/ui/globals.css"
import { ThemeProvider } from "@/components/theme-provider"

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
                <ThemeProvider forcedTheme="dark">{children}</ThemeProvider>
            </body>
        </html>
    )
}
