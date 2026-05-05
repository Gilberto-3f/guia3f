'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ClipboardList, Flag, Heart, Link2, MoreHorizontal, Play, Volume2, VolumeX, X } from 'lucide-react'
import BotaoSeguir from '@/components/BotaoSeguir'
import { supabase } from '@/lib/supabase'
import {
  fetchFotoPerfilUsuario,
  fetchNomeUsuarioParaStory,
  visualizadoPorEmails,
} from '@/lib/feed-autor'
import { getPerfilHref } from '@/lib/perfil-utils'
import AvatarImage from '@/components/AvatarImage'
import StoryCanvas from '@/components/StoryCanvas'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'

const STORY_VIEW_MS = 15000
const SWIPE_DOWN_PX = 96
const SWIPE_SIDE_PX = 56

const CATEGORIAS_DENUNCIA_STORY = [
  { id: 'Conteúdo impróprio', label: 'Conteúdo impróprio' },
  { id: 'Spam', label: 'Spam' },
  { id: 'Discurso de ódio', label: 'Discurso de ódio' },
  { id: 'Outro', label: 'Outro' },
]

/**
 * @param {{ usuario_id?: string } | string | null | undefined} entry
 */
function entryUsuarioId(entry) {
  if (entry == null) return null
  if (typeof entry === 'string') return entry.trim() || null
  if (typeof entry === 'object' && 'usuario_id' in entry && entry.usuario_id != null) return String(entry.usuario_id)
  return null
}

/**
 * @param {unknown} raw
 * @returns {{ usuario_id: string, created_at?: string }[]}
 */
function parseCurtidasStory(raw) {
  if (raw == null) return []
  if (!Array.isArray(raw)) return []
  const out = []
  for (const item of raw) {
    const uid = entryUsuarioId(item)
    if (uid) {
      const created_at =
        typeof item === 'object' && item && 'created_at' in item && item.created_at != null ? String(item.created_at) : undefined
      out.push({ usuario_id: uid, created_at })
    }
  }
  return out
}

/**
 * @param {unknown} row
 * @returns {boolean | null} null se a RPC não trouxe flag interpretável
 */
function readLikedFlagFromRpc(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null
  if (!('liked' in row)) return null
  const v = /** @type {Record<string, unknown>} */ (row).liked
  if (v === true) return true
  if (v === false) return false
  if (v === 'true' || v === 1) return true
  if (v === 'false' || v === 0) return false
  return null
}

/**
 * Normaliza `curtidas` vindas da RPC/PostgREST (array, string JSON, etc.).
 * @param {unknown} raw
 * @returns {unknown[] | null} null se não for possível obter array
 */
function normalizarCurtidasRawParaArray(raw) {
  if (raw == null) return null
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw)
      return Array.isArray(p) ? p : null
    } catch {
      return null
    }
  }
  return null
}

/**
 * Última curtida mais recente por utilizador → ordena ids do mais recente ao mais antigo.
 * @param {{ usuario_id: string, created_at?: string }[]} curtidasLista
 * @returns {string[]}
 */
function ordenarUsuarioIdsPorCurtidaRecente(curtidasLista) {
  /** @type {Map<string, number>} */
  const lastTs = new Map()
  for (const c of curtidasLista) {
    const uid = c.usuario_id
    if (!uid) continue
    const t = c.created_at ? Date.parse(c.created_at) : NaN
    const ts = Number.isFinite(t) ? t : 0
    const prev = lastTs.get(uid)
    if (prev == null || ts >= prev) lastTs.set(uid, ts)
  }
  const ids = [...new Set(curtidasLista.map((c) => c.usuario_id).filter(Boolean))]
  return ids.sort((a, b) => (lastTs.get(b) ?? 0) - (lastTs.get(a) ?? 0))
}

/**
 * @param {Record<string, unknown> | null | undefined} p linha `perfis_para_busca`
 */
function rotuloDePerfilStory(p) {
  if (!p || typeof p !== 'object') return 'Usuário'
  const username = p.username != null ? String(p.username).trim() : ''
  if (username && username.toLowerCase() !== 'usuario') {
    return username.startsWith('@') ? username : `@${username.replace(/^@/, '')}`
  }
  const nome = p.nome != null ? String(p.nome).trim() : ''
  return nome || 'Usuário'
}

/** @param {string} rotulo */
function iniciaisRotulo(rotulo) {
  const s = String(rotulo ?? '')
    .replace(/^@/, '')
    .trim()
  if (!s) return '?'
  const parts = s.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2)
  return s.slice(0, 2).toUpperCase()
}

/**
 * @param {{
 *   story: {
 *     id: string
 *     tipo?: string
 *     conteudo_url: string
 *     texto_sobreposto: {
 *       texto?: string | null
 *       posicao_x?: number
 *       posicao_y?: number
 *       link_posicao_x?: number
 *       link_posicao_y?: number
 *       fundo_fit?: 'contain' | 'cover'
 *       fundo_scale?: number
 *       fundo_pan_x_pct?: number
 *       fundo_pan_y_pct?: number
 *       texto_scale?: number
 *     } | null
 *     link: string | null
 *     duracao_segundos?: number | null
 *     autorUsuarioId?: string | null
 *     curtidas?: unknown
 *     visualizado_por?: unknown
 *   } | null
 *   userEmail: string | null
 *   meuUsuarioId: string | null
 *   onFechar: () => void
 *   onVisualizado?: () => void
 *   storyQueueLength?: number
 *   storyQueueIndex?: number
 *   onIrAnterior?: () => void
 *   onIrProximo?: () => void
 *   onTimerFim?: () => void
 *   timerPlaybackKey?: number
 * }} props
 * @remarks A ordem da fila (mais antigo → mais recente) e o índice inicial vêm do autor do feed
 *   (`montarPackStoryAutor` em `feed/page.tsx`), não deste componente.
 */
