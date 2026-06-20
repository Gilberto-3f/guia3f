'use client'

import { startTransition, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import AvatarImage from '@/components/AvatarImage'
import { Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  fetchFotoPerfilUsuario,
  fetchFotosPerfilPorUsuarioIds,
  pickAutorDisplay,
  STORY_RING_GRADIENT,
  visualizadoPorEmails,
} from '@/lib/feed-autor'
import { buscarPerfisPorIds } from '@/lib/perfil-utils'
import { isTipoVideoPost } from '@/lib/feedFiltroSeguidos'
import { fetchEmpresasGuiaRows } from '@/lib/feedSeguidosEmpresasFavoritas'
import { tentarProcessarPublicacoesAgendadas } from '@/lib/processarPublicacoesAgendadasClient'
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

function labelStoryDeAutor(d) {
  const h = d.username != null ? String(d.username).trim() : ''
  if (h && h !== 'usuario') return abreviarLabelStory(h.startsWith('@') ? h : `@${h.replace(/^@/, '')}`)
  const n = d.nome != null ? String(d.nome).trim() : ''
  if (n) return abreviarLabelStory(n)
  return abreviarLabelStory('Usuário')
}

/**
 * Username para o texto abaixo do anel: prioriza `nome_usuario` nos embeds (igual ao @ do feed).
 * @param {unknown} u linha de `usuarios` com turistas/profissionais/empresas
 */
function labelFromUsuarioRow(u) {
  if (!u || typeof u !== 'object') return abreviarLabelStory('Usuário')
  const row = /** @type {Record<string, unknown>} */ (u)
  const firstEmbed = (v) => {
    if (v == null) return null
    if (Array.isArray(v)) {
      const x = v[0]
      return x != null && typeof x === 'object' ? /** @type {Record<string, unknown>} */ (x) : null
    }
    return typeof v === 'object' ? /** @type {Record<string, unknown>} */ (v) : null
  }
  const t = firstEmbed(row.turistas)
  const p = firstEmbed(row.profissionais)
  const e = firstEmbed(row.empresas)
  const colUsername =
    typeof row.username === 'string' && row.username.trim() !== '' ? row.username.trim() : null
  const colUsernameOk = colUsername && colUsername.toLowerCase() !== 'usuario' ? colUsername : null
  /** Embeds primeiro (mesma fonte do @ no feed); `usuarios.username` só como fallback. */
  const raw =
    (t?.nome_usuario != null ? String(t.nome_usuario).trim() : null) ??
    (p?.nome_usuario != null ? String(p.nome_usuario).trim() : null) ??
    (e?.nome_usuario != null ? String(e.nome_usuario).trim() : null) ??
    colUsernameOk
  if (raw && raw.toLowerCase() !== 'usuario') {
    const out = raw.startsWith('@') ? raw : `@${raw.replace(/^@/, '')}`
    return abreviarLabelStory(out)
  }
  return abreviarLabelStory(labelStoryDeAutor(pickAutorDisplay(u)))
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
    await tentarProcessarPublicacoesAgendadas()

    const USUARIOS_MEU_SELECT = `
      id,
      email,
      role,
      turistas (nome_completo, nome_usuario, foto_perfil_url, foto_url),
      profissionais (nome_completo, nome_usuario, foto_perfil_url, foto_url),
      empresas (id, nome_fantasia, nome_usuario, foto_url)
    `

    /** @param {string} userId */
    const carregarMeuAvatar = async (userId) => {
      let meuAvatarUrl = await fetchFotoPerfilUsuario(supabase, userId)
      if (!meuAvatarUrl) {
        const { data: meU, error: meErr } = await supabase.from('usuarios').select(USUARIOS_MEU_SELECT).eq('id', userId).maybeSingle()
        if (!meErr && meU) {
          meuAvatarUrl = pickAutorDisplay(meU).foto_perfil_url
        }
      }
      return meuAvatarUrl
    }

    const [{ data: seguidosRows }, { data: storiesRows, error: storiesErr }, meuAvatarUrl] = await Promise.all([
      supabase.from('redecontatos').select('seguido_id').eq('seguidor_id', uid),
      supabase
        .from('stories')
        .select('id, autor_id, conteudo_url, visualizado_por, created_at, tipo, autor_tipo')
        .gt('expira_em', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(120),
      carregarMeuAvatar(uid),
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

    const seguidosIds = new Set((seguidosRows ?? []).map((r) => String(r.seguido_id)).filter(Boolean))

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

    const emps = empresasRows
    const empresaAutorSet = new Set((emps ?? []).map((e) => String(e.usuario_id)).filter(Boolean))

    /** Stories permitidos: o próprio utilizador, seguidos (não empresa) ou qualquer empresa; sem vídeo. */
    const storiesFiltradas = storiesValidas.filter((s) => {
      if (isTipoVideoPost(s.tipo)) return false
      const aid = String(s.autor_id)
      if (aid === uid) return true
      const isEmp = isAutorEmpresa(s.autor_tipo) || empresaAutorSet.has(aid)
      if (isEmp) return true
      return seguidosIds.has(aid)
    })

    /** Autores cujo story foi publicado como "empresa" (autor_tipo). */
    const autorStoryEmpresaSet = new Set(
      (storiesFiltradas ?? [])
        .filter((s) => isAutorEmpresa(s.autor_tipo))
        .map((s) => String(s.autor_id))
        .filter(Boolean)
    )

    /** Todos os stories por autor (foto), ordenados do mais antigo ao mais novo. */
    const storiesPorAutorArr = /** @type {Map<string, NonNullable<typeof storiesFiltradas>>} */ (new Map())
    for (const s of storiesFiltradas) {
      const aid = String(s.autor_id)
      if (!storiesPorAutorArr.has(aid)) storiesPorAutorArr.set(aid, [])
      storiesPorAutorArr.get(aid).push(s)
    }
    for (const arr of storiesPorAutorArr.values()) {
      ordenarStoriesPorCreatedAsc(arr)
    }

    const meuArr = storiesPorAutorArr.get(uid) ?? []
    const meuAbrirId = escolherIdStoryInicialPorEmail(meuArr, userEmail)
    setMeuSlot({
      avatarUrl: meuAvatarUrl,
      storyId: meuAbrirId,
      visualizado_por: visualizadoPorConsolidadoParaAnel(meuArr, userEmail),
    })

    /** @type {string[]} */
    const ordered = []
    const seen = new Set()

    const pushAid = (aid) => {
      if (ordered.length >= MAX_STORY_RINGS) return false
      if (seen.has(aid) || !storiesPorAutorArr.has(aid)) return false
      ordered.push(aid)
      seen.add(aid)
      return true
    }

    seen.add(uid)

    const latestStoryMs = (aid) => {
      const arr = storiesPorAutorArr.get(aid)
      if (!arr?.length) return 0
      const last = arr[arr.length - 1]
      return new Date(String(last.created_at ?? 0)).getTime()
    }

    const autoresOrdenados = [...storiesPorAutorArr.keys()]
      .filter((aid) => aid !== uid)
      .sort((a, b) => latestStoryMs(b) - latestStoryMs(a))

    for (const aid of autoresOrdenados) {
      if (ordered.length >= MAX_STORY_RINGS) break
      pushAid(aid)
    }

    const labels = /** @type {Record<string, string>} */ ({})
    const previews = /** @type {Record<string, string | null>} */ ({})
    for (const e of emps ?? []) {
      const uid = String(e.usuario_id)
      const podeRotularComoEmpresa = autorStoryEmpresaSet.has(uid) || (simulandoEmpresa && uid === String(session.user.id))
      if (podeRotularComoEmpresa) {
        labels[uid] = labelStoryEmpresa(e)
        previews[uid] = e.foto_url != null ? String(e.foto_url) : null
      }
    }
    const precisaPerfil = ordered.filter((aid) => labels[aid] == null)
    const usuariosPromise =
      precisaPerfil.length > 0
        ? supabase.from('usuarios').select(USUARIOS_MEU_SELECT).in('id', precisaPerfil)
        : Promise.resolve({ data: null, error: null })

    const { data: usuariosRows, error: uErr } = await usuariosPromise
    if (uErr) {
      console.error('[StoriesBar] usuarios (perfis story):', uErr)
    }
    if (!uErr && usuariosRows?.length) {
      for (const u of usuariosRows) {
        const d = pickAutorDisplay(u)
        const id = String(u.id)
        labels[id] = labelFromUsuarioRow(u)
        previews[id] = d.foto_perfil_url
      }
    }

    const semFoto = ordered.filter((aid) => !previews[aid])
    if (semFoto.length > 0) {
      const fotosMap = await fetchFotosPerfilPorUsuarioIds(supabase, semFoto)
      for (const aid of semFoto) {
        const url = fotosMap.get(aid)
        if (url) previews[aid] = url
      }
    }

    const semLabel = ordered.filter((aid) => labels[aid] == null)
    if (semLabel.length > 0) {
      const perfisBusca = await buscarPerfisPorIds(supabase, semLabel)
      for (const p of perfisBusca) {
        const id = String(p.usuario_id ?? '')
        if (!id) continue
        const nu = (p.username ?? '').trim()
        const nome = (p.nome ?? '').trim()
        if (nu) {
          const h = formatStoryHandle(nu)
          if (h) labels[id] = abreviarLabelStory(h)
        } else if (nome) {
          labels[id] = abreviarLabelStory(nome)
        }
        if (!previews[id] && p.foto_url) previews[id] = p.foto_url
      }
      for (const aid of semLabel) {
        if (labels[aid] == null) labels[aid] = 'Usuário'
      }
    }

    const built = ordered
      .map((aid) => {
        const arr = storiesPorAutorArr.get(aid)
        if (!arr?.length) return null
        const abrirId = escolherIdStoryInicialPorEmail(arr, userEmail)
        if (!abrirId) return null
        const avatarUrl = previews[aid] ?? null
        return {
          id: abrirId,
          autorId: aid,
          label: labels[aid] ?? 'Usuário',
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
    const outros = rings.map((r) => r.autorId).filter(Boolean)
    if (meuTemStory && meuUserId) return [meuUserId, ...outros]
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
                  const filaAutorIndex = filaAutores.indexOf(s.autorId)
                  onOpenStory(s.id, {
                    filaAutores,
                    filaAutorIndex: filaAutorIndex >= 0 ? filaAutorIndex : 0,
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
