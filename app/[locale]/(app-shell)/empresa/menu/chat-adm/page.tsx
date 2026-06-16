'use client'

import { useEffect } from 'react'
import { useRouter } from '@/i18n/navigation'

/** Redireciona para o Chat ADM unificado (Mensageiro ECOSSISTEMA). */
export default function ChatAdmEmpresaRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/chat-adm')
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <p className="text-sm text-gray-500">Abrindo Chat ADM...</p>
    </div>
  )
}
