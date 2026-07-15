'use client'

import { useEffect } from 'react'
import { useRouter } from '@/i18n/navigation'

/** Hub legado — redireciona para /compras-cde */
export default function ComprasParaguaiHubRedirectPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/compras-cde')
  }, [router])
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <p className="text-sm text-gray-500">Redirecionando para Compras CDE…</p>
    </div>
  )
}
