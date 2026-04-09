'use client'

import { Suspense, type ReactNode } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import BottomBar from '@/components/BottomBar'

function AppShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const hideBottomBar =
    pathname.includes('/feed/criar') && searchParams.get('aba') === 'texto'

  return (
    <div className={`min-h-screen bg-gray-50 ${hideBottomBar ? '' : 'pb-20'}`}>
      {children}
      {!hideBottomBar ? <BottomBar /> : null}
    </div>
  )
}

export default function AppShellClient({ children }: { children: ReactNode }) {
  return (
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
  )
}
