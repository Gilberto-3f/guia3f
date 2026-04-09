import AppShellClient from '@/components/AppShellClient'

export default function AppShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <AppShellClient>{children}</AppShellClient>
}
