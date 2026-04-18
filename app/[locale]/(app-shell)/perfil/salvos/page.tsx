'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import SalvosDrawer from '@/components/perfil/subpaginas/SalvosDrawer'

export default function PerfilSalvosPage() {
  const router = useRouter()
  const locale = useLocale()
  const [meuId, setMeuId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ativo = true
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const id = session?.user?.id ?? null
      if (!ativo) return
      setMeuId(id)
      if (!id) {
        router.replace(`/${locale}/login`)
      }
      if (ativo) setLoading(false)
    })()
    return () => {
      ativo = false
    }
  }, [router, locale])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-400">Carregando…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded p-2 text-gray-600 hover:bg-gray-100"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900">Publicações Salvas</h1>
      </header>
      <div className="p-4">
        <SalvosDrawer usuarioId={meuId} />
      </div>
    </div>
  )
}