export default function StoryViewer({
  story,
  userEmail,
  meuUsuarioId = null,
  onFechar,
  onVisualizado,
  storyQueueLength = 1,
  storyQueueIndex = 0,
  onIrAnterior,
  onIrProximo,
  onTimerFim,
  timerPlaybackKey = 0,
}) {
  const { modoAtivo, perfilSimulado, contextoEmpresaId } = useModoApresentacao()
  const videoRef = useRef(/** @type {HTMLVideoElement | null} */ (null))
  const rootRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const swipeRef = useRef(/** @type {{ x0: number, y0: number, t0: number } | null} */ (null))
  const timerStartRef = useRef(/** @type {number | null} */ (null))
  const rafRef = useRef(/** @type {number | null} */ (null))
  /** Dedo a segurar: temporizador congelado até `pointerup`. */
  const holdPausedRef = useRef(false)
  const frozenElapsedRef = useRef(0)
  const onTimerFimRef = useRef(onTimerFim)
  const onFecharRef = useRef(onFechar)
  const playingRef = useRef(true)

  const [muted, setMuted] = useState(true)
  const [videoProgress, setVideoProgress] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [fotoAutor, setFotoAutor] = useState(/** @type {string | null} */ (null))
  const [rotuloAutor, setRotuloAutor] = useState(/** @type {string | null} */ (null))
  const [barraProgresso, setBarraProgresso] = useState(0)
  const [curtidasLista, setCurtidasLista] = useState(/** @type {{ usuario_id: string, created_at?: string }[]} */ ([]))
  const [curtirBusy, setCurtirBusy] = useState(false)
  const [modalInsights, setModalInsights] = useState(false)
  const [curtidasInsights, setCurtidasInsights] = useState(
    /** @type {{ usuario_id: string, rotulo: string, foto: string | null, tipo?: string | null, empresa_id?: string | null }[]} */ ([])
  )
  const [visualizacoesInsights, setVisualizacoesInsights] = useState(
    /** @type {{ usuario_id: string | null, email: string | null, rotulo: string, foto: string | null, tipo?: string | null, empresa_id?: string | null }[]} */ ([])
  )
  const [carregandoInsights, setCarregandoInsights] = useState(false)
  const [menuMaisOpcoes, setMenuMaisOpcoes] = useState(false)
  const [modalDenunciar, setModalDenunciar] = useState(false)
  const [denCategoria, setDenCategoria] = useState('Conteúdo impróprio')
  const [denTexto, setDenTexto] = useState('')
  const [denBusy, setDenBusy] = useState(false)
  const [toastMsg, setToastMsg] = useState(/** @type {string | null} */ (null))
  const [seguindoAutor, setSeguindoAutor] = useState(/** @type {boolean | null} */ (null))

  const uid = meuUsuarioId != null && meuUsuarioId !== '' ? String(meuUsuarioId) : null
  const curtiu = uid ? curtidasLista.some((c) => c.usuario_id === uid) : false

  useEffect(() => {
    onTimerFimRef.current = onTimerFim
    onFecharRef.current = onFechar
  }, [onTimerFim, onFechar])

  useEffect(() => {
    if (!story?.id || !userEmail) return
    void (async () => {
      const { error } = await supabase.rpc('append_story_viewer', { sid: story.id, viewer_email: userEmail })
      if (!error) onVisualizado?.()
    })()
  }, [story?.id, userEmail, onVisualizado])

  /* Só ressincroniza com o servidor quando muda o story (id). Evita o pai re-renderizar
   * com o mesmo `story.curtidas` desatualizado e apagar o update otimista da curtida. */
  useEffect(() => {
    if (!story?.id) return
    setCurtidasLista(parseCurtidasStory(story?.curtidas))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- curtidas só ao trocar de story
  }, [story?.id])

  useEffect(() => {
    if (!modalInsights || !story?.id) {
      if (!modalInsights) {
        setCurtidasInsights([])
        setVisualizacoesInsights([])
      }
      return
    }
    let cancel = false
    setCarregandoInsights(true)

    void (async () => {
      const emailsVis = visualizadoPorEmails(story.visualizado_por)
      /** Visualizações mais recentes primeiro (último append no JSON = mais recente). */
      const visRecentFirst = /** @type {string[]} */ ([])
      const seenEm = new Set()
      for (let i = emailsVis.length - 1; i >= 0; i -= 1) {
        const raw = String(emailsVis[i] ?? '').trim()
        if (!raw) continue
        const k = raw.toLowerCase()
        if (seenEm.has(k)) continue
        seenEm.add(k)
        visRecentFirst.push(raw)
      }

      const likeOrderRecent = ordenarUsuarioIdsPorCurtidaRecente(curtidasLista)
      /** @type {Map<string, number>} */
      const lastLikeTs = new Map()
      for (const c of curtidasLista) {
        const uid = c.usuario_id
        if (!uid) continue
        const t = c.created_at ? Date.parse(c.created_at) : NaN
        const ts = Number.isFinite(t) ? t : 0
        const prev = lastLikeTs.get(uid)
        if (prev == null || ts >= prev) lastLikeTs.set(uid, ts)
      }

      const visSet = new Set(emailsVis.map((e) => String(e).trim().toLowerCase()).filter(Boolean))

      /** @type {Map<string, string>} */
      const emailByUserId = new Map()
      if (likeOrderRecent.length > 0) {
        const { data: likerRows, error: le } = await supabase.from('usuarios').select('id, email').in('id', likeOrderRecent)
        if (le) console.error('[StoryViewer] insights likers:', le)
        for (const r of likerRows ?? []) {
          const id = r?.id != null ? String(r.id) : ''
          const em = r?.email != null ? String(r.email).trim() : ''
          if (id && em) emailByUserId.set(id, em)
        }
      }

      /** @type {Map<string, { id: string, email: string }>} */
      const userByEmailLower = new Map()
      if (visRecentFirst.length > 0) {
        const { data: viewerRows, error: ve } = await supabase
          .from('usuarios')
          .select('id, email')
          .in('email', visRecentFirst)
        if (ve) console.error('[StoryViewer] insights viewers:', ve)
        for (const r of viewerRows ?? []) {
          const id = r?.id != null ? String(r.id) : ''
          const em = r?.email != null ? String(r.email).trim() : ''
          if (id && em) userByEmailLower.set(em.toLowerCase(), { id, email: em })
        }
      }

      const allIds = /** @type {string[]} */ ([
        ...likeOrderRecent,
        ...[...userByEmailLower.values()].map((u) => u.id).filter((id) => !likeOrderRecent.includes(id)),
      ])
      const uniqIds = [...new Set(allIds.filter(Boolean))]

      /** @type {Map<string, Record<string, unknown>>} */
      const perfilPorId = new Map()
      if (uniqIds.length > 0) {
        const { data: perfis, error: pe } = await supabase
          .from('perfis_para_busca')
          .select('usuario_id, empresa_id, tipo, foto_url, nome, username')
          .in('usuario_id', uniqIds)
        if (pe) console.error('[StoryViewer] insights perfis:', pe)
        for (const p of perfis ?? []) {
          const uid = p?.usuario_id != null ? String(p.usuario_id) : ''
          if (uid) perfilPorId.set(uid, /** @type {Record<string, unknown>} */ (p))
        }
      }

      const montarLinha = async (usuario_id) => {
        const p = perfilPorId.get(usuario_id)
        let rotulo = rotuloDePerfilStory(p ?? null)
        if (rotulo === 'Usuário') {
          const nu = await fetchNomeUsuarioParaStory(supabase, usuario_id)
          if (nu) rotulo = nu.startsWith('@') ? nu : `@${nu.replace(/^@/, '')}`
          else {
            const { data: emp } = await supabase
              .from('empresas')
              .select('nome_fantasia')
              .eq('usuario_id', usuario_id)
              .maybeSingle()
            rotulo = emp?.nome_fantasia != null ? String(emp.nome_fantasia).trim() : 'Usuário'
          }
        }
        let foto = p?.foto_url != null ? String(p.foto_url).trim() : null
        if (!foto) foto = await fetchFotoPerfilUsuario(supabase, usuario_id)
        const tipo = p?.tipo != null ? String(p.tipo) : null
        const empresa_id = p?.empresa_id != null ? String(p.empresa_id) : null
        return { usuario_id, rotulo, foto, tipo, empresa_id }
      }

      const sortedLikeIds = [...likeOrderRecent].sort((a, b) => {
        const emA = (emailByUserId.get(a) ?? '').toLowerCase()
        const emB = (emailByUserId.get(b) ?? '').toLowerCase()
        const aViu = emA && visSet.has(emA)
        const bViu = emB && visSet.has(emB)
        if (aViu !== bViu) return aViu ? -1 : 1
        return (lastLikeTs.get(b) ?? 0) - (lastLikeTs.get(a) ?? 0)
      })

      const curtRows = await Promise.all(sortedLikeIds.map((id) => montarLinha(id)))

      const visRows = await Promise.all(
        visRecentFirst.map(async (emRaw) => {
          const em = String(emRaw).trim()
          const u = userByEmailLower.get(em.toLowerCase())
          if (u) {
            const line = await montarLinha(u.id)
            return { usuario_id: line.usuario_id, email: em, rotulo: line.rotulo, foto: line.foto, tipo: line.tipo, empresa_id: line.empresa_id }
          }
          return {
            usuario_id: null,
            email: em,
            rotulo: em,
            foto: null,
            tipo: null,
            empresa_id: null,
          }
        })
      )

      const visSorted = [...visRows].sort((a, b) => {
        const aCurtiu = a.usuario_id && likeOrderRecent.includes(a.usuario_id)
        const bCurtiu = b.usuario_id && likeOrderRecent.includes(b.usuario_id)
        if (aCurtiu !== bCurtiu) return aCurtiu ? -1 : 1
        const ia = visRecentFirst.findIndex((e) => e.toLowerCase() === (a.email ?? '').toLowerCase())
        const ib = visRecentFirst.findIndex((e) => e.toLowerCase() === (b.email ?? '').toLowerCase())
        return ia - ib
      })

      if (cancel) return
      setCurtidasInsights(curtRows)
      setVisualizacoesInsights(visSorted)
      setCarregandoInsights(false)
    })()
    return () => {
      cancel = true
    }
  }, [modalInsights, story?.id, story?.visualizado_por, curtidasLista])

  useEffect(() => {
    playingRef.current = playing
  }, [playing])

  useEffect(() => {
    const v = videoRef.current
    if (!v || String(story?.tipo) !== 'video') return
    void v.play().catch(() => setPlaying(false))
  }, [story?.tipo, story?.conteudo_url])

  useEffect(() => {
    const v = videoRef.current
    if (v) v.muted = muted
  }, [muted])

  const autorId = story?.autorUsuarioId != null && story.autorUsuarioId !== '' ? String(story.autorUsuarioId) : null
  const autorEhEu = Boolean(uid && autorId && uid === autorId)
  const podeVerEmpresaPreviewDoAutor = Boolean(autorEhEu && modoAtivo && perfilSimulado?.tipo === 'empresa' && contextoEmpresaId)
  const hrefAutor = autorId
    ? podeVerEmpresaPreviewDoAutor
      ? `/empresa/${String(contextoEmpresaId)}`
      : `/perfil/${autorId}`
    : ''

  useEffect(() => {
    if (!autorId) {
      setFotoAutor(null)
      return
    }
    let ativo = true
    void fetchFotoPerfilUsuario(supabase, autorId).then((url) => {
      if (ativo) setFotoAutor(url)
    })
    return () => {
      ativo = false
    }
  }, [autorId])

  useEffect(() => {
    if (!autorId) {
      setRotuloAutor(null)
      return
    }
    let ativo = true
    void (async () => {
      const handle = await fetchNomeUsuarioParaStory(supabase, autorId)
      if (!ativo) return
      if (handle) {
        const h = handle.trim()
        setRotuloAutor(h.startsWith('@') ? h : `@${h.replace(/^@/, '')}`)
        return
      }
      setRotuloAutor('Usuário')
    })()
    return () => {
      ativo = false
    }
  }, [autorId])

  const isVideo = String(story?.tipo ?? '') === 'video'
  const duracaoStoryMs =
    isVideo && story?.duracao_segundos != null && Number(story.duracao_segundos) > 0
      ? Math.min(STORY_VIEW_MS, Number(story.duracao_segundos) * 1000)
      : STORY_VIEW_MS

  const fecharTimer = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    timerStartRef.current = null
    holdPausedRef.current = false
  }, [])

  const scheduleTimerTick = useCallback(() => {
    const duracaoMs = Math.max(1, duracaoStoryMs)
    const tick = () => {
      const t0 = timerStartRef.current
      if (t0 == null) return
      const elapsed = performance.now() - t0
      const p = Math.min(100, (elapsed / duracaoMs) * 100)
      setBarraProgresso(p)
      if (elapsed >= duracaoMs) {
        fecharTimer()
        const f = onTimerFimRef.current
        if (typeof f === 'function') f()
        else onFecharRef.current()
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [duracaoStoryMs, fecharTimer])

  useEffect(() => {
    if (!story?.id) return
    holdPausedRef.current = false
    timerStartRef.current = performance.now()
    setBarraProgresso(0)
    scheduleTimerTick()
    return () => {
      fecharTimer()
    }
  }, [story?.id, storyQueueIndex, duracaoStoryMs, timerPlaybackKey, scheduleTimerTick, fecharTimer])

  const pausarPorSegurar = useCallback(() => {
    if (holdPausedRef.current) return
    const t0 = timerStartRef.current
    if (t0 == null) return
    holdPausedRef.current = true
    frozenElapsedRef.current = performance.now() - t0
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    const v = videoRef.current
    if (v && isVideo && !v.paused) v.pause()
  }, [isVideo])

  const retomarAposSoltar = useCallback(() => {
    if (!holdPausedRef.current) return
    holdPausedRef.current = false
    timerStartRef.current = performance.now() - frozenElapsedRef.current
    scheduleTimerTick()
    const v = videoRef.current
    if (v && isVideo && playingRef.current) void v.play().catch(() => setPlaying(false))
  }, [isVideo, scheduleTimerTick])

  useEffect(() => {
    const el = rootRef.current
    if (!el) return

    const onTouchStart = (e) => {
      if (e.touches.length !== 1) return
      const t = e.touches[0]
      const target = /** @type {HTMLElement | null} */ (e.target)
      if (target?.closest?.('[data-story-footer]')) return
      if (target?.closest?.('a[href]')) return
      swipeRef.current = { x0: t.clientX, y0: t.clientY, t0: performance.now() }
    }

    const onTouchEnd = (e) => {
      const s = swipeRef.current
      swipeRef.current = null
      if (!s || e.changedTouches.length === 0) return
      const x = e.changedTouches[0].clientX
      const y = e.changedTouches[0].clientY
      const dx = x - s.x0
      const dy = y - s.y0
      // Swipe down: fechar
      if (dy > SWIPE_DOWN_PX) {
        onFechar()
        return
      }
      // Swipe lateral: navegar (dominância horizontal)
      if (Math.abs(dx) >= SWIPE_SIDE_PX && Math.abs(dx) > Math.abs(dy) * 1.2) {
        if (dx < 0) onIrProximo?.()
        else onIrAnterior?.()
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [onFechar, onIrAnterior, onIrProximo])

  const toggleCurtida = async () => {
    if (!story?.id || !uid || curtirBusy) return
    setCurtirBusy(true)
    const prevCurtidas = curtidasLista
    const jaCurtiu = prevCurtidas.some((c) => c.usuario_id === uid)
    // Optimistic UI: pinta/despinta imediatamente.
    if (jaCurtiu) {
      setCurtidasLista((prev) => prev.filter((c) => c.usuario_id !== uid))
    } else {
      setCurtidasLista((prev) => (prev.some((c) => c.usuario_id === uid) ? prev : [...prev, { usuario_id: uid }]))
    }
    try {
      const { data, error } = await supabase.rpc('toggle_story_curtida', { p_story_id: story.id })
      if (error) {
        console.error(error)
        setCurtidasLista(prevCurtidas)
        return
      }
      let payload = data
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload)
        } catch {
          payload = null
        }
      }
      if (Array.isArray(payload)) {
        setCurtidasLista(parseCurtidasStory(payload))
        return
      }
      const row =
        payload && typeof payload === 'object' && !Array.isArray(payload) ? /** @type {Record<string, unknown>} */ (payload) : null
      if (!row) {
        /* RPC sem corpo interpretável: mantém estado otimista (não cair no “remove curtida”). */
        return
      }

      const liked = readLikedFlagFromRpc(row)
      const arrRaw = normalizarCurtidasRawParaArray(row.curtidas)

      if (arrRaw != null) {
        const parsed = parseCurtidasStory(arrRaw)
        if (parsed.length > 0) {
          setCurtidasLista(parsed)
          return
        }
        if (liked === true) {
          setCurtidasLista((prev) => (prev.some((c) => c.usuario_id === uid) ? prev : [...prev, { usuario_id: uid }]))
          return
        }
        if (liked === false) {
          setCurtidasLista((prev) => prev.filter((c) => c.usuario_id !== uid))
          return
        }
        return
      }

      if (liked === true) {
        setCurtidasLista((prev) => (prev.some((c) => c.usuario_id === uid) ? prev : [...prev, { usuario_id: uid }]))
      } else if (liked === false) {
        setCurtidasLista((prev) => prev.filter((c) => c.usuario_id !== uid))
      }
    } finally {
      setCurtirBusy(false)
    }
  }

  const souAutor = Boolean(uid && autorId && uid === autorId)

  useEffect(() => {
    setMenuMaisOpcoes(false)
    setModalDenunciar(false)
    setDenTexto('')
    setDenCategoria('Conteúdo impróprio')
  }, [story?.id])

  useEffect(() => {
    if (!toastMsg) return undefined
    const t = window.setTimeout(() => setToastMsg(null), 4500)
    return () => window.clearTimeout(t)
  }, [toastMsg])

  useEffect(() => {
    if (!uid || !autorId || souAutor) {
      setSeguindoAutor(null)
      return undefined
    }
    let cancel = false
    void (async () => {
      try {
        const { data } = await supabase
          .from('redecontatos')
          .select('seguido_id')
          .eq('seguidor_id', uid)
          .eq('seguido_id', autorId)
          .maybeSingle()
        if (!cancel) setSeguindoAutor(Boolean(data))
      } catch {
        if (!cancel) setSeguindoAutor(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [uid, autorId, souAutor, story?.id])

  if (!story) return null

  const tx = story.texto_sobreposto && typeof story.texto_sobreposto === 'object' && !Array.isArray(story.texto_sobreposto)
    ? /** @type {{ texto?: string | null, posicao_x?: number, posicao_y?: number, link_posicao_x?: number, link_posicao_y?: number, fundo_fit?: string, fundo_scale?: number, fundo_pan_x_pct?: number, fundo_pan_y_pct?: number, texto_scale?: number }} */ (
        story.texto_sobreposto
      )
    : null
  const px = typeof tx?.posicao_x === 'number' ? tx.posicao_x : 50
  const py = typeof tx?.posicao_y === 'number' ? tx.posicao_y : 70
  const linkX = typeof tx?.link_posicao_x === 'number' ? tx.link_posicao_x : 50
  const linkY = typeof tx?.link_posicao_y === 'number' ? tx.link_posicao_y : 86
  const fundo = {
    scale: typeof tx?.fundo_scale === 'number' ? tx.fundo_scale : 1,
    pan_x_pct: typeof tx?.fundo_pan_x_pct === 'number' ? tx.fundo_pan_x_pct : 0,
    pan_y_pct: typeof tx?.fundo_pan_y_pct === 'number' ? tx.fundo_pan_y_pct : 0,
  }
  const imageObjectFit = tx?.fundo_fit === 'contain' ? 'contain' : 'cover'
  const legendaStr = tx?.texto != null ? String(tx.texto).trim() : ''
  const linkStr = story.link != null ? String(story.link).trim() : ''
  const textoScale = typeof tx?.texto_scale === 'number' && Number.isFinite(tx.texto_scale) ? tx.texto_scale : 1
  const emailsVisualizacao = visualizadoPorEmails(story.visualizado_por)

  const enviarDenunciaStory = async () => {
    const motivoTrim = denCategoria.trim().slice(0, 100)
    const descTrim = denTexto.trim().slice(0, 300)
    if (!motivoTrim || !descTrim) {
      setToastMsg('Preencha o motivo e a descrição.')
      return
    }
    setDenBusy(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.user?.id) {
        setToastMsg('Inicie sessão para denunciar.')
        return
      }
      const { error } = await supabase.from('denuncias').insert({
        denunciante_id: session.user.id,
        denunciado_id: story.id,
        denunciado_tipo: 'story',
        motivo: motivoTrim,
        descricao: descTrim,
        status: 'pendente',
      })
      if (error) throw error
      setModalDenunciar(false)
      setMenuMaisOpcoes(false)
      setDenTexto('')
      setToastMsg('Denúncia enviada. Nossa equipe irá analisar.')
    } catch (e) {
      console.error(e)
      setToastMsg('Não foi possível enviar a denúncia. Tente novamente.')
    } finally {
      setDenBusy(false)
    }
  }

  /**
   * @param {{ usuario_id: string | null, rotulo: string, foto: string | null, tipo?: string | null, empresa_id?: string | null }} row
   * @param {string} key
   */
  const linhaInsight = (row, key) => {
    const href = row.usuario_id
      ? getPerfilHref({
          usuario_id: String(row.usuario_id),
          tipo: String(row.tipo ?? ''),
          empresa_id: row.empresa_id != null ? String(row.empresa_id) : null,
          role: row.empresa_id ? 'empresa' : undefined,
        })
      : null
    const avatarInner = row.foto ? (
      <AvatarImage src={row.foto} alt="" width={44} height={44} className="h-full w-full object-cover" />
    ) : (
      <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#0097b2]/80 to-[#006b7d] text-[11px] font-bold uppercase tracking-wide text-white">
        {iniciaisRotulo(row.rotulo)}
      </span>
    )
    const corpo = (
      <div className="flex items-center gap-3 rounded-xl px-1 py-2 transition hover:bg-white/5">
        <span className="relative block h-11 w-11 shrink-0 overflow-hidden rounded-full bg-white/15 ring-1 ring-white/10">
          {avatarInner}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{row.rotulo}</span>
      </div>
    )
    if (href) {
      return (
        <li key={key}>
          <Link href={href} className="block" onClick={() => setModalInsights(false)}>
            {corpo}
          </Link>
        </li>
      )
    }
    return <li key={key}>{corpo}</li>
  }

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      void v.play()
      setPlaying(true)
    } else {
      v.pause()
      setPlaying(false)
    }
  }

  const onTimeUpdate = () => {
    const v = videoRef.current
    if (!v || !v.duration) return
    setVideoProgress((v.currentTime / v.duration) * 100)
  }

  const headerLeft = autorId ? (
    <Link
      href={hrefAutor}
      className="flex min-w-0 max-w-[78vw] items-center gap-2 py-1 text-white"
    >
      <span className="relative block h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white/25 ring-2 ring-white/30">
        {fotoAutor ? (
          <AvatarImage src={fotoAutor} alt="" width={36} height={36} className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-xs text-white/80">?</span>
        )}
      </span>
      <span className="truncate text-sm font-semibold tracking-tight drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
        {rotuloAutor ?? '…'}
      </span>
    </Link>
  ) : (
    <span />
  )

  const headerExtras = isVideo ? (
    <button
      type="button"
      onClick={() => setMuted((m) => !m)}
      className="rounded-full bg-black/35 p-2 text-white backdrop-blur-sm"
      aria-label={muted ? 'Ativar som' : 'Silenciar'}
    >
      {muted ? <VolumeX size={22} /> : <Volume2 size={22} />}
    </button>
  ) : null

  return (
    <div ref={rootRef} className="fixed inset-0 z-[100] flex flex-col bg-black">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-30 pt-[max(0.35rem,env(safe-area-inset-top))]"
        aria-hidden
      >
        {storyQueueLength <= 1 ? (
          <div className="h-0.5 w-full bg-white/25">
            <div className="h-full bg-white" style={{ width: `${barraProgresso}%` }} />
          </div>
        ) : (
          <div className="flex gap-1 px-1.5">
            {Array.from({ length: storyQueueLength }).map((_, i) => (
              <div key={i} className="h-0.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/25">
                <div
                  className="h-full rounded-full bg-white"
                  style={{
                    width:
                      i < storyQueueIndex ? '100%' : i === storyQueueIndex ? `${barraProgresso}%` : '0%',
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {!isVideo ? (
        <div className="relative min-h-0 flex-1">
          <div className="absolute inset-0">
            <StoryCanvas
              layout="viewerCover"
              imageObjectFit={imageObjectFit}
              mediaSrc={story.conteudo_url}
              legenda={legendaStr}
              posicaoLegenda={{ x: px, y: py }}
              linkUrl={linkStr}
              posicaoLink={{ x: linkX, y: linkY }}
              fundo={fundo}
              textoScale={textoScale}
              linkHref={linkStr || null}
            />
          </div>
          {typeof onIrAnterior === 'function' ? (
            <button
              type="button"
              className="absolute bottom-32 left-0 top-20 z-[14] w-[min(28%,140px)] max-w-[140px] cursor-pointer bg-transparent"
              aria-label="Story anterior"
              onClick={() => onIrAnterior()}
            />
          ) : null}
          {typeof onIrProximo === 'function' ? (
            <button
              type="button"
              className="absolute bottom-32 right-0 top-20 z-[14] w-[min(28%,140px)] max-w-[140px] cursor-pointer bg-transparent"
              aria-label="Story seguinte"
              onClick={() => onIrProximo()}
            />
          ) : null}
          <div
            className="absolute inset-x-[min(28%,140px)] top-20 z-[13] touch-none bg-transparent"
            onPointerDown={(e) => {
              if (e.pointerType === 'mouse' && e.button !== 0) return
              e.currentTarget.setPointerCapture(e.pointerId)
              pausarPorSegurar()
            }}
            onPointerUp={(e) => {
              retomarAposSoltar()
              try {
                e.currentTarget.releasePointerCapture(e.pointerId)
              } catch {
                /* já libertado */
              }
            }}
            onPointerCancel={(e) => {
              retomarAposSoltar()
              try {
                e.currentTarget.releasePointerCapture(e.pointerId)
              } catch {
                /* já libertado */
              }
            }}
            aria-hidden
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/55 to-transparent pt-[max(0.75rem,env(safe-area-inset-top))] pb-10">
            <div className="pointer-events-auto flex items-start justify-between gap-2 px-3">
              <div className="min-w-0">{headerLeft}</div>
              <div className="flex shrink-0 items-center gap-2 pr-1">{headerExtras}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/55 to-transparent pt-[max(0.75rem,env(safe-area-inset-top))] pb-12">
            <div className="pointer-events-auto flex items-start justify-between gap-2 px-3">
              <div className="min-w-0">{headerLeft}</div>
              <div className="flex shrink-0 items-center gap-2 pr-1">{headerExtras}</div>
            </div>
          </div>
          <div className="relative min-h-0 flex-1">
            {typeof onIrAnterior === 'function' ? (
              <button
                type="button"
                className="absolute bottom-32 left-0 top-24 z-[14] w-[min(28%,140px)] max-w-[140px] cursor-pointer bg-transparent"
                aria-label="Story anterior"
                onClick={() => onIrAnterior()}
              />
            ) : null}
            {typeof onIrProximo === 'function' ? (
              <button
                type="button"
                className="absolute bottom-32 right-0 top-24 z-[14] w-[min(28%,140px)] max-w-[140px] cursor-pointer bg-transparent"
                aria-label="Story seguinte"
                onClick={() => onIrProximo()}
              />
            ) : null}
            <div
              className="absolute inset-x-[min(28%,140px)] top-24 z-[13] touch-none bg-transparent"
              onPointerDown={(e) => {
                if (e.pointerType === 'mouse' && e.button !== 0) return
                e.currentTarget.setPointerCapture(e.pointerId)
                pausarPorSegurar()
              }}
              onPointerUp={(e) => {
                retomarAposSoltar()
                try {
                  e.currentTarget.releasePointerCapture(e.pointerId)
                } catch {
                  /* já libertado */
                }
              }}
              onPointerCancel={(e) => {
                retomarAposSoltar()
                try {
                  e.currentTarget.releasePointerCapture(e.pointerId)
                } catch {
                  /* já libertado */
                }
              }}
              aria-hidden
            />
            <video
              ref={videoRef}
              src={story.conteudo_url}
              className="absolute inset-0 h-full w-full object-cover"
              muted={muted}
              playsInline
              loop
              onTimeUpdate={onTimeUpdate}
              onClick={() => togglePlay()}
            />
            {!playing ? (
              <button
                type="button"
                onClick={() => togglePlay()}
                className="absolute left-1/2 top-1/2 z-10 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white"
                aria-label="Reproduzir"
              >
                <Play size={36} fill="currentColor" className="ml-1" />
              </button>
            ) : null}

            {tx?.texto ? (
              <p
                className="absolute z-10 max-w-[90%] rounded bg-black/50 px-2 py-1 text-sm text-white"
                style={{ left: `${px}%`, top: `${py}%`, transform: 'translate(-50%, -50%)' }}
              >
                {tx.texto}
              </p>
            ) : null}
            {story.link ? (
              <a
                href={story.link}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute bottom-24 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow-sm"
              >
                <Link2 size={18} strokeWidth={2} aria-hidden className="text-gray-700" />
                Abrir link
              </a>
            ) : null}

            <div className="absolute bottom-16 left-0 right-0 z-10 h-0.5 bg-white/20 px-3">
              <div className="h-full bg-[#0097b2]" style={{ width: `${videoProgress}%` }} />
            </div>
          </div>
        </div>
      )}

      <footer
        data-story-footer
        className={`pointer-events-auto z-40 flex w-full items-center gap-3 border-t border-white/10 bg-black/75 px-4 py-3 backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 ${
          uid && !souAutor ? 'justify-between' : 'justify-center'
        }`}
      >
        {uid && !souAutor ? (
          <div className="relative flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => setMenuMaisOpcoes((v) => !v)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-white transition hover:bg-white/10"
              aria-label="Mais opções"
              aria-expanded={menuMaisOpcoes}
            >
              <MoreHorizontal size={28} strokeWidth={2} aria-hidden />
            </button>
            {menuMaisOpcoes ? (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-[45] bg-black/40"
                  aria-label="Fechar menu"
                  onClick={() => setMenuMaisOpcoes(false)}
                />
                <div
                  className="absolute bottom-full left-0 z-[46] mb-2 w-[min(calc(100vw-2rem),280px)] overflow-hidden rounded-2xl border border-white/15 bg-zinc-900 py-2 shadow-xl"
                  role="menu"
                >
                  <div className="border-b border-white/10 px-2 py-2">
                    {seguindoAutor === null ? (
                      <p className="px-2 py-2 text-center text-xs text-white/60">A carregar…</p>
                    ) : (
                      <BotaoSeguir
                        alvoId={autorId ?? undefined}
                        alvoTipo="usuario"
                        seguidoTipo="user"
                        isFollowing={seguindoAutor}
                        leadingIcon="none"
                        onToggle={(novo) => {
                          setSeguindoAutor(novo)
                          window.dispatchEvent(new Event('guia-feed-rede-reload'))
                        }}
                        buttonClassName="flex w-full min-h-11 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-sm font-semibold text-white hover:bg-white/15"
                      />
                    )}
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full min-h-11 items-center gap-2 px-4 py-3 text-left text-sm font-medium text-white hover:bg-white/10"
                    onClick={() => {
                      setMenuMaisOpcoes(false)
                      setModalDenunciar(true)
                    }}
                  >
                    <Flag size={18} className="shrink-0 text-amber-400" aria-hidden />
                    Denunciar publicação
                  </button>
                </div>
              </>
            ) : null}
          </div>
        ) : null}

        {souAutor ? (
          <button
            type="button"
            onClick={() => setModalInsights(true)}
            className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-full px-2 py-1 text-white transition hover:bg-white/10"
            aria-label="Ver curtidas e visualizações"
          >
            <ClipboardList size={32} strokeWidth={2} />
            <span className="text-[11px] font-medium text-white/90">
              {curtidasLista.length} · {emailsVisualizacao.length}
            </span>
          </button>
        ) : uid ? (
          <button
            type="button"
            disabled={curtirBusy}
            onClick={() => void toggleCurtida()}
            className="flex min-h-11 min-w-11 flex-col items-center justify-center gap-1 rounded-full p-2 text-white transition hover:bg-white/10 disabled:opacity-50"
            aria-label={curtiu ? 'Remover curtida' : 'Curtir story'}
          >
            <Heart
              size={32}
              strokeWidth={2}
              className={curtiu ? 'fill-red-500 text-red-500' : ''}
              fill={curtiu ? 'currentColor' : 'none'}
            />
          </button>
        ) : (
          <p className="text-center text-xs text-white/70">Inicie sessão para curtir</p>
        )}
      </footer>

      {modalDenunciar ? (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 sm:items-center sm:p-4" role="dialog" aria-modal="true">
          <button type="button" className="absolute inset-0" aria-label="Fechar" onClick={() => !denBusy && setModalDenunciar(false)} />
          <div className="relative z-[1] w-full max-w-md rounded-t-2xl border border-white/10 bg-zinc-900 p-5 shadow-2xl sm:rounded-2xl">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-white">Denunciar story</h2>
              <button
                type="button"
                disabled={denBusy}
                onClick={() => setModalDenunciar(false)}
                className="rounded-full p-2 text-white/80 hover:bg-white/10 disabled:opacity-50"
                aria-label="Fechar"
              >
                <X size={22} />
              </button>
            </div>
            <label className="mb-1 block text-xs font-medium text-white/70">Categoria</label>
            <select
              value={denCategoria}
              onChange={(e) => setDenCategoria(e.target.value)}
              className="mb-4 w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2.5 text-sm text-white"
            >
              {CATEGORIAS_DENUNCIA_STORY.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <label className="mb-1 block text-xs font-medium text-white/70">Descreva o problema (obrigatório, máx. 300 caracteres)</label>
            <textarea
              value={denTexto}
              maxLength={300}
              rows={4}
              onChange={(e) => setDenTexto(e.target.value)}
              className="mb-2 w-full resize-none rounded-xl border border-white/20 bg-black/30 p-3 text-sm text-white placeholder:text-white/40"
              placeholder="Explique o que está incorreto nesta publicação…"
            />
            <p className="mb-4 text-right text-[11px] text-white/50">{denTexto.length}/300</p>
            <button
              type="button"
              disabled={denBusy || !denTexto.trim()}
              onClick={() => void enviarDenunciaStory()}
              className="w-full rounded-xl bg-amber-600 py-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {denBusy ? 'A enviar…' : 'Enviar denúncia'}
            </button>
          </div>
        </div>
      ) : null}

      {toastMsg ? (
        <div className="pointer-events-none fixed bottom-24 left-1/2 z-[130] max-w-[min(calc(100vw-2rem),360px)] -translate-x-1/2 rounded-xl border border-white/20 bg-zinc-900/95 px-4 py-3 text-center text-sm text-white shadow-lg">
          {toastMsg}
        </div>
      ) : null}

      {modalInsights ? (
        <div className="fixed inset-0 z-[110] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Fechar"
            onClick={() => setModalInsights(false)}
          />
          <div className="relative z-[1] flex h-[min(66dvh,88vh)] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-zinc-900 shadow-2xl sm:h-[min(68vh,90vh)] sm:max-h-[min(90vh,900px)] sm:max-w-xl sm:rounded-3xl">
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
              <h2 className="text-base font-semibold text-white">Curtidas e visualizações</h2>
              <button
                type="button"
                onClick={() => setModalInsights(false)}
                className="rounded-full p-2 text-white/80 transition hover:bg-white/10"
                aria-label="Fechar"
              >
                <X size={22} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {carregandoInsights ? (
                <p className="py-12 text-center text-sm text-white/60">A carregar…</p>
              ) : (
                <div className="space-y-8">
                  <section>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/45">Curtiram</p>
                    {curtidasInsights.length === 0 ? (
                      <p className="py-2 text-sm text-white/60">Ainda ninguém curtiu.</p>
                    ) : (
                      <ul className="space-y-1">{curtidasInsights.map((row) => linhaInsight(row, `c-${row.usuario_id}`))}</ul>
                    )}
                  </section>
                  <section>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/45">Visualizaram</p>
                    {visualizacoesInsights.length === 0 ? (
                      <p className="py-2 text-sm text-white/60">Ainda ninguém visualizou.</p>
                    ) : (
                      <ul className="space-y-1">
                        {visualizacoesInsights.map((row, i) =>
                          linhaInsight(row, row.usuario_id ? `v-${row.usuario_id}` : `v-e-${row.email ?? i}`)
                        )}
                      </ul>
                    )}
                  </section>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
