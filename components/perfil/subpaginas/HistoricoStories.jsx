'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { Eye, Heart, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatarDataRelativaPublicacao } from '@/lib/formatarDataPublicacao'
import { visualizadoPorEmails } from '@/lib/feed-autor'
import StoryViewer from '@/components/StoryViewer'

/**
 * @typedef {{
 *   usuario_id: string
 *   username?: string
 *   tipo?: string
 * }} StoryMarcacao
 */

/**
 * @typedef {{
 *   id: string
 *   tipo: string
 *   conteudo_url: string
 *   texto_sobreposto: Record<string, unknown> | null
 *   link: string | null
 *   duracao_segundos: number | null
 *   autorUsuarioId: string | null
 *   curtidas: unknown
 *   visualizado_por: unknown
 *   marcacoes: StoryMarcacao[]
 *   repost_story_id: string | null
 *   created_at: string
 *   expira_em: string
 * }} StoryHistorico
 */

/** @param {unknown} raw */
function contarCurtidas(raw) {
  if (typeof raw === 'string') {
    try {
      return contarCurtidas(JSON.parse(raw))
    } catch {
      return 0
    }
  }
  if (!Array.isArray(raw)) return 0
  const ids = new Set()
  for (const item of raw) {
    if (typeof item === 'string' && item.trim()) ids.add(item.trim())
    else if (item && typeof item === 'object' && 'usuario_id' in item && item.usuario_id != null) ids.add(String(item.usuario_id))
  }
  return ids.size
}

/** @param {unknown} raw */
function normalizarMarcacoes(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const r = /** @type {Record<string, unknown>} */ (item)
      const usuario_id = r.usuario_id != null ? String(r.usuario_id) : ''
      if (!usuario_id) return null
      return {
        usuario_id,
        username: r.username != null ? String(r.username) : '',
        tipo: r.tipo != null ? String(r.tipo) : '',
      }
    })
    .filter(Boolean)
}

/**
 * @param {{
 *   usuarioId: string | null
 * }} props
 */
