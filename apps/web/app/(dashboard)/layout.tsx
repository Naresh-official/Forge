import { auth } from "@/auth"
import { AppShell } from "./_components/app-shell"

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth()

  return (
    <AppShell
      user={{
        name: session?.user?.name ?? null,
        email: session?.user?.email ?? null,
        image: session?.user?.image ?? null,
      }}
    >
      {children}
    </AppShell>
  )
}
