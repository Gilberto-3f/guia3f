'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { pickAutorDisplay } from '@/lib/feed-autor'
import { ocultarMarcacaoEmpresaNoPost } from '@/lib/marcacaoEmpresaPost'
import AbaFotos from '@/components/perfil/AbaFotos'
import ModalFoto from '@/components/perfil/ModalFoto'

/**
 * Fotos de terceiros que marcaram esta empresa (oculta não entra).
 *
 * @param {{
 *   empresaId: string | null
 *   empresaUsuarioId: string | null
 *   meuUsuarioId?: string | null
 * }} props
 */
export default function AbaMarcacoesEmpresa({ empresaId, empresaUsuarioId, meuUsuarioId = null }) {
  const [items, setItems] = useState(/** @type {object[]} */ ([]))
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [modal, setModal] = useState(/** @type {{ aberto: boolean, i: number }} */ ({ aberto: false, i: 0 }))

  const donoEmpresa =
    Boolean(meuUsuarioId && empresaUsuarioId && String(meuUsuarioId) === String(empresaUsuarioId))

  const carregar = useCallback(async () => {
    if (!empresaId) {
      setItems([])
      setLoading(false)
      setErro('')
      return
    }
    setLoading(true)
    setErro('')
    try {
      const { data, error } = await supabase
        .from('posts_com_autores')
        .select('*')
        .eq('empresa_marcada_id', empresaId)
        .is('marcacao_oculta_em', null)
        .is('deleted_at', null)
        .is('post_original_id', null)
        .in('tipo', ['foto', 'misto'])
        .order('created_at', { ascending: false })

      if (error) {
        setErro(error.message)
        setItems([])
        return
      }

      const rows =
        (data ?? [])
          .map((raw) => {
            const p = /** @type {Record<string, unknown>} */ (raw)
            const uu = p.conteudo_url || p.foto_url
            if (uu == null) return null
            let u = p.usuarios
            if (typeof u === 'string') {
              try {
                u = JSON.parse(u)
              } catch {
                u = null
              }
            }
            const autor = pickAutorDisplay(u, {
              autorTipo: p.autor_tipo != null ? String(p.autor_tipo) : null,
            })
            return {
              id: String(p.id),
              url: String(uu),
              texto: p.texto != null ? String(p.texto) : null,
              created_at: String(p.created_at ?? ''),
              tipo: p.tipo != null ? String(p.tipo) : 'foto',
              total_curtidas: Number(p.total_curtidas) || 0,
              total_comentarios: Number(p.total_comentarios) || 0,
              total_compartilhamentos: Number(p.total_compartilhamentos) || 0,
              total_reposts: Number(p.total_reposts) || 0,
              post_original_id: p.post_original_id != null ? String(p.post_original_id) : null,
              empresa_marcada_id: empresaId,
              autor,
            }
          })
          .filter((x) => x != null) ?? []
      setItems(rows)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar marcações')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [empresaId])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const patchFoto = useCallback((postId, updates) => {
    setItems((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              total_curtidas: updates.total_curtidas ?? p.total_curtidas,
              total_comentarios: updates.total_comentarios ?? p.total_comentarios,
            }
          : p,
      ),
    )
  }, [])

  const ocultar = useCallback(
    async (postId) => {
      const res = await ocultarMarcacaoEmpresaNoPost(supabase, postId)
      if (!res.ok) return
      setItems((prev) => prev.filter((p) => p.id !== postId))
      setModal((m) => {
        if (!m.aberto) return m
        const rest = items.filter((p) => p.id !== postId)
        if (rest.length === 0) return { aberto: false, i: 0 }
        return { aberto: true, i: Math.min(m.i, rest.length - 1) }
      })
    },
    [items],
  )

  if (!empresaId) {
    return <p className="py-10 text-center text-sm text-gray-500">Marcações indisponíveis para esta empresa.</p>
  }

  if (loading) {
    return (
      <div className="py-10 text-center text-sm text-gray-400">
        <div className="animate-pulse">Carregando marcações…</div>
      </div>
    )
  }

  if (erro) {
    return (
      <p className="rounded-lg bg-amber-50 p-3 text-center text-sm text-amber-900">
        Não foi possível carregar as marcações. {erro}
      </p>
    )
  }

  return (
    <>
      <div className="bg-gray-50 pt-2 pb-0">
        {items.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-400">Nenhuma marcação ainda</p>
        ) : (
          <AbaFotos posts={items} onOpen={(i) => setModal({ aberto: true, i })} />
        )}
      </div>
      <ModalFoto
        posts={items}
        indiceInicial={modal.i}
        aberto={modal.aberto}
        onFechar={() => setModal((m) => ({ ...m, aberto: false }))}
        meuUsuarioId={meuUsuarioId}
        autor={{
          nome: 'Usuário',
          username: 'usuario',
          foto_perfil_url: null,
          usuario_id: '',
          role: 'turista',
        }}
        onPatchPost={patchFoto}
        onRemovePost={(postId) => setItems((prev) => prev.filter((p) => p.id !== postId))}
        esconderMenu={!donoEmpresa}
        onOcultarMarcacao={donoEmpresa ? (postId) => void ocultar(postId) : null}
      />
    </>
  )
}