export default function HistoricoStories({ usuarioId }) {
  const [stories, setStories] = useState(/** @type {StoryHistorico[]} */ ([]))
  const [loading, setLoading] = useState(true)
  const [storyAberto, setStoryAberto] = useState(/** @type {StoryHistorico | null} */ (null))
  const [meuEmail, setMeuEmail] = useState(/** @type {string | null} */ (null))
  const [confirmando, setConfirmando] = useState(/** @type {{ story: StoryHistorico, etapa: 1 | 2 } | null} */ (null))
  const [excluindo, setExcluindo] = useState(false)

  const carregar = useCallback(async () => {
    if (!usuarioId) {
      setStories([])
      setLoading(false)
      return
    }
    setLoading(true)
    const [{ data: sessionData }, { data, error }] = await Promise.all([
      supabase.auth.getSession(),
      supabase
        .from('stories')
        .select(
          'id, tipo, conteudo_url, texto_sobreposto, link, duracao_segundos, autor_id, curtidas, visualizado_por, marcacoes, repost_story_id, created_at, expira_em'
        )
        .eq('autor_id', usuarioId)
        .order('created_at', { ascending: false }),
    ])

    setMeuEmail(sessionData.session?.user?.email ?? null)
    if (error) {
      console.error('[HistoricoStories] carregar:', error)
      setStories([])
      setLoading(false)
      return
    }

    setStories(
      (data ?? []).map((row) => ({
        id: String(row.id),
        tipo: row.tipo != null ? String(row.tipo) : 'foto',
        conteudo_url: String(row.conteudo_url ?? ''),
        texto_sobreposto:
          row.texto_sobreposto && typeof row.texto_sobreposto === 'object' && !Array.isArray(row.texto_sobreposto)
            ? /** @type {Record<string, unknown>} */ (row.texto_sobreposto)
            : null,
        link: row.link != null ? String(row.link) : null,
        duracao_segundos: row.duracao_segundos != null ? Number(row.duracao_segundos) : null,
        autorUsuarioId: row.autor_id != null ? String(row.autor_id) : usuarioId,
        curtidas: row.curtidas ?? null,
        visualizado_por: row.visualizado_por ?? null,
        marcacoes: normalizarMarcacoes(row.marcacoes),
        repost_story_id: row.repost_story_id != null ? String(row.repost_story_id) : null,
        created_at: String(row.created_at ?? ''),
        expira_em: String(row.expira_em ?? ''),
      }))
    )
    setLoading(false)
  }, [usuarioId])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const excluirStory = async () => {
    if (!confirmando || !usuarioId || excluindo) return
    if (confirmando.etapa === 1) {
      setConfirmando({ story: confirmando.story, etapa: 2 })
      return
    }
    setExcluindo(true)
    try {
      const { error } = await supabase
        .from('stories')
        .delete()
        .eq('id', confirmando.story.id)
        .eq('autor_id', usuarioId)
      if (error) throw error
      setStories((prev) => prev.filter((s) => s.id !== confirmando.story.id))
      setStoryAberto((prev) => (prev?.id === confirmando.story.id ? null : prev))
      setConfirmando(null)
    } catch (e) {
      console.error('[HistoricoStories] excluir:', e)
      alert('Não foi possível excluir o story.')
    } finally {
      setExcluindo(false)
    }
  }

  if (!usuarioId) {
    return <p className="px-1 text-sm text-gray-500">Entre na conta para ver seu histórico de stories.</p>
  }

  return (
    <div className="px-1 pb-4">
      {loading ? <p className="py-6 text-center text-sm text-gray-400">Carregando…</p> : null}
      {!loading && stories.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">Nenhum story publicado ainda.</p>
      ) : null}

      {!loading && stories.length > 0 ? (
        <ul className="divide-y divide-gray-100">
          {stories.map((story) => {
            const expirado = story.expira_em ? Date.parse(story.expira_em) <= Date.now() : false
            return (
              <li key={story.id} className="py-2 first:pt-0">
                <div className="rounded-xl border border-gray-100 p-2">
                  <button
                    type="button"
                    onClick={() => setStoryAberto(story)}
                    className="flex w-full min-w-0 gap-3 text-left"
                    aria-label="Abrir story"
                  >
                    <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                      {story.tipo === 'video' ? (
                        <video src={story.conteudo_url} className="h-full w-full object-cover" muted playsInline />
                      ) : (
                        <Image src={story.conteudo_url} alt="" fill className="object-cover" sizes="56px" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-sm font-semibold text-gray-900">
                          {story.created_at ? formatarDataRelativaPublicacao(story.created_at) : 'Story'}
                        </p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${expirado ? 'bg-gray-100 text-gray-500' : 'bg-[#0097b2]/10 text-[#0097b2]'}`}>
                          {expirado ? 'Expirado' : 'Ativo'}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                        <span className="inline-flex items-center gap-1">
                          <Heart className="h-3.5 w-3.5" aria-hidden />
                          {contarCurtidas(story.curtidas)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Eye className="h-3.5 w-3.5" aria-hidden />
                          {visualizadoPorEmails(story.visualizado_por).length}
                        </span>
                      </div>
                      {story.marcacoes.length > 0 ? (
                        <p className="mt-2 line-clamp-1 text-xs text-gray-500">
                          Marcou {story.marcacoes.map((m) => `@${String(m.username || 'usuario').replace(/^@+/, '')}`).join(', ')}
                        </p>
                      ) : null}
                    </div>
                  </button>
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setConfirmando({ story, etapa: 1 })}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                      Excluir
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}

      {storyAberto ? (
        <StoryViewer
          story={storyAberto}
          userEmail={meuEmail}
          meuUsuarioId={usuarioId}
          onFechar={() => setStoryAberto(null)}
          storyQueueLength={1}
          storyQueueIndex={0}
        />
      ) : null}

      {confirmando ? (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-bold text-gray-900">
              {confirmando.etapa === 1 ? 'Excluir este story?' : 'Confirmar exclusão definitiva?'}
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              {confirmando.etapa === 1
                ? 'Você ainda precisará confirmar mais uma vez.'
                : 'Essa ação remove o story do histórico e não poderá ser desfeita.'}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={excluindo}
                onClick={() => setConfirmando(null)}
                className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={excluindo}
                onClick={() => void excluirStory()}
                className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {confirmando.etapa === 1 ? 'Continuar' : excluindo ? 'Excluindo…' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
