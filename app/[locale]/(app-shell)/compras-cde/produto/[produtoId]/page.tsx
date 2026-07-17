'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useRouter } from '@/i18n/navigation'
import { supabase } from '@/lib/supabase'
import DrawerProdutosCde from '@/components/DrawerProdutosCde'

/**
 * Deep link `/compras-cde/produto/[produtoId]` — OG preview (WhatsApp) + abre drawer no detalhe.
 */
export default function ProdutoCdeDeepLinkPage() {
  const params = useParams()
  const router = useRouter()
  const produtoId =
    typeof params.produtoId === 'string' ? params.produtoId : params.produtoId?.[0] ?? ''

  const [meta, setMeta] = useState<{
    empresaId: string
    nome: string
    username: string | null
    foto: string | null
    nota: number | null
  } | null>(null)
  const [aberto, setAberto] = useState(true)

  useEffect(() => {
    if (!produtoId) return
    let cancelado = false
    void (async () => {
      const { data: prod } = await supabase
        .from('produtos')
        .select('empresa_id, ativo')
        .eq('id', produtoId)
        .maybeSingle()
      if (cancelado) return
      const empresaId = prod?.empresa_id != null ? String(prod.empresa_id) : ''
      if (!empresaId || prod?.ativo === false) {
        router.replace('/compras-cde')
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
        nome: String(emp?.nome_fantasia ?? 'Loja'),
        username: emp?.nome_usuario != null ? String(emp.nome_usuario) : null,
        foto: emp?.foto_url != null ? String(emp.foto_url) : null,
        nota: emp?.nota_media != null ? Number(emp.nota_media) : null,
      })
    })()
    return () => {
      cancelado = true
    }
  }, [produtoId, router])

  return (
    <div className="min-h-screen bg-gray-50">
      {produtoId && meta ? (
        <DrawerProdutosCde
          isOpen={aberto}
          onClose={() => {
            setAberto(false)
            router.replace('/compras-cde')
          }}
          empresaId={meta.empresaId}
          empresaNome={meta.nome}
          empresaUsername={meta.username}
          empresaFotoUrl={meta.foto}
          notaMedia={meta.nota}
          mostrarEmpresaNoDetalhe
          produtoIdInicial={produtoId}
        />
      ) : (
        <p className="py-12 text-center text-sm text-gray-400">Carregando…</p>
      )}
    </div>
  )
}
