'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import DrawerProdutosCde from '@/components/DrawerProdutosCde'
import { empresaTemPresencaPublicaVigente } from '@/lib/empresaPresencaPublica'

/**
 * Deep link legado `/compras-paraguai/[empresaId]` — abre o drawer de catálogo.
 */
export default function CatalogoEmpresaRedirectPage() {
  const params = useParams()
  const router = useRouter()
  const empresaId =
    typeof params.empresaId === 'string' ? params.empresaId : params.empresaId?.[0] ?? ''

  const [meta, setMeta] = useState<{
    nome: string
    username: string | null
    foto: string | null
    nota: number | null
  } | null>(null)
  const [aberto, setAberto] = useState(true)

  useEffect(() => {
    if (!empresaId) return
    let cancelado = false
    void (async () => {
      const presente = await empresaTemPresencaPublicaVigente(supabase, empresaId)
      if (cancelado) return
      if (!presente) {
        router.replace('/compras-cde')
        return
      }
      const { data } = await supabase
        .from('empresas')
        .select('nome_fantasia, nome_usuario, foto_url, nota_media')
        .eq('id', empresaId)
        .maybeSingle()
      if (cancelado) return
      setMeta({
        nome: String(data?.nome_fantasia ?? 'Loja'),
        username: data?.nome_usuario != null ? String(data.nome_usuario) : null,
        foto: data?.foto_url != null ? String(data.foto_url) : null,
        nota: data?.nota_media != null ? Number(data.nota_media) : null,
      })
    })()
    return () => {
      cancelado = true
    }
  }, [empresaId, router])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-white px-3 py-3 pt-safe">
        <button type="button" onClick={() => router.back()} className="rounded-lg p-2" aria-label="Voltar">
          <ArrowLeft className="h-5 w-5 text-gray-600" aria-hidden />
        </button>
        <p className="truncate text-sm font-semibold text-[#001f3f]">{meta?.nome ?? 'Catálogo'}</p>
      </div>

      {empresaId && meta ? (
        <DrawerProdutosCde
          isOpen={aberto}
          onClose={() => {
            setAberto(false)
            router.back()
          }}
          empresaId={empresaId}
          empresaNome={meta.nome}
          empresaUsername={meta.username}
          empresaFotoUrl={meta.foto}
          notaMedia={meta.nota}
        />
      ) : (
        <p className="py-12 text-center text-sm text-gray-400">Carregando…</p>
      )}
    </div>
  )
}
