'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { Send, Paperclip, X, Check, Mic } from 'lucide-react'
import { listarMensagensInboxCanalAdm } from '@/lib/canaisProfissionalAdm'
import { listarMensagensInboxCanalAdmEmpresa } from '@/lib/canaisEmpresaAdm'
import { buscarRemetentesEmLote } from '@/lib/canalRemetentes'
import { enviarMarcacaoLeituraKeepalive, marcarCanalComoLido } from '@/lib/canalBadge'
import { notificarBadgeCanais } from '@/lib/canais-badge-events'
import { listarMensagensCanalRecentes } from '@/lib/canalMensagensFetch'
import { mensagensComSeparadoresData } from '@/lib/canalMensagensUi'
import {
  aquecerCacheImagensMensagensCanal,
  ehAnexoAudioCanal,
  ehAnexoImagemCanal,
  prepararImagensChatCanal,
} from '@/lib/canalAnexoUrl'
import { compressImageFileForStoryUpload } from '@/lib/compress-story-image'
import { parseReacoesCanal, toggleReacaoMensagemCanal } from '@/lib/canalReacoes'
import { EMOJIS_REACAO_CANAL } from '@/lib/canalReacoesEmojis'
import CanalMensagemImagem from '@/components/CanalMensagemImagem'
import CanalMensagemAudio from '@/components/CanalMensagemAudio'
import AvatarImage from '@/components/AvatarImage'
import MenuMensagemCanal from '@/components/canal/MenuMensagemCanal'
import ModalDenunciaCanal from '@/components/canal/ModalDenunciaCanal'
import { listarIdsMensagensSalvasCanal, toggleSalvarMensagemCanal } from '@/lib/canalSalvos'
import { enviarDenunciaMensagemCanal } from '@/lib/canalDenuncias'
import {
  contentTypeUploadAudio,
  extensaoAudioGravacao,
  mimeTypeGravacaoCanal,
} from '@/lib/canalAudioGravacao'

const TECLADO_BOTTOM_BAR_EVENT = 'guia-criar-keyboard'
const LONG_PRESS_REACAO_MS = 500
const GRAVACAO_MIN_MS = 400
const FALLBACK_REMETENTE = { id: '', nome: 'Usuário', foto_url: null, role: '' }

/**
 * @param {Record<string, unknown>} m
 * @param {Map<string, import('@/lib/canalRemetentes').RemetenteCanal>} remetentesMap
 */
function mensagemCanalFromRow(m, remetentesMap) {
  const rid = m.remetente_id != null ? String(m.remetente_id) : ''
  const remetente =
    (rid && remetentesMap.get(rid)) ||
    (rid ? { ...FALLBACK_REMETENTE, id: rid } : FALLBACK_REMETENTE)
  return {
    id: String(m.id),
    remetente_id: rid,
    texto: m.texto != null ? String(m.texto) : null,
    anexo_url: m.anexo_url != null ? String(m.anexo_url) : null,
    anexo_tipo: m.anexo_tipo != null ? String(m.anexo_tipo) : null,
    reacoes: parseReacoesCanal(m.reacoes),
    created_at: String(m.created_at ?? ''),
    remetente,
  }
}

/**
 * @param {unknown} reacoes
 * @returns {Record<string, number>}
 */
function agruparReacoes(reacoes) {
  const arr = parseReacoesCanal(reacoes)
  /** Uma reação por usuário (última prevalece em dados legados). */
  /** @type {Map<string, string>} */
  const porUsuario = new Map()
  for (const r of arr) {
    if (r.usuario_id && r.tipo) porUsuario.set(r.usuario_id, r.tipo)
  }
  /** @type {Record<string, number>} */
  const map = {}
  for (const emoji of porUsuario.values()) {
    map[emoji] = (map[emoji] ?? 0) + 1
  }
  return map
}

/**
 * @param {string} data
 */
