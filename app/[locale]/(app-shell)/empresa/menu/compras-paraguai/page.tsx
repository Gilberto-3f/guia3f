'use client'

import { useEffect } from 'react'
import { useRouter } from '@/i18n/navigation'

/** Página legada removida — cadastro de produtos fica no Botão Dinâmico (Lojas CDE). */
export default function ComprasParaguaiMenuRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/empresa/menu/botao-dinamico')
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0097b2]">
      <p className="text-sm text-white">Redirecionando para Botão Dinâmico…</p>
    </div>
  )
}
