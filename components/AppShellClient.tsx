'use client'

import { Suspense, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { AdminPermissaoProvider } from '@/app/[locale]/(admin)/dashboard/admin/context/AdminPermissaoContext'
import BottomBar from '@/components/BottomBar'

function AppShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  /** Em `/feed/criar` menos respiro acima da barra fixa (~1 cm vs `pb-20`; a barra continua igual). */
  const paddingInferior = pathname.includes('/feed/criar') ? 'pb-14' : 'pb-20'

  return (
    <div className={`min-h-screen bg-gray-50 ${paddingInferior}`}>
      {children}
      <BottomBar />
    </div>
  )
}

export default function AppShellClient({ children }: { children: ReactNode }) {
  return (
    <AdminPermissaoProvider>
      <Suspense
        fallback={
          <div className="min-h-screen bg-gray-50 pb-20">
            {children}
            <BottomBar />
          </div>
        }
      >
        <AppShellInner>{children}</AppShellInner>
      </Suspense>
    </AdminPermissaoProvider>
  )
}