function formatarHora(data) {
  return new Date(data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

/**
 * @param {{
 *   canalId: string
 *   paisTab?: string
 *   podePostar: boolean
 *   podeReagir: boolean
 *   inboxCanalAdm?: import('@/lib/canaisProfissionalAdm').CanalAdmInboxConfig | import('@/lib/canaisEmpresaAdm').CanalAdmEmpresaInboxConfig | null
 *   inboxModo?: 'profissional' | 'empresa'
 *   canalNome?: string
 *   destaqueMensagemId?: string | null
 *   usuarioId?: string | null
 * }} props
 */
export default function CanalMensagens({
  canalId,
  paisTab = 'geral',
  podePostar,
  podeReagir,
  inboxCanalAdm = null,
  inboxModo = 'profissional',
  canalNome = 'Canal',
  destaqueMensagemId = null,
  usuarioId: usuarioIdProp = null,
}) {
  /** @type {Array<{ id: string, remetente_id: string, texto: string | null, anexo_url: string | null, anexo_tipo: string | null, reacoes: unknown[], created_at: string, remetente: { id: string, nome: string, foto_url: string | null, role: string } }>} */
  const [mensagens, setMensagens] = useState([])
  const [novaMensagem, setNovaMensagem] = useState('')
  const [loadingInicial, setLoadingInicial] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [meuRemetente, setMeuRemetente] = useState(
    /** @type {{ id: string, nome: string, foto_url: string | null, role: string } | null} */ (null),
  )
  const [paddingTeclado, setPaddingTeclado] = useState(0)
  const [anexo, setAnexo] = useState(/** @type {File | null} */ (null))
  const [anexoPreview, setAnexoPreview] = useState(/** @type {string | null} */ (null))
  const [uid, setUid] = useState(/** @type {string | null} */ (usuarioIdProp))
  const messagesEndRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const messagesContainerRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const stickToBottomRef = useRef(true)
  const precisaScrollInicialRef = useRef(true)
  const longPressTimerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null))
  const fileInputRef = useRef(/** @type {HTMLInputElement | null} */ (null))
  const textareaRef = useRef(/** @type {HTMLTextAreaElement | null} */ (null))
  const [reacaoPickerId, setReacaoPickerId] = useState(/** @type {string | null} */ (null))
  const [editandoId, setEditandoId] = useState(/** @type {string | null} */ (null))
  const [idsSalvos, setIdsSalvos] = useState(/** @type {Set<string>} */ (() => new Set()))
  const [mensagemDestacadaId, setMensagemDestacadaId] = useState(/** @type {string | null} */ (null))
  const [denunciaMsg, setDenunciaMsg] = useState(
    /** @type {{ id: string, texto: string | null } | null} */ (null),
  )
  const mensagemRefsMap = useRef(/** @type {Map<string, HTMLDivElement>} */ (new Map()))
  const [editTexto, setEditTexto] = useState('')
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)
  const [gravandoAudio, setGravandoAudio] = useState(false)
  const [segundosGravacao, setSegundosGravacao] = useState(0)
  const mediaRecorderRef = useRef(/** @type {MediaRecorder | null} */ (null))
  const audioChunksRef = useRef(/** @type {Blob[]} */ ([]))
  const streamAudioRef = useRef(/** @type {MediaStream | null} */ (null))
  const gravacaoInicioRef = useRef(0)
  const gravacaoTimerRef = useRef(/** @type {ReturnType<typeof setInterval> | null} */ (null))
  const gravandoAudioRef = useRef(false)
  const gravacaoSolicitadaRef = useRef(false)
  const enviarAoPararGravacaoRef = useRef(true)
  const finalizarGravacaoAudioRef = useRef(/** @type {(enviar: boolean) => Promise<void>} */ (async () => {}))
  const mensagensLenRef = useRef(0)
  const mensagensRef = useRef(mensagens)
  const meuRemetenteRef = useRef(meuRemetente)
  const uidRef = useRef(uid)
  const accessTokenRef = useRef(/** @type {string | null} */ (null))
  mensagensLenRef.current = mensagens.length
  mensagensRef.current = mensagens
  meuRemetenteRef.current = meuRemetente
  uidRef.current = uid
  gravandoAudioRef.current = gravandoAudio

  const pararStreamGravacao = useCallback(() => {
    streamAudioRef.current?.getTracks().forEach((t) => t.stop())
    streamAudioRef.current = null
  }, [])

  const limparTimerGravacao = useCallback(() => {
    if (gravacaoTimerRef.current) {
      clearInterval(gravacaoTimerRef.current)
      gravacaoTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      limparTimerGravacao()
      try {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop()
        }
      } catch {
        /* ignore */
      }
      pararStreamGravacao()
    }
  }, [limparTimerGravacao, pararStreamGravacao])

  const scrollToBottom = useCallback((behavior = 'auto') => {
    const el = messagesContainerRef.current
    if (!el) return
    const top = el.scrollHeight - el.clientHeight
    if (behavior === 'smooth') {
      el.scrollTo({ top, behavior: 'smooth' })
    } else {
      el.scrollTop = top
    }
  }, [])

  const garantirScrollNoRodape = useCallback(() => {
    const irAoFim = () => {
      scrollToBottom('auto')
      messagesEndRef.current?.scrollIntoView({ block: 'end', behavior: 'auto' })
    }
    irAoFim()
    requestAnimationFrame(() => {
      irAoFim()
      requestAnimationFrame(irAoFim)
    })
    window.setTimeout(irAoFim, 50)
    window.setTimeout(irAoFim, 200)
    window.setTimeout(irAoFim, 400)
  }, [scrollToBottom])

  const cancelarLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  /**
   * @param {string} msgId
   */
  const iniciarLongPressReacao = useCallback(
    (msgId) => {
      if (!podeReagir) return
      cancelarLongPress()
      longPressTimerRef.current = setTimeout(() => {
        setReacaoPickerId(msgId)
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate(12)
        }
      }, LONG_PRESS_REACAO_MS)
    },
    [podeReagir, cancelarLongPress],
  )

  /**
   * @param {{ silent?: boolean }} [opts]
   */
  const carregarMensagens = useCallback(async (opts = {}) => {
    if (!canalId) return
    const silent = opts.silent === true
    if (!silent && mensagensLenRef.current === 0) setLoadingInicial(true)
    try {
      const fetchRows = inboxCanalAdm
        ? inboxModo === 'empresa'
          ? listarMensagensInboxCanalAdmEmpresa(supabase, inboxCanalAdm, { paisTab, limit: 120 })
          : listarMensagensInboxCanalAdm(supabase, inboxCanalAdm, { paisTab, limit: 120 })
        : listarMensagensCanalRecentes(supabase, canalId, { paisTab, limit: 80 })

      const [{ data: { session } }, rows] = await Promise.all([supabase.auth.getSession(), fetchRows])
      const uidSessao = session?.user?.id ?? usuarioIdProp ?? null
      if (uidSessao) setUid(uidSessao)
      accessTokenRef.current = session?.access_token ?? null

      const remetenteIds = rows
        .map((msg) => {
          const m = /** @type {Record<string, unknown>} */ (msg)
          return m.remetente_id != null ? String(m.remetente_id) : ''
        })
        .filter(Boolean)
      const remetentesMap = await buscarRemetentesEmLote(supabase, remetenteIds)

      const mensagensCompletas = rows.map((msg) =>
        mensagemCanalFromRow(/** @type {Record<string, unknown>} */ (msg), remetentesMap),
      )

      await aquecerCacheImagensMensagensCanal(supabase, mensagensCompletas, { canalId, limit: 16 })
      setMensagens(mensagensCompletas)
      if (!silent) setLoadingInicial(false)
      precisaScrollInicialRef.current = true
      stickToBottomRef.current = true
      if (session?.user?.id) {
        const me = remetentesMap.get(session.user.id)
        if (me) setMeuRemetente(me)
        const ultimaIso =
          mensagensCompletas.length > 0
            ? mensagensCompletas[mensagensCompletas.length - 1]?.created_at
            : null
        enviarMarcacaoLeituraKeepalive(session.access_token, session.user.id, canalId, ultimaIso)
        void marcarCanalComoLido(supabase, session.user.id, canalId, ultimaIso).then(() => {
          notificarBadgeCanais()
        })
      }
      stickToBottomRef.current = true
    } catch (e) {
      console.error('Erro ao carregar mensagens:', e)
    } finally {
      if (!silent) setLoadingInicial(false)
    }
  }, [canalId, paisTab, inboxCanalAdm, inboxModo, usuarioIdProp])

  useEffect(() => {
    if (usuarioIdProp) setUid(usuarioIdProp)
  }, [usuarioIdProp])

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!base || typeof document === 'undefined') return
    try {
      const origin = new URL(base).origin
      if (document.querySelector(`link[data-guia-preconnect="${origin}"]`)) return
      const link = document.createElement('link')
      link.rel = 'preconnect'
      link.href = origin
      link.crossOrigin = 'anonymous'
      link.setAttribute('data-guia-preconnect', origin)
      document.head.appendChild(link)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    precisaScrollInicialRef.current = true
    stickToBottomRef.current = true
    void carregarMensagens()
  }, [carregarMensagens])

  useEffect(() => {
    if (!uid || !canalId) {
      setIdsSalvos(new Set())
      return
    }
    void listarIdsMensagensSalvasCanal(supabase, uid, canalId).then(setIdsSalvos)
  }, [uid, canalId])

  useEffect(() => {
    if (!destaqueMensagemId || loadingInicial) return

    setMensagemDestacadaId(destaqueMensagemId)

    const rolarParaMensagem = () => {
      const el = mensagemRefsMap.current.get(destaqueMensagemId)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }

    rolarParaMensagem()
    requestAnimationFrame(rolarParaMensagem)
    const tScroll = window.setTimeout(rolarParaMensagem, 300)

    const tHighlight = window.setTimeout(() => setMensagemDestacadaId(null), 2500)

    return () => {
      clearTimeout(tScroll)
      clearTimeout(tHighlight)
    }
  }, [destaqueMensagemId, loadingInicial, mensagens.length])

  useEffect(() => {
    precisaScrollInicialRef.current = true
    stickToBottomRef.current = true
  }, [canalId])

  useEffect(() => {
    return () => {
      const uidLocal = uidRef.current
      const token = accessTokenRef.current
      if (!uidLocal || !canalId || !token) return
      const msgs = mensagensRef.current
      const ultima = msgs.length > 0 ? msgs[msgs.length - 1]?.created_at : null
      enviarMarcacaoLeituraKeepalive(token, uidLocal, canalId, ultima ?? null)
      notificarBadgeCanais()
      void marcarCanalComoLido(supabase, uidLocal, canalId, ultima ?? null)
    }
  }, [canalId])

  useEffect(() => {
    const el = messagesContainerRef.current
    if (!el) return
    const onScroll = () => {
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight
      stickToBottomRef.current = dist < 96
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  useLayoutEffect(() => {
    if (loadingInicial || mensagens.length === 0) return

    if (precisaScrollInicialRef.current) {
      garantirScrollNoRodape()
      precisaScrollInicialRef.current = false
      return
    }

    if (stickToBottomRef.current) garantirScrollNoRodape()
  }, [mensagens, loadingInicial, canalId, garantirScrollNoRodape])

  useEffect(() => {
    const el = messagesContainerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      if (stickToBottomRef.current) scrollToBottom('auto')
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [scrollToBottom])

  useEffect(() => {
    if (!podePostar) return

    const emit = (hide) => {
      window.dispatchEvent(new CustomEvent(TECLADO_BOTTOM_BAR_EVENT, { detail: { hide } }))
    }

    const tecladoProvavelmenteVisivel = () => {
      const vv = window.visualViewport
      if (!vv) return false
      return window.innerHeight - vv.height > 72
    }

    const check = () => {
      const foco = document.activeElement === textareaRef.current
      const kb = tecladoProvavelmenteVisivel()
      const hide = foco || kb
      if (kb && window.visualViewport) {
        const vv = window.visualViewport
        setPaddingTeclado(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)))
      } else {
        setPaddingTeclado(0)
      }
      emit(hide)
    }

    check()
    const vv = window.visualViewport
    vv?.addEventListener('resize', check)
    vv?.addEventListener('scroll', check)
    window.addEventListener('resize', check)
    document.addEventListener('focusin', check)
    document.addEventListener('focusout', check)

    return () => {
      vv?.removeEventListener('resize', check)
      vv?.removeEventListener('scroll', check)
      window.removeEventListener('resize', check)
      document.removeEventListener('focusin', check)
      document.removeEventListener('focusout', check)
      emit(false)
      setPaddingTeclado(0)
    }
  }, [podePostar])

  useEffect(() => {
    if (!podePostar) return
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 36), 96)}px`
  }, [novaMensagem, podePostar])

  useEffect(() => {
    if (!canalId) return

    const idsMonitor =
      inboxCanalAdm != null
        ? [inboxCanalAdm.canalAdmId, ...inboxCanalAdm.canaisBroadcastIds]
        : [canalId]

    const ch = supabase.channel(`mensagens-canal-${canalId}-inbox`)
    for (const cid of idsMonitor) {
      ch.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensagens_canal', filter: `canal_id=eq.${cid}` },
        (payload) => {
          const novo = payload.new
          if (!novo?.id) return

          const paisMsg = novo.pais != null ? String(novo.pais) : 'geral'
          if (paisTab && paisTab !== 'geral' && paisMsg !== paisTab && paisMsg !== 'geral') return

          void (async () => {
            const id = String(novo.id)
            const rid = novo.remetente_id != null ? String(novo.remetente_id) : ''
            const remetenteRapido =
              (rid && uidRef.current === rid && meuRemetenteRef.current) ||
              (rid ? { id: rid, nome: '…', foto_url: null, role: '' } : FALLBACK_REMETENTE)

            const novaMsg = {
              id,
              texto: novo.texto != null ? String(novo.texto) : null,
              anexo_url: novo.anexo_url != null ? String(novo.anexo_url) : null,
              anexo_tipo: novo.anexo_tipo != null ? String(novo.anexo_tipo) : null,
              reacoes: parseReacoesCanal(novo.reacoes),
              created_at: String(novo.created_at ?? ''),
              remetente: remetenteRapido,
            }

            let appended = false
            setMensagens((prev) => {
              if (prev.some((m) => m.id === id)) return prev
              appended = true
              return [...prev, novaMsg]
            })
            if (!appended) return

            if (ehAnexoImagemCanal(novaMsg.anexo_url, novaMsg.anexo_tipo)) {
              void prepararImagensChatCanal(supabase, [novaMsg], { limit: 1 })
            }

            if (rid) {
              const remetentesMap = await buscarRemetentesEmLote(supabase, [rid])
              const remetente = remetentesMap.get(rid)
              if (remetente) {
                setMensagens((prev) =>
                  prev.map((m) => (m.id === id ? { ...m, remetente } : m)),
                )
                if (uidRef.current === rid) setMeuRemetente(remetente)
              }
            }

            notificarBadgeCanais()

            const currentUid = uidRef.current
            if (currentUid && rid !== currentUid) {
              const {
                data: { session },
              } = await supabase.auth.getSession()
              if (session?.user?.id) {
                await marcarCanalComoLidoResiliente(
                  supabase,
                  session.user.id,
                  canalId,
                  novaMsg.created_at,
                  session.access_token,
                )
              }
            }

            if (stickToBottomRef.current) {
              garantirScrollNoRodape()
            }
          })()
        },
      )
      ch.on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'mensagens_canal', filter: `canal_id=eq.${cid}` },
        (payload) => {
          const novo = payload.new
          if (!novo?.id) return
          const id = String(novo.id)
          const reacoes = parseReacoesCanal(novo.reacoes)
          setMensagens((prev) => prev.map((m) => (m.id === id ? { ...m, reacoes } : m)))
        },
      )
    }
    void ch.subscribe()

    return () => {
      void supabase.removeChannel(ch)
    }
  }, [canalId, inboxCanalAdm, paisTab, garantirScrollNoRodape])

  /**
   * @param {string} textoEnviar
   * @param {File | null} anexoEnviar
   * @param {string | null} [anexoTipoForcado]
   */
  const enviarMensagemCanal = useCallback(
    async (textoEnviar, anexoEnviar, anexoTipoForcado = null) => {
      if (!textoEnviar && !anexoEnviar) return

      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) return

      let anexoUrl = null
      let anexoTipo = null

      if (anexoEnviar) {
        let arquivoUpload = anexoEnviar
        if (anexoEnviar.type.startsWith('image/')) {
          arquivoUpload = await compressImageFileForStoryUpload(anexoEnviar, {
            maxWidth: 960,
            jpegQuality: 0.82,
            maxBytesSkip: 280_000,
          })
        }

        let fileExt =
          arquivoUpload.type === 'image/jpeg'
            ? 'jpg'
            : arquivoUpload.name.split('.').pop() || 'bin'
        if (anexoTipoForcado === 'audio' || arquivoUpload.type.startsWith('audio/')) {
          fileExt = extensaoAudioGravacao(arquivoUpload.type || 'audio/webm')
        }
        const fileName = `${Date.now()}.${fileExt}`
        const filePath = `${session.user.id}/${canalId}/${fileName}`

        const contentType =
          anexoTipoForcado === 'audio' || arquivoUpload.type.startsWith('audio/')
            ? contentTypeUploadAudio(arquivoUpload.type || 'audio/webm')
            : arquivoUpload.type || 'application/octet-stream'

        const { error: uploadError } = await supabase.storage.from('mensagens').upload(filePath, arquivoUpload, {
          upsert: true,
          contentType,
          cacheControl: '31536000',
        })

        if (uploadError) {
          console.error('Upload anexo:', uploadError)
          throw uploadError
        }

        const { data: pub } = supabase.storage.from('mensagens').getPublicUrl(filePath)
        anexoUrl = pub.publicUrl
        if (anexoTipoForcado) {
          anexoTipo = anexoTipoForcado
        } else if (arquivoUpload.type.startsWith('image/')) {
          anexoTipo = 'imagem'
        } else if (arquivoUpload.type.startsWith('audio/')) {
          anexoTipo = 'audio'
        } else {
          anexoTipo = 'documento'
        }
      }

      const paisMsg = paisTab && paisTab !== 'geral' ? paisTab : 'geral'

      const { data: row, error } = await supabase
        .from('mensagens_canal')
        .insert({
          canal_id: canalId,
          remetente_id: session.user.id,
          texto: textoEnviar || null,
          anexo_url: anexoUrl,
          anexo_tipo: anexoTipo,
          pais: paisMsg,
        })
        .select('id, texto, anexo_url, anexo_tipo, reacoes, created_at, remetente_id')
        .single()

      if (error) throw error

      const remetente =
        meuRemetenteRef.current ??
        (await buscarRemetentesEmLote(supabase, [session.user.id])).get(session.user.id) ?? {
          id: session.user.id,
          nome: 'Eu',
          foto_url: null,
          role: '',
        }

      if (row) {
        const nova = {
          id: String(row.id),
          texto: row.texto != null ? String(row.texto) : null,
          anexo_url: row.anexo_url != null ? String(row.anexo_url) : null,
          anexo_tipo: row.anexo_tipo != null ? String(row.anexo_tipo) : null,
          reacoes: parseReacoesCanal(row.reacoes),
          created_at: String(row.created_at ?? new Date().toISOString()),
          remetente,
        }
        setMensagens((prev) => (prev.some((m) => m.id === nova.id) ? prev : [...prev, nova]))
        await marcarCanalComoLidoResiliente(
          supabase,
          session.user.id,
          canalId,
          nova.created_at,
          session.access_token,
        )
        notificarBadgeCanais()
        stickToBottomRef.current = true
        garantirScrollNoRodape()
        requestAnimationFrame(() => scrollToBottom('smooth'))
      }
    },
    [canalId, paisTab, garantirScrollNoRodape, scrollToBottom],
  )

  const handleEnviar = async () => {
    const textoBruto = textareaRef.current?.value ?? novaMensagem
    const textoEnviar = textoBruto.trim()
    if (!textoEnviar && !anexo) return
    if (enviando || gravandoAudio) return

    setEnviando(true)
    const anexoEnviar = anexo
    setNovaMensagem('')
    if (textareaRef.current) textareaRef.current.value = ''
    setAnexo(null)
    setAnexoPreview(null)

    try {
      await enviarMensagemCanal(textoEnviar, anexoEnviar)
    } catch (e) {
      console.error('Erro ao enviar mensagem:', e)
      setNovaMensagem(textoEnviar)
      if (anexoEnviar) {
        setAnexo(anexoEnviar)
        if (anexoEnviar.type.startsWith('image/')) {
          const reader = new FileReader()
          reader.onloadend = () => {
            setAnexoPreview(typeof reader.result === 'string' ? reader.result : null)
          }
          reader.readAsDataURL(anexoEnviar)
        }
      }
    } finally {
      setEnviando(false)
    }
  }

  const iniciarGravacaoAudio = useCallback(async () => {
    if (enviando || gravandoAudioRef.current || gravacaoSolicitadaRef.current || !uid || typeof navigator === 'undefined') {
      return
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      console.error('Gravação de áudio não suportada neste navegador.')
      return
    }

    gravacaoSolicitadaRef.current = true
    enviarAoPararGravacaoRef.current = true

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!gravacaoSolicitadaRef.current) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }

      streamAudioRef.current = stream
      const mime = mimeTypeGravacaoCanal()
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      audioChunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }
      mediaRecorderRef.current = recorder
      gravacaoInicioRef.current = Date.now()
      recorder.start(250)
      setGravandoAudio(true)
      setSegundosGravacao(0)
      limparTimerGravacao()
      gravacaoTimerRef.current = setInterval(() => {
        setSegundosGravacao(Math.floor((Date.now() - gravacaoInicioRef.current) / 1000))
      }, 200)
      if ('vibrate' in navigator) navigator.vibrate(8)

      if (!enviarAoPararGravacaoRef.current) {
        void finalizarGravacaoAudioRef.current(false)
      }
    } catch (e) {
      console.error('Erro ao acessar microfone:', e)
      pararStreamGravacao()
      setGravandoAudio(false)
      gravacaoSolicitadaRef.current = false
    }
  }, [enviando, uid, limparTimerGravacao, pararStreamGravacao])

  /**
   * @param {boolean} enviar
   */
  const finalizarGravacaoAudio = useCallback(
    async (enviar) => {
      enviarAoPararGravacaoRef.current = enviar

      if (!gravandoAudioRef.current && !mediaRecorderRef.current) {
        if (gravacaoSolicitadaRef.current && !enviar) {
          gravacaoSolicitadaRef.current = false
        }
        if (gravacaoSolicitadaRef.current && enviar) {
          return
        }
        if (!gravacaoSolicitadaRef.current) return
      }

      if (!mediaRecorderRef.current && gravacaoSolicitadaRef.current) {
        if (!enviar) gravacaoSolicitadaRef.current = false
        return
      }

      gravacaoSolicitadaRef.current = false
      limparTimerGravacao()
      setGravandoAudio(false)
      setSegundosGravacao(0)

      const recorder = mediaRecorderRef.current
      mediaRecorderRef.current = null
      if (!recorder) {
        pararStreamGravacao()
        return
      }

      const duracaoMs = Date.now() - gravacaoInicioRef.current

      if (recorder.state === 'recording') {
        await new Promise((resolve) => {
          recorder.addEventListener('stop', resolve, { once: true })
          try {
            if (typeof recorder.requestData === 'function') recorder.requestData()
          } catch {
            /* ignore */
          }
          try {
            recorder.stop()
          } catch {
            resolve(undefined)
          }
        })
      }
      pararStreamGravacao()

      const chunks = audioChunksRef.current
      audioChunksRef.current = []

      if (!enviar || duracaoMs < GRAVACAO_MIN_MS || chunks.length === 0) return

      const mime = recorder.mimeType || 'audio/webm'
      const blob = new Blob(chunks, { type: mime })
      if (blob.size < 80) return

      const ext = extensaoAudioGravacao(mime)
      const file = new File([blob], `audio-${Date.now()}.${ext}`, { type: mime })

      setEnviando(true)
      try {
        await enviarMensagemCanal('', file, 'audio')
      } catch (e) {
        console.error('Erro ao enviar áudio:', e)
      } finally {
        setEnviando(false)
      }
    },
    [enviarMensagemCanal, limparTimerGravacao, pararStreamGravacao],
  )
  finalizarGravacaoAudioRef.current = finalizarGravacaoAudio

  /**
   * @param {string} mensagemId
   * @param {string} emoji
   */
  const handleSalvarEdicao = async () => {
    if (!editandoId || !editTexto.trim() || !uid) return
    setSalvandoEdicao(true)
    try {
      const { error } = await supabase
        .from('mensagens_canal')
        .update({ texto: editTexto.trim() })
        .eq('id', editandoId)
        .eq('remetente_id', uid)

      if (error) throw error

      setMensagens((prev) =>
        prev.map((m) => (m.id === editandoId ? { ...m, texto: editTexto.trim() } : m)),
      )
      setEditandoId(null)
      setEditTexto('')
      setMenuMsgId(null)
    } catch (e) {
      console.error('Erro ao editar mensagem:', e)
    } finally {
      setSalvandoEdicao(false)
    }
  }

  /**
   * @param {string} mensagemId
   * @param {string} emoji
   */
  const handleToggleSalvar = async (mensagemId) => {
    if (!uid) return
    const salvo = idsSalvos.has(mensagemId)
    try {
      const agora = await toggleSalvarMensagemCanal(supabase, uid, canalId, mensagemId, salvo)
      setIdsSalvos((prev) => {
        const next = new Set(prev)
        if (agora) next.add(mensagemId)
        else next.delete(mensagemId)
        return next
      })
    } catch (e) {
      console.error('Erro ao salvar mensagem:', e)
    }
  }

  const handleReagir = async (mensagemId, emoji) => {
    if (!podeReagir || !uid) return

    try {
      const novasReacoes = await toggleReacaoMensagemCanal(supabase, mensagemId, emoji)
      setMensagens((prev) => prev.map((m) => (m.id === mensagemId ? { ...m, reacoes: novasReacoes } : m)))
    } catch (e) {
      console.error('Erro ao reagir:', e)
    }
  }

  const idsImagemPrioridade = useMemo(() => {
    const ids = new Set()
    let n = 0
    for (let i = mensagens.length - 1; i >= 0 && n < 16; i--) {
      const m = mensagens[i]
      if (ehAnexoImagemCanal(m.anexo_url, m.anexo_tipo)) {
        ids.add(m.id)
        n++
      }
    }
    return ids
  }, [mensagens])

  if (!canalId) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 text-gray-400">Selecione um canal.</div>
    )
  }

  if (loadingInicial && mensagens.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="animate-pulse text-gray-400">Carregando mensagens...</div>
      </div>
    )
  }

  const emojis = EMOJIS_REACAO_CANAL
  const temTextoOuAnexo = Boolean(novaMensagem.trim() || anexo)
  const podeEnviar = Boolean(temTextoOuAnexo && uid && !enviando && !gravandoAudio)
  const mostrarMic = Boolean(uid && !temTextoOuAnexo && !enviando)

  const itensLista = mensagensComSeparadoresData(mensagens, (m) => m.created_at)

  /**
   * @param {{ foto_url: string | null, nome: string }} remetente
   */
  const renderAvatarRemetente = (remetente) => {
    if (remetente.foto_url) {
      return (
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md bg-gray-100">
          <AvatarImage src={remetente.foto_url} alt="" width={36} height={36} className="object-cover" />
        </div>
      )
    }
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gray-100 text-xs font-semibold text-[#0097b2]">
        {remetente.nome.charAt(0).toUpperCase()}
      </div>
    )
  }

  return (
    <div className="canal-chat flex h-full min-h-0 flex-1 flex-col">
      <div
        ref={messagesContainerRef}
        className="canal-chat-messages scrollbar-perfil flex min-h-0 flex-1 flex-col justify-end space-y-1 overflow-y-auto px-2 py-2"
        onClick={() => {
          setReacaoPickerId(null)
        }}
      >
        {mensagens.length === 0 ? (
          <div className="py-8 text-center text-gray-500">Nenhuma mensagem ainda. Seja o primeiro a enviar!</div>
        ) : (
          <div className="flex min-h-full flex-col">
          <div className="mt-auto flex flex-col space-y-1">
          {itensLista.map((item) => {
            if (item.type === 'date') {
              return (
                <div key={item.key} className="flex justify-center py-2">
                  <span className="canal-chat-date-separator rounded-lg px-3 py-1 text-xs font-medium text-white shadow-sm">
                    {item.label}
                  </span>
                </div>
              )
            }

            const msg = item.msg
            const isOwn =
              uid != null &&
              (msg.remetente_id === uid || msg.remetente.id === uid)
            const reacoesAgrupadas = agruparReacoes(msg.reacoes)
            const temReacoes = Object.keys(reacoesAgrupadas).length > 0
            const pickerAberto = reacaoPickerId === msg.id
            const emEdicao = editandoId === msg.id
            const podeEditarMsg = isOwn && podePostar && msg.texto
            const mostrarMenuMsg = Boolean(uid && !emEdicao)

            const bubbleBase = isOwn
              ? 'canal-bubble-own rounded-2xl px-3 py-2 text-sm text-gray-900'
              : 'canal-bubble-other rounded-2xl px-3 py-2 text-sm text-gray-900'

            return (
              <div
                key={msg.id}
                ref={(el) => {
                  if (el) mensagemRefsMap.current.set(msg.id, el)
                  else mensagemRefsMap.current.delete(msg.id)
                }}
                className={`group flex w-full rounded-lg transition-shadow ${
                  isOwn ? 'justify-end' : 'justify-start'
                } ${mensagemDestacadaId === msg.id ? 'ring-2 ring-[#0097b2] ring-offset-1' : ''}`}
              >
                <div className={`flex max-w-[82%] flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                  <div className={`flex items-end gap-1.5 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                    {renderAvatarRemetente(msg.remetente)}

                    <div className={`relative flex items-start gap-0 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div
                      className={`relative ${bubbleBase} ${isOwn ? 'rounded-br-sm' : 'rounded-bl-sm'} min-w-[4rem] select-none touch-manipulation`}
                      onPointerDown={() => {
                        if (!emEdicao && podeReagir) iniciarLongPressReacao(msg.id)
                      }}
                      onPointerUp={cancelarLongPress}
                      onPointerLeave={cancelarLongPress}
                      onPointerCancel={cancelarLongPress}
                      onContextMenu={(e) => {
                        if (podeReagir && !emEdicao) e.preventDefault()
                      }}
                    >
                      {pickerAberto && podeReagir && !emEdicao ? (
                        <div
                          className={`absolute bottom-full z-40 mb-2 flex gap-0.5 rounded-full border border-gray-200 bg-white px-2 py-1.5 shadow-lg ${isOwn ? 'right-0' : 'left-0'}`}
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          {emojis.map((emoji) => {
                            const reacoes = parseReacoesCanal(msg.reacoes)
                            const minhaReacao = uid ? reacoes.find((r) => r.usuario_id === uid) : null
                            const ativo = minhaReacao?.tipo === emoji
                            return (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => {
                                  void handleReagir(msg.id, emoji)
                                  setReacaoPickerId(null)
                                }}
                                className={`rounded-full p-1.5 text-lg hover:bg-gray-100 ${ativo ? 'bg-gray-100' : ''}`}
                                aria-label={`Reagir com ${emoji}`}
                              >
                                {emoji}
                              </button>
                            )
                          })}
                        </div>
                      ) : null}
                      {emEdicao ? (
                        <div className="space-y-2">
                          <textarea
                            value={editTexto}
                            onChange={(e) => setEditTexto(e.target.value)}
                            rows={3}
                            className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm text-gray-900 focus:border-[#0097b2] focus:outline-none"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditandoId(null)
                                setEditTexto('')
                              }}
                              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                            >
                              <X className="h-3.5 w-3.5" aria-hidden />
                              Cancelar
                            </button>
                            <button
                              type="button"
                              disabled={salvandoEdicao || !editTexto.trim()}
                              onClick={() => void handleSalvarEdicao()}
                              className="inline-flex items-center gap-1 rounded-full bg-[#0097b2] px-2 py-1 text-xs text-white disabled:opacity-50"
                            >
                              <Check className="h-3.5 w-3.5" aria-hidden />
                              Salvar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {msg.texto ? (
                            <p className="whitespace-pre-wrap break-words text-sm text-gray-900">
                              {msg.texto}
                            </p>
                          ) : null}

                          {ehAnexoImagemCanal(msg.anexo_url, msg.anexo_tipo) ? (
                            <div
                              className={msg.texto ? 'mt-1.5' : ''}
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <CanalMensagemImagem
                                src={msg.anexo_url}
                                priority={idsImagemPrioridade.has(msg.id)}
                              />
                            </div>
                          ) : null}

                          {ehAnexoAudioCanal(msg.anexo_url, msg.anexo_tipo) ? (
                            <div className={msg.texto ? 'mt-1.5' : ''}>
                              <CanalMensagemAudio key={msg.anexo_url} src={msg.anexo_url} isOwn={isOwn} />
                            </div>
                          ) : null}

                          {msg.anexo_url && msg.anexo_tipo === 'documento' ? (
                            <a
                              href={msg.anexo_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-[#0097b2] underline-offset-2 hover:underline"
                            >
                              <Paperclip size={14} aria-hidden />
                              Ver anexo
                            </a>
                          ) : null}

                          <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-gray-500">
                            <span>{formatarHora(msg.created_at)}</span>
                            {isOwn ? <span aria-hidden>✓</span> : null}
                          </div>
                        </>
                      )}
                    </div>

                    {mostrarMenuMsg ? (
                      <MenuMensagemCanal
                        salvo={idsSalvos.has(msg.id)}
                        podeEditar={podeEditarMsg}
                        alinhadoDireita={isOwn}
                        onEditar={() => {
                          setEditandoId(msg.id)
                          setEditTexto(msg.texto ?? '')
                          setReacaoPickerId(null)
                        }}
                        onSalvar={() => void handleToggleSalvar(msg.id)}
                        onInteragir={
                          podeReagir
                            ? () => {
                                setReacaoPickerId(msg.id)
                                cancelarLongPress()
                              }
                            : undefined
                        }
                        onDenunciar={
                          !isOwn
                            ? () => {
                                setDenunciaMsg({ id: msg.id, texto: msg.texto })
                                setReacaoPickerId(null)
                              }
                            : undefined
                        }
                      />
                    ) : null}
                    </div>
                  </div>

                  {temReacoes ? (
                    <div
                      className={`mt-1 flex flex-wrap gap-1 ${
                        isOwn ? 'justify-end' : 'justify-start pl-10'
                      }`}
                    >
                      {Object.entries(reacoesAgrupadas).map(([emoji, count]) => (
                        <button
                          key={emoji}
                          type="button"
                          disabled={!podeReagir}
                          onClick={() => podeReagir && void handleReagir(msg.id, emoji)}
                          className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-xs shadow-sm disabled:cursor-default"
                        >
                          {emoji} {count}
                        </button>
                      ))}
                    </div>
                  ) : null}

                </div>
              </div>
            )
          })}
          </div>
          </div>
        )}
        <div ref={messagesEndRef} className="h-px shrink-0" aria-hidden />
      </div>

      {podePostar ? (
        <div
          className="sticky bottom-0 z-20 shrink-0 border-t border-gray-200 bg-white px-2 py-2"
          style={{ paddingBottom: paddingTeclado > 0 ? paddingTeclado : undefined }}
        >
          {gravandoAudio ? (
            <div className="mb-2 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
              </span>
              <span className="font-medium">Gravando…</span>
              <span className="tabular-nums text-red-600">
                {Math.floor(segundosGravacao / 60)}:{String(segundosGravacao % 60).padStart(2, '0')}
              </span>
              <span className="text-xs text-red-500">Solte para enviar</span>
            </div>
          ) : null}

          {anexoPreview ? (
            <div className="relative mb-2 inline-block">
              <div className="relative h-20 w-20 overflow-hidden rounded-lg">
                <Image src={anexoPreview} alt="" width={80} height={80} className="object-cover" unoptimized />
              </div>
              <button
                type="button"
                onClick={() => {
                  setAnexo(null)
                  setAnexoPreview(null)
                }}
                className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white"
                aria-label="Remover anexo"
              >
                ×
              </button>
            </div>
          ) : null}

          <form
            className="flex min-w-0 items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              void handleEnviar()
            }}
          >
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={gravandoAudio}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center self-end text-gray-500 hover:text-[#0097b2] disabled:opacity-40"
              aria-label="Anexo"
            >
              <Paperclip className="h-5 w-5" aria-hidden />
            </button>
            <textarea
              ref={textareaRef}
              rows={1}
              value={novaMensagem}
              disabled={!uid || enviando || gravandoAudio}
              enterKeyHint="send"
              onChange={(e) => setNovaMensagem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void handleEnviar()
                }
              }}
              placeholder={gravandoAudio ? 'Gravando áudio…' : 'Digite uma mensagem...'}
              className="max-h-24 min-h-10 min-w-0 flex-1 resize-none rounded-full border border-gray-200 bg-gray-100 px-4 py-2 text-sm leading-5 text-black placeholder:text-gray-400 focus:border-[#0097b2] focus:outline-none focus:ring-1 focus:ring-[#0097b2] disabled:opacity-60"
            />
            {mostrarMic ? (
              <button
                type="button"
                disabled={!uid}
                onPointerDown={(e) => {
                  e.preventDefault()
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId)
                  } catch {
                    /* ignore */
                  }
                  void iniciarGravacaoAudio()
                }}
                onPointerUp={(e) => {
                  e.preventDefault()
                  try {
                    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                      e.currentTarget.releasePointerCapture(e.pointerId)
                    }
                  } catch {
                    /* ignore */
                  }
                  void finalizarGravacaoAudio(true)
                }}
                onPointerCancel={(e) => {
                  e.preventDefault()
                  try {
                    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                      e.currentTarget.releasePointerCapture(e.pointerId)
                    }
                  } catch {
                    /* ignore */
                  }
                  void finalizarGravacaoAudio(false)
                }}
                onContextMenu={(e) => e.preventDefault()}
                className={`inline-flex h-10 w-10 shrink-0 touch-none select-none items-center justify-center self-end rounded-full text-white shadow-sm transition ${
                  gravandoAudio ? 'bg-red-500 hover:bg-red-600' : 'bg-[#0097b2] hover:bg-[#0088a1]'
                }`}
                aria-label="Segure para gravar áudio"
              >
                <Mic className="h-5 w-5" aria-hidden />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!podeEnviar}
                onMouseDown={(e) => e.preventDefault()}
                onTouchStart={(e) => e.preventDefault()}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center self-end rounded-full bg-[#0097b2] text-white shadow-sm transition hover:bg-[#0088a1] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Enviar"
              >
                {enviando ? (
                  <span className="text-xs font-medium" aria-hidden>
                    …
                  </span>
                ) : (
                  <Send className="h-4 w-4" aria-hidden />
                )}
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  setAnexo(file)
                  if (file.type.startsWith('image/')) {
                    const reader = new FileReader()
                    reader.onloadend = () => {
                      setAnexoPreview(typeof reader.result === 'string' ? reader.result : null)
                    }
                    reader.readAsDataURL(file)
                  } else {
                    setAnexoPreview(null)
                  }
                }
              }}
              className="hidden"
            />
          </form>
          {!uid ? <p className="mt-2 text-center text-xs text-gray-500">Entre na conta para enviar.</p> : null}
        </div>
      ) : null}

      <ModalDenunciaCanal
        aberto={denunciaMsg != null}
        titulo="Denunciar mensagem"
        onFechar={() => setDenunciaMsg(null)}
        onEnviar={async (motivo, descricao) => {
          if (!uid || !denunciaMsg) return { ok: false, error: 'Sessão inválida.' }
          const res = await enviarDenunciaMensagemCanal(supabase, {
            denuncianteId: uid,
            canalId,
            canalNome,
            mensagemId: denunciaMsg.id,
            textoMensagem: denunciaMsg.texto,
            tipo: 'mensagem',
            motivo,
            descricao,
          })
          if (res.ok) setDenunciaMsg(null)
          return res
        }}
      />
    </div>
  )
}
