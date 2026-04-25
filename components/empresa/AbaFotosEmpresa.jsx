'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import AbaFotos from '@/components/perfil/AbaFotos'
import ModalFoto from '@/components/perfil/ModalFoto'

/**
 * Mesmo critério que `perfil/[id]/page` (tipos `foto` e `misto` em `posts`).
 *
 * @param {{
 *   empresaUsuarioId: string | null
 *   nomeFantasia: string
 *   nomeUsuario: string
 *   fotoPerfilUrl: string | null
 * }} props
 */
export default function AbaFotosEmpresa({ empresaUsuarioId, nomeFantasia, nomeUsuario, fotoPerfilUrl }) {
  const [items, setItems] = useState(/** @type {object[]} */ ([]))
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [meuId, setMeuId] = useState(/** @type {string | null} */ (null))
  const [modal, setModal] = useState(/** @type {{ aberto: boolean, i: number }} */ ({ aberto: false, i: 0 }))

  useEffect(() => {
    const run = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      setMeuId(session?.user?.id ?? null)
    }
    void run()
  }, [])

  const carregar = useCallback(async () => {
    if (!empresaUsuarioId) {
      setItems([])
      setLoading(false)
      setErro('')
      return
    }
    setLoading(true)
    setErro('')
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(
          'id, conteudo_url, foto_url, tipo, texto, total_curtidas, total_comentarios, total_compartilhamentos, total_reposts, post_original_id, created_at'
        )
        .eq('autor_id', empresaUsuarioId)
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
        data
          ?.map((p) => {
            const uu = p.conteudo_url || p.foto_url
            if (uu == null) return null
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
            }
          })
          .filter((x) => x != null) ?? []
      setItems(rows)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar fotos')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [empresaUsuarioId])

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
          : p
      )
    )
  }, [])

  if (!empresaUsuarioId) {
    return <p className="py-10 text-center text-sm text-gray-500">Fotos indisponíveis para esta empresa.</p>
  }

  if (loading) {
    return (
      <div className="py-10 text-center text-sm text-gray-400">
        <div className="animate-pulse">Carregando fotos…</div>
      </div>
    )
  }

  if (erro) {
    return <p className="rounded-lg bg-amber-50 p-3 text-center text-sm text-amber-900">Não foi possível carregar as fotos. {erro}</p>
  }

  return (
    <>
      <div className="min-h-[200px] bg-gray-50 py-2">
        <AbaFotos posts={items} onOpen={(i) => setModal({ aberto: true, i })} />
      </div>
      <ModalFoto
        posts={items}
        indiceInicial={modal.i}
        aberto={modal.aberto}
        onFechar={() => setModal((m) => ({ ...m, aberto: false }))}
        meuUsuarioId={meuId}
        autor={{
          nome: nomeFantasia,
          username: nomeUsuario,
          foto_perfil_url: fotoPerfilUrl,
          usuario_id: empresaUsuarioId,
          role: 'empresa',
        }}
        onPatchPost={patchFoto}
        onRemovePost={(postId) => setItems((prev) => prev.filter((p) => p.id !== postId))}
      />
    </>
  )
}
