'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useRouter } from '@/i18n/navigation'
import { supabase } from '@/lib/supabase'
import DrawerCardapio from '@/components/DrawerCardapio'

/**
 * Deep link `/cardapio/prato/[pratoId]` — OG preview (WhatsApp) + abre drawer no detalhe.
 */
export default function PratoCardapioDeepLinkPage() {
  const params = useParams()
  const router = useRouter()
  const pratoId =
    typeof params.pratoId === 'string' ? params.pratoId : params.pratoId?.[0] ?? ''

  const [meta, setMeta] = useState<{
    empresaId: string
    nome: string
    username: string | null
    foto: string | null
    nota: number | null
  } | null>(null)
  const [aberto, setAberto] = useState(true)

  useEffect(() => {
    if (!pratoId) return
    let cancelado = false
    void (async () => {
      const { data: prato } = await supabase
        .from('cardapio_pratos')
        .select('empresa_id, ativo')
        .eq('id', pratoId)
        .maybeSingle()
      if (cancelado) return
      const empresaId = prato?.empresa_id != null ? String(prato.empresa_id) : ''
      if (!empresaId || prato?.ativo === false) {
        router.replace('/')
        return
      }
      const { data: emp } = await supabase
        .from('empresas')
        .select('nome_fantasia, nome_usuario, foto_url, nota_media')
        .eq('id', empresaId)
        .maybeSingle()
      if (cancelado) return
      setMeta({
        empresaId,
        nome: String(emp?.nome_fantasia ?? 'Restaurante'),
        username: emp?.nome_usuario != null ? String(emp.nome_usuario) : null,
        foto: emp?.foto_url != null ? String(emp.foto_url) : null,
        nota: emp?.nota_media != null ? Number(emp.nota_media) : null,
      })
    })()
    return () => {
      cancelado = true
    }
  }, [pratoId, router])

  return (
    <div className="min-h-screen bg-gray-50">
      {pratoId && meta ? (
        <DrawerCardapio
          isOpen={aberto}
          onClose={() => {
            setAberto(false)
            router.replace(`/empresa/${meta.empresaId}`)
          }}
          empresaId={meta.empresaId}
          empresaNome={meta.nome}
          empresaUsername={meta.username}
          empresaFotoUrl={meta.foto}
          notaMedia={meta.nota}
          mostrarEmpresaNoDetalhe
          pratoIdInicial={pratoId}
        />
      ) : (
        <p className="py-12 text-center text-sm text-gray-400">Carregando…</p>
      )}
    </div>
  )
}
