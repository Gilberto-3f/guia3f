import type { ReactNode } from 'react'

export default function AdminDashboardLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-[100dvh] bg-white">{children}</div>
}

