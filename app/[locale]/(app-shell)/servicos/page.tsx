'use client'

import { useEffect } from 'react'
import { useRouter } from '@/i18n/navigation'

/** Legado: redireciona para o segmento Serviços Locais no guia. */
export default function ServicosPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/guia/servicos_locais')
  }, [router])

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <p className="text-sm text-gray-500">Redirecionando…</p>
    </div>
  )
}
