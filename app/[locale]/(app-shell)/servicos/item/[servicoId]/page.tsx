'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useRouter } from '@/i18n/navigation'
import { supabase } from '@/lib/supabase'
import DrawerServicosLocais from '@/components/DrawerServicosLocais'

/**
 * Deep link `/servicos/item/[servicoId]` — OG preview (WhatsApp) + abre drawer no detalhe.
 */
export default function ServicoServicosDeepLinkPage() {
  const params = useParams()
  const router = useRouter()
  const servicoId =
    typeof params.servicoId === 'string' ? params.servicoId : params.servicoId?.[0] ?? ''

  const [meta, setMeta] = useState<{
    empresaId: string
    nome: string
    username: string | null
    foto: string | null
    nota: number | null
  } | null>(null)
  const [aberto, setAberto] = useState(true)

  useEffect(() => {
    if (!servicoId) return
    let cancelado = false
    void (async () => {
      const { data: servico } = await supabase
        .from('servicos_locais_itens')
        .select('empresa_id, ativo')
        .eq('id', servicoId)
        .maybeSingle()
      if (cancelado) return
      const empresaId = servico?.empresa_id != null ? String(servico.empresa_id) : ''
      if (!empresaId || servico?.ativo === false) {
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
        nome: String(emp?.nome_fantasia ?? 'Empresa'),
        username: emp?.nome_usuario != null ? String(emp.nome_usuario) : null,
        foto: emp?.foto_url != null ? String(emp.foto_url) : null,
        nota: emp?.nota_media != null ? Number(emp.nota_media) : null,
      })
    })()
    return () => {
      cancelado = true
    }
  }, [servicoId, router])

  return (
    <div className="min-h-screen bg-gray-50">
      {servicoId && meta ? (
        <DrawerServicosLocais
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
          servicoIdInicial={servicoId}
        />
      ) : (
        <p className="py-12 text-center text-sm text-gray-400">Carregando…</p>
      )}
    </div>
  )
}
