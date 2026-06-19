'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import AbaPosts from '@/components/perfil/AbaPosts'

/**
 * Mesmo critério que `perfil/[id]/page` (tipos `postagem` e `texto` com filtro extra no `postagem`).
 *
 * @param {{ empresaUsuarioId: string | null }} props
 */
export default function AbaPostsEmpresa({ empresaUsuarioId }) {
  const [posts, setPosts] = useState(
    /** @type {Array<{ id: string; texto: string | null; created_at: string; total_curtidas: number; total_comentarios: number }>} */ ([])
  )
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    if (!empresaUsuarioId) {
      setPosts([])
      setLoading(false)
      setErro('')
      return
    }
    setLoading(true)
    setErro('')
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('id, texto, created_at, total_curtidas, total_comentarios, tipo, post_original_id')
        .eq('autor_id', empresaUsuarioId)
        .is('deleted_at', null)
        .is('post_original_id', null)
        .in('tipo', ['postagem', 'texto'])
        .order('created_at', { ascending: false })

      if (error) {
        setErro(error.message)
        setPosts([])
        return
      }

      const rows =
        (data ?? []).filter((p) => {
          const t = String(p.tipo || '')
          if (t === 'texto') return true
          if (t === 'postagem') {
            const tx = String(p.texto || '')
            return !tx.includes('Confira:') || !tx.includes('post=')
          }
          return true
        }) ?? []

      setPosts(
        rows.map((p) => ({
          id: String(p.id),
          texto: p.texto != null ? String(p.texto) : null,
          created_at: String(p.created_at ?? ''),
          total_curtidas: Number(p.total_curtidas) || 0,
          total_comentarios: Number(p.total_comentarios) || 0,
        }))
      )
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar posts')
      setPosts([])
    } finally {
      setLoading(false)
    }
  }, [empresaUsuarioId])

  useEffect(() => {
    void carregar()
  }, [carregar])

  useEffect(() => {
    const onReload = () => {
      void carregar()
    }
    window.addEventListener('guia-empresa-publicacoes-reload', onReload)
    return () => window.removeEventListener('guia-empresa-publicacoes-reload', onReload)
  }, [carregar])

  if (!empresaUsuarioId) {
    return <p className="py-10 text-center text-sm text-gray-500">Publicações indisponíveis para esta empresa.</p>
  }

  if (loading) {
    return (
      <div className="py-10 text-center text-sm text-gray-400">
        <div className="animate-pulse">Carregando publicações…</div>
      </div>
    )
  }

  if (erro) {
    return <p className="rounded-lg bg-amber-50 p-3 text-center text-sm text-amber-900">Não foi possível carregar os posts. {erro}</p>
  }

  return (
    <div className="min-h-[200px] bg-gray-50 py-2">
      <AbaPosts posts={posts} />
    </div>
  )
}
