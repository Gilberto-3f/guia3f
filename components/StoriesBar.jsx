'use client'

import { startTransition, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import AvatarImage from '@/components/AvatarImage'
import { Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  fetchFotoPerfilUsuario,
  fetchFotosPerfilPorUsuarioIds,
  fetchPerfisSociaisPorUsuarioIds,
  STORY_RING_GRADIENT,
  visualizadoPorEmails,
} from '@/lib/feed-autor'
import { buscarPerfisPorIds } from '@/lib/perfil-utils'
import { isTipoVideoPost } from '@/lib/feedFiltroSeguidos'
import { fetchEmpresasGuiaRows } from '@/lib/feedSeguidosEmpresasFavoritas'
import { tentarProcessarPublicacoesAgendadas } from '@/lib/processarPublicacoesAgendadasClient'
import { listarSeguidosIdsCached } from '@/lib/redeContatosCache'
import {
  autorIdFromStorySlot,
  storySlotEhEmpresa,
  storySlotKeyFromRow,
} from '@/lib/storyAnfitriaoSlots'
import {
  escolherIdStoryInicialPorEmail,
  ordenarStoriesPorCreatedAsc,
  visualizadoPorConsolidadoParaAnel,
} from '@/lib/story-open-order'
import StoryCircle from '@/components/StoryCircle'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import { useGateFeedSocial } from '@/lib/useGateFeedSocial'
import PopupAvisoBloqueioConta from '@/components/PopupAvisoBloqueioConta'

const MAX_STORY_RINGS = 12

/** @param {unknown} tipo */
function isAutorEmpresa(tipo) {
  return String(tipo ?? '').toLowerCase() === 'empresa'
}

/**
 * @param {unknown} visualizado_por
 * @param {string | null} userEmail
 */
function foiVisualizado(visualizado_por, userEmail) {
  if (!userEmail) return false
  return visualizadoPorEmails(visualizado_por).includes(userEmail)
}

/** Rótulo curto a partir do objeto já processado por pickAutorDisplay. */
function abreviarLabelStory(s, max = 11) {
  const t = String(s ?? '').trim()
  if (!t) return t
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

/** @param {{ username: string, nome: string }} perfil */
function labelFromPerfilSocial(perfil) {
  const raw = String(perfil.username ?? '').trim()
  if (raw && raw.toLowerCase() !== 'usuario') {
    const out = raw.startsWith('@') ? raw : `@${raw.replace(/^@/, '')}`
    return abreviarLabelStory(out)
  }
  const n = String(perfil.nome ?? '').trim()
  if (n) return abreviarLabelStory(n)
  return abreviarLabelStory('Usuário')
}

/** @param {string | null | undefined} s */
function formatStoryHandle(s) {
  const t = String(s ?? '').trim()
  if (!t || t.toLowerCase() === 'usuario') return null
  return t.startsWith('@') ? t : `@${t.replace(/^@/, '')}`
}

/** Empresa na barra: @nome_usuario ou nome fantasia curto. */
function labelStoryEmpresa(e) {
  const nu = e.nome_usuario != null ? String(e.nome_usuario).trim() : ''
  if (nu) return abreviarLabelStory(nu.startsWith('@') ? nu : `@${nu.replace(/^@/, '')}`)
  const nf = e.nome_fantasia != null ? String(e.nome_fantasia).trim() : 'Empresa'
  return abreviarLabelStory(nf)
}

/**
 * @param {{
 *   hidden?: boolean
 *   userEmail: string | null
 *   onOpenStory: (id: string, meta?: { filaAutores: string[]; filaAutorIndex: number }) => void
 *   reloadSignal?: number
 * }} props
 */
export default function StoriesBar({ hidden = false, userEmail, onOpenStory, reloadSignal = 0 }) {
  const [barMounted, setBarMounted] = useState(false)
  const { podeInteragir, notificarSomenteLeitura, modoAtivo, perfilSimulado } = useModoApresentacao()
  const {
    podeInteragirFeedSocial,
    avisarBloqueioFeed,
    avisoFeedAberto,
    fecharAvisoBloqueioFeed,
    mensagemBloqueioFeed,
    tituloBloqueioFeed,
  } = useGateFeedSocial()
  const podeCriarStory = podeInteragir && podeInteragirFeedSocial

  useEffect(() => {
    setBarMounted(true)
  }, [])

  const simulandoEmpresa = Boolean(modoAtivo && perfilSimulado?.tipo === 'empresa')
  /** @type {{ avatarUrl: string | null, storyId: string | null, visualizado_por: unknown }} */
  const [meuSlot, setMeuSlot] = useState({
    avatarUrl: null,
    storyId: null,
    visualizado_por: null,
  })

  /** @type {{ id: string, autorId: string, label: string, avatarUrl: string | null, visualizado_por: unknown }[]} */
  const [rings, setRings] = useState([])
  const [storiesBarLoading, setStoriesBarLoading] = useState(true)
  const [meuUserId, setMeuUserId] = useState(/** @type {string | null} */ (null))

  const load = useCallback(async () => {
    setStoriesBarLoading(true)
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.user) {
      setRings([])
      setMeuUserId(null)
      setMeuSlot({ avatarUrl: null, storyId: null, visualizado_por: null })
      setStoriesBarLoading(false)
      return
    }

    const uid = session.user.id
    setMeuUserId(uid)

    try {
    void tentarProcessarPublicacoesAgendadas()

    /** @param {string} userId */
    const carregarMeuAvatar = async (userId) => fetchFotoPerfilUsuario(supabase, userId)

    const [{ data: storiesRows, error: storiesErr }, meuAvatarUrl, seguidosIdsList] = await Promise.all([
      supabase
        .from('stories')
        .select('id, autor_id, conteudo_url, visualizado_por, created_at, tipo, autor_tipo')
        .gt('expira_em', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(120),
      carregarMeuAvatar(uid),
      listarSeguidosIdsCached(supabase, uid),
    ])

    if (storiesErr) {
      console.error(storiesErr)
      setRings([])
      setMeuSlot({ avatarUrl: meuAvatarUrl, storyId: null, visualizado_por: null })
      return
    }

    const storiesValidas = (storiesRows ?? []).filter((s) => {
      const ok = Boolean(s?.id && s?.autor_id && String(s.conteudo_url ?? '').trim())
      if (!ok) console.warn('[StoriesBar] Story inválido ignorado:', s)
      return ok
    })

    const seguidosIds = new Set(seguidosIdsList)

    const storyAutorIds = [...new Set(storiesValidas.map((s) => String(s.autor_id)).filter(Boolean))]
    let empresasRows = /** @type {{ usuario_id: string, nome_fantasia: string | null, nome_usuario: string | null, foto_url: string | null }[]} */ (
      []
    )
    if (storyAutorIds.length > 0) {
      empresasRows = await fetchEmpresasGuiaRows(supabase, {
        select: 'usuario_id, nome_fantasia, nome_usuario, foto_url, somente_modo_apresentacao',
        usuarioIds: storyAutorIds,
        incluirModoApresentacao: simulandoEmpresa,
      })
    }

    /** Stories permitidos: próprio utilizador; empresa (global); profissional/turista só se seguido. */
    const storiesFiltradas = storiesValidas.filter((s) => {
      if (isTipoVideoPost(s.tipo)) return false
      const aid = String(s.autor_id)
      if (aid === uid) return true
      if (isAutorEmpresa(s.autor_tipo)) return true
      return seguidosIds.has(aid)
    })

    /** Stories agrupados por slot (autor + persona prof/emp). */
    const storiesPorSlot = /** @type {Map<string, NonNullable<typeof storiesFiltradas>>} */ (new Map())
    for (const s of storiesFiltradas) {
      const slot = storySlotKeyFromRow(s)
      if (!slot) continue
      if (!storiesPorSlot.has(slot)) storiesPorSlot.set(slot, [])
      storiesPorSlot.get(slot).push(s)
    }
    for (const arr of storiesPorSlot.values()) {
      ordenarStoriesPorCreatedAsc(arr)
    }

    const meuProfArr = storiesPorSlot.get(`${uid}|prof`) ?? []
    const meuEmpArr = storiesPorSlot.get(`${uid}|emp`) ?? []
    const meuArr = [...meuProfArr, ...meuEmpArr]
    const meuAbrirId = escolherIdStoryInicialPorEmail(meuArr, userEmail)
    setMeuSlot({
      avatarUrl: meuAvatarUrl,
      storyId: meuAbrirId,
      visualizado_por: visualizadoPorConsolidadoParaAnel(meuArr, userEmail),
    })

    /** @type {string[]} */
    const ordered = []
    const seen = new Set()

    const pushSlot = (slot) => {
      if (ordered.length >= MAX_STORY_RINGS) return false
      if (seen.has(slot) || !storiesPorSlot.has(slot)) return false
      ordered.push(slot)
      seen.add(slot)
      return true
    }

    for (const sk of [`${uid}|prof`, `${uid}|emp`]) {
      seen.add(sk)
    }

    const latestStoryMs = (slot) => {
      const arr = storiesPorSlot.get(slot)
      if (!arr?.length) return 0
      const last = arr[arr.length - 1]
      return new Date(String(last.created_at ?? 0)).getTime()
    }

    const slotsOrdenados = [...storiesPorSlot.keys()]
      .filter((sk) => autorIdFromStorySlot(sk) !== uid)
      .sort((a, b) => latestStoryMs(b) - latestStoryMs(a))

    for (const sk of slotsOrdenados) {
      if (ordered.length >= MAX_STORY_RINGS) break
      pushSlot(sk)
    }

    const labels = /** @type {Record<string, string>} */ ({})
    const previews = /** @type {Record<string, string | null>} */ ({})
    for (const e of empresasRows ?? []) {
      const euid = String(e.usuario_id)
      const empSlot = `${euid}|emp`
      if (storiesPorSlot.has(empSlot) || (simulandoEmpresa && euid === String(session.user.id))) {
        labels[empSlot] = labelStoryEmpresa(e)
        previews[empSlot] = e.foto_url != null ? String(e.foto_url) : null
      }
    }
    const precisaPerfil = ordered.filter((sk) => labels[sk] == null)
    if (precisaPerfil.length > 0) {
      const autorIds = [...new Set(precisaPerfil.map((sk) => autorIdFromStorySlot(sk)).filter(Boolean))]
      const perfisSociais = await fetchPerfisSociaisPorUsuarioIds(supabase, autorIds)
      for (const sk of precisaPerfil) {
        const aid = autorIdFromStorySlot(sk)
        const perfil = perfisSociais.get(aid)
        if (!perfil) continue
        labels[sk] = labelFromPerfilSocial(perfil)
        previews[sk] = perfil.foto
      }
    }

    const semFoto = ordered.filter((sk) => !previews[sk])
    if (semFoto.length > 0) {
      const autorIds = [...new Set(semFoto.map((sk) => autorIdFromStorySlot(sk)).filter(Boolean))]
      const fotosMap = await fetchFotosPerfilPorUsuarioIds(supabase, autorIds)
      for (const sk of semFoto) {
        const aid = autorIdFromStorySlot(sk)
        const url = fotosMap.get(aid)
        if (url) previews[sk] = url
      }
    }

    const semLabel = ordered.filter((sk) => labels[sk] == null)
    if (semLabel.length > 0) {
      const autorIds = [...new Set(semLabel.map((sk) => autorIdFromStorySlot(sk)).filter(Boolean))]
      const perfisBusca = await buscarPerfisPorIds(supabase, autorIds)
      for (const p of perfisBusca) {
        const id = String(p.usuario_id ?? '')
        if (!id) continue
        const profSlot = `${id}|prof`
        const empSlot = `${id}|emp`
        const nu = (p.username ?? '').trim()
        const nome = (p.nome ?? '').trim()
        const lbl =
          nu && nu.toLowerCase() !== 'usuario'
            ? abreviarLabelStory(formatStoryHandle(nu) ?? nu)
            : nome
              ? abreviarLabelStory(nome)
              : 'Usuário'
        if (semLabel.includes(profSlot) && labels[profSlot] == null) labels[profSlot] = lbl
        if (semLabel.includes(empSlot) && labels[empSlot] == null && storySlotEhEmpresa(empSlot)) {
          labels[empSlot] = lbl
        }
        if (!previews[profSlot] && p.foto_url) previews[profSlot] = p.foto_url
      }
      for (const sk of semLabel) {
        if (labels[sk] == null) labels[sk] = 'Usuário'
      }
    }

    const built = ordered
      .map((slotKey) => {
        const arr = storiesPorSlot.get(slotKey)
        if (!arr?.length) return null
        const abrirId = escolherIdStoryInicialPorEmail(arr, userEmail)
        if (!abrirId) return null
        const avatarUrl = previews[slotKey] ?? null
        return {
          id: abrirId,
          autorId: autorIdFromStorySlot(slotKey),
          slotKey,
          label: labels[slotKey] ?? 'Usuário',
          avatarUrl,
          visualizado_por: visualizadoPorConsolidadoParaAnel(arr, userEmail),
        }
      })
      .filter(Boolean)

    const naoVistos = /** @type {NonNullable<(typeof built)[0]>[]} */ (
      built.filter((b) => b && !foiVisualizado(b.visualizado_por, userEmail))
    )
    const vistos = /** @type {NonNullable<(typeof built)[0]>[]} */ (
      built.filter((b) => b && foiVisualizado(b.visualizado_por, userEmail))
    )

    setRings([...naoVistos, ...vistos])
    } catch (e) {
      console.error('[StoriesBar] load:', e)
      setRings([])
    } finally {
      setStoriesBarLoading(false)
    }
  }, [userEmail, simulandoEmpresa])

  useEffect(() => {
    startTransition(() => {
      void load()
    })
  }, [load, reloadSignal])

  useEffect(() => {
    const onReload = () => {
      startTransition(() => {
        void load()
      })
    }
    window.addEventListener('guia-feed-rede-reload', onReload)
    window.addEventListener('guia-stories-bar-reload', onReload)
    return () => {
      window.removeEventListener('guia-feed-rede-reload', onReload)
      window.removeEventListener('guia-stories-bar-reload', onReload)
    }
  }, [load])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load()
    }
    const onFocus = () => {
      void load()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    window.addEventListener('pageshow', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('pageshow', onFocus)
    }
  }, [load])

  useEffect(() => {
    const onPerfil = () => void load()
    window.addEventListener('perfil-atualizado', onPerfil)
    return () => window.removeEventListener('perfil-atualizado', onPerfil)
  }, [load])

  if (hidden) return null

  if (!barMounted) {
    return <div aria-hidden className="h-[100px] shrink-0 border-b border-gray-200 bg-gray-100 pt-safe" />
  }

  const meuVisto = foiVisualizado(meuSlot.visualizado_por, userEmail)
  const meuTemStory = Boolean(meuSlot.storyId)

  const filaAutoresParaNavegacao = () => {
    const meuSlots = [`${meuUserId}|prof`, `${meuUserId}|emp`].filter((sk) => meuTemStory && meuUserId)
    const outros = rings.map((r) => r.slotKey).filter(Boolean)
    if (meuSlots.length) return [...meuSlots, ...outros.filter((sk) => !meuSlots.includes(sk))]
    return outros
  }

  return (
    <div className="border-b border-gray-200 bg-gray-100 pt-safe py-1.5">
      <div className="flex items-start gap-3 overflow-x-auto px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* Slot fixo estilo Instagram: foto do utilizador + criar story */}
        <div className="flex w-[76px] shrink-0 flex-col items-center gap-1">
          <div className="relative flex aspect-square w-[76px] items-center justify-center">
            <div
              className={`box-border w-full max-w-[76px] rounded-full p-[3px] ${
                meuTemStory && meuVisto ? 'bg-gray-300' : !meuTemStory ? 'border-2 border-gray-300/90 bg-white' : ''
              }`}
              style={meuTemStory && !meuVisto ? { background: STORY_RING_GRADIENT } : undefined}
            >
              <div className="rounded-full bg-white p-[2px]">
                {meuUserId ? (
                  meuTemStory ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (!meuSlot.storyId || !meuUserId) return
                        const filaAutores = filaAutoresParaNavegacao()
                        onOpenStory(meuSlot.storyId, { filaAutores, filaAutorIndex: 0 })
                      }}
                      className="relative block aspect-square w-full max-h-[68px] max-w-[68px] overflow-hidden rounded-full bg-gray-100"
                      aria-label="Ver seu story"
                    >
                      <AvatarImage
                        key={meuSlot.avatarUrl || 'def'}
                        src={meuSlot.avatarUrl}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="76px"
                        priority
                      />
                    </button>
                  ) : podeCriarStory ? (
                    <Link
                      href="/feed/story/criar"
                      className="relative block aspect-square w-full max-h-[68px] max-w-[68px] overflow-hidden rounded-full bg-gray-100"
                      aria-label="Criar seu story"
                    >
                      <AvatarImage
                        key={meuSlot.avatarUrl || 'def'}
                        src={meuSlot.avatarUrl}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="76px"
                        priority
                      />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (!podeInteragir) {
                          notificarSomenteLeitura()
                          return
                        }
                        avisarBloqueioFeed()
                      }}
                      className="relative block aspect-square w-full max-h-[68px] max-w-[68px] overflow-hidden rounded-full bg-gray-100"
                      aria-label="Criar seu story (bloqueado)"
                    >
                      <AvatarImage
                        key={meuSlot.avatarUrl || 'def'}
                        src={meuSlot.avatarUrl}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="76px"
                        priority
                      />
                    </button>
                  )
                ) : (
                  <div className="relative block aspect-square max-h-[68px] max-w-[68px] overflow-hidden rounded-full bg-gray-100" />
                )}
              </div>
            </div>
            {podeCriarStory ? (
              <Link
                href="/feed/story/criar"
                onClick={(e) => e.stopPropagation()}
                className="absolute -bottom-0.5 -right-0.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-[#0097b2] text-white shadow-md ring-2 ring-white"
                aria-label="Novo story"
              >
                <Plus size={16} strokeWidth={2.5} />
              </Link>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  if (!podeInteragir) {
                    notificarSomenteLeitura()
                    return
                  }
                  avisarBloqueioFeed()
                }}
                className="absolute -bottom-0.5 -right-0.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-gray-400 text-white shadow-md ring-2 ring-white"
                aria-label="Novo story (bloqueado)"
              >
                <Plus size={16} strokeWidth={2.5} />
              </button>
            )}
          </div>
          <span className="max-w-[5rem] truncate text-center text-xs leading-tight text-gray-700">Seu story</span>
        </div>

        {storiesBarLoading
          ? Array.from({ length: 6 }, (_, i) => (
              <div key={`story-skel-${i}`} className="flex w-[76px] shrink-0 flex-col items-center gap-1" aria-hidden>
                <div className="aspect-square w-[76px] max-w-[76px] animate-pulse rounded-full bg-gray-200" />
                <div className="h-3 w-14 animate-pulse rounded bg-gray-200" />
              </div>
            ))
          : rings.map((s) => (
              <StoryCircle
                key={s.id}
                id={s.id}
                label={s.label}
                avatarUrl={s.avatarUrl}
                visualizado_por={s.visualizado_por}
                userEmail={userEmail}
                onPress={() => {
                  const filaAutores = filaAutoresParaNavegacao()
                  const filaAutorIndex = s.slotKey ? filaAutores.indexOf(s.slotKey) : filaAutores.indexOf(s.autorId)
                  onOpenStory(s.id, {
                    filaAutores,
                    filaAutorIndex: filaAutorIndex >= 0 ? filaAutorIndex : 0,
                    storySlotKey: s.slotKey,
                  })
                }}
              />
            ))}
      </div>
      <PopupAvisoBloqueioConta
        aberto={avisoFeedAberto}
        onFechar={fecharAvisoBloqueioFeed}
        titulo={tituloBloqueioFeed}
        mensagem={mensagemBloqueioFeed}
      />
    </div>
  )
}
