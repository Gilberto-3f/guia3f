'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { MoreVertical, Pencil, Send, Paperclip, X, Check } from 'lucide-react'
import { listarMensagensInboxCanalAdm } from '@/lib/canaisProfissionalAdm'
import { listarMensagensInboxCanalAdmEmpresa } from '@/lib/canaisEmpresaAdm'
import { buscarRemetentesEmLote } from '@/lib/canalRemetentes'
import { marcarCanalComoLido } from '@/lib/canalBadge'
import { notificarBadgeCanais } from '@/lib/canais-badge-events'
import CanalMensagemImagem from '@/components/CanalMensagemImagem'
import AvatarImage from '@/components/AvatarImage'

const TECLADO_BOTTOM_BAR_EVENT = 'guia-criar-keyboard'

/**
 * @param {unknown} raw
 * @returns {unknown[]}
 */
function asReacoesArray(raw) {
  if (Array.isArray(raw)) return raw
  if (raw == null) return []
  return []
}

/**
 * @param {unknown} reacoes
 * @returns {Record<string, number>}
 */
function agruparReacoes(reacoes) {
  const arr = /** @type {{ tipo?: string }[]} */ (asReacoesArray(reacoes))
  /** @type {Record<string, number>} */
  const map = {}
  for (const r of arr) {
    const emoji = r.tipo
    if (emoji) map[emoji] = (map[emoji] ?? 0) + 1
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
 * }} props
 */
export default function CanalMensagens({
  canalId,
  paisTab = 'geral',
  podePostar,
  podeReagir,
  inboxCanalAdm = null,
  inboxModo = 'profissional',
}) {
  /** @type {Array<{ id: string, texto: string | null, anexo_url: string | null, anexo_tipo: string | null, reacoes: unknown[], created_at: string, remetente: { id: string, nome: string, foto_url: string | null, role: string } }>} */
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
  const [uid, setUid] = useState(/** @type {string | null} */ (null))
  const messagesEndRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const fileInputRef = useRef(/** @type {HTMLInputElement | null} */ (null))
  const textareaRef = useRef(/** @type {HTMLTextAreaElement | null} */ (null))
  const [reacaoPickerId, setReacaoPickerId] = useState(/** @type {string | null} */ (null))
  const [menuMsgId, setMenuMsgId] = useState(/** @type {string | null} */ (null))
  const [editandoId, setEditandoId] = useState(/** @type {string | null} */ (null))
  const [editTexto, setEditTexto] = useState('')
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)
  const mensagensLenRef = useRef(0)
  mensagensLenRef.current = mensagens.length

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

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
        : (async () => {
            let q = supabase.from('mensagens_canal').select('*').eq('canal_id', canalId)
            if (paisTab && paisTab !== 'geral') {
              q = q.or(`pais.eq.${paisTab},pais.eq.geral`)
            }
            const { data, error } = await q.order('created_at', { ascending: true }).limit(80)
            if (error) throw error
            return data ?? []
          })()

      const [{ data: { session } }, rows] = await Promise.all([supabase.auth.getSession(), fetchRows])
      setUid(session?.user?.id ?? null)

      const remetenteIds = rows
        .map((msg) => {
          const m = /** @type {Record<string, unknown>} */ (msg)
          return m.remetente_id != null ? String(m.remetente_id) : ''
        })
        .filter(Boolean)
      const remetentesMap = await buscarRemetentesEmLote(supabase, remetenteIds)
      const fallbackRemetente = { id: '', nome: 'Usuário', foto_url: null, role: '' }

      const mensagensCompletas = rows.map((msg) => {
        const m = /** @type {Record<string, unknown>} */ (msg)
        const rid = m.remetente_id != null ? String(m.remetente_id) : ''
        const remetente = (rid && remetentesMap.get(rid)) || fallbackRemetente
        return {
          id: String(m.id),
          texto: m.texto != null ? String(m.texto) : null,
          anexo_url: m.anexo_url != null ? String(m.anexo_url) : null,
          anexo_tipo: m.anexo_tipo != null ? String(m.anexo_tipo) : null,
          reacoes: asReacoesArray(m.reacoes),
          created_at: String(m.created_at ?? ''),
          remetente,
        }
      })

      setMensagens(mensagensCompletas)
      if (session?.user?.id) {
        const me = remetentesMap.get(session.user.id)
        if (me) setMeuRemetente(me)
        const ultimaIso =
          mensagensCompletas.length > 0
            ? mensagensCompletas[mensagensCompletas.length - 1]?.created_at
            : null
        await marcarCanalComoLido(supabase, session.user.id, canalId, ultimaIso)
        notificarBadgeCanais()
      }
      if (!silent) setTimeout(scrollToBottom, 100)
    } catch (e) {
      console.error('Erro ao carregar mensagens:', e)
    } finally {
      if (!silent) setLoadingInicial(false)
    }
  }, [canalId, paisTab, inboxCanalAdm, inboxModo])

  useEffect(() => {
    void carregarMensagens()
  }, [carregarMensagens])

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
        () => {
          void carregarMensagens({ silent: true })
        }
      )
    }
    void ch.subscribe()

    return () => {
      void supabase.removeChannel(ch)
    }
  }, [canalId, inboxCanalAdm, carregarMensagens])

  const handleEnviar = async () => {
    if (!novaMensagem.trim() && !anexo) return

    setEnviando(true)
    const textoEnviar = novaMensagem.trim()
    const anexoEnviar = anexo
    setNovaMensagem('')
    setAnexo(null)
    setAnexoPreview(null)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) return

      let anexoUrl = null
      let anexoTipo = null

      if (anexoEnviar) {
        const fileExt = anexoEnviar.name.split('.').pop() || 'bin'
        const fileName = `${Date.now()}.${fileExt}`
        const filePath = `${session.user.id}/${canalId}/${fileName}`

        const { error: uploadError } = await supabase.storage.from('mensagens').upload(filePath, anexoEnviar, {
          upsert: true,
          contentType: anexoEnviar.type || undefined,
        })

        if (uploadError) {
          console.error('Upload anexo:', uploadError)
          throw uploadError
        }

        const { data: pub } = supabase.storage.from('mensagens').getPublicUrl(filePath)
        anexoUrl = pub.publicUrl
        anexoTipo = anexoEnviar.type.startsWith('image/') ? 'imagem' : 'documento'
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
        meuRemetente ??
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
          reacoes: asReacoesArray(row.reacoes),
          created_at: String(row.created_at ?? new Date().toISOString()),
          remetente,
        }
        setMensagens((prev) => (prev.some((m) => m.id === nova.id) ? prev : [...prev, nova]))
        await marcarCanalComoLido(supabase, session.user.id, canalId, nova.created_at)
        notificarBadgeCanais()
        setTimeout(scrollToBottom, 50)
      }
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
  const handleReagir = async (mensagemId, emoji) => {
    if (!podeReagir || !uid) return

    try {
      const mensagem = mensagens.find((m) => m.id === mensagemId)
      const reacoes = /** @type {{ usuario_id: string, tipo: string }[]} */ (asReacoesArray(mensagem?.reacoes))

      const jaReagiu = reacoes.some((r) => r.usuario_id === uid && r.tipo === emoji)

      const novasReacoes = jaReagiu
        ? reacoes.filter((r) => !(r.usuario_id === uid && r.tipo === emoji))
        : [...reacoes, { usuario_id: uid, tipo: emoji }]

      const { error } = await supabase.from('mensagens_canal').update({ reacoes: novasReacoes }).eq('id', mensagemId)

      if (error) throw error

      setMensagens((prev) => prev.map((m) => (m.id === mensagemId ? { ...m, reacoes: novasReacoes } : m)))
    } catch (e) {
      console.error('Erro ao reagir:', e)
    }
  }

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

  const emojis = ['👍', '❤️', '😂', '😮', '😢', '😡']
  const podeEnviar = Boolean((novaMensagem.trim() || anexo) && uid && !enviando)

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
        className="canal-chat-messages scrollbar-perfil min-h-0 flex-1 space-y-1 overflow-y-auto px-2 py-2"
        onClick={() => {
          setMenuMsgId(null)
          setReacaoPickerId(null)
        }}
      >
        {mensagens.length === 0 ? (
          <div className="py-8 text-center text-gray-500">Nenhuma mensagem ainda. Seja o primeiro a enviar!</div>
        ) : (
          mensagens.map((msg) => {
            const isOwn = uid != null && msg.remetente.id === uid
            const reacoesAgrupadas = agruparReacoes(msg.reacoes)
            const temReacoes = Object.keys(reacoesAgrupadas).length > 0
            const pickerAberto = reacaoPickerId === msg.id
            const menuAberto = menuMsgId === msg.id
            const emEdicao = editandoId === msg.id
            const podeEditarMsg = isOwn && podePostar && msg.texto

            const bubbleBase = isOwn
              ? 'canal-bubble-own rounded-2xl px-3 py-2 text-sm text-white'
              : 'canal-bubble-other rounded-2xl px-3 py-2 text-sm text-gray-900'

            return (
              <div
                key={msg.id}
                className={`group flex w-full ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex max-w-[82%] flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                  <span className="mb-0 max-w-full truncate px-0.5 text-[11px] font-semibold leading-tight text-gray-600">
                    {msg.remetente.nome}
                  </span>

                  <div className={`flex items-end gap-1.5 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                    {renderAvatarRemetente(msg.remetente)}

                    <div className={`relative flex items-start gap-1 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div
                      className={`${bubbleBase} ${isOwn ? 'rounded-br-sm' : 'rounded-bl-sm'} min-w-[4rem]`}
                    >
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
                            <p
                              className={`whitespace-pre-wrap break-words text-sm ${
                                isOwn ? 'text-white' : 'text-gray-900'
                              }`}
                            >
                              {msg.texto}
                            </p>
                          ) : null}

                          {msg.anexo_url && msg.anexo_tipo === 'imagem' ? (
                            <div className={msg.texto ? 'mt-1.5' : ''}>
                              <CanalMensagemImagem src={msg.anexo_url} />
                            </div>
                          ) : null}

                          {msg.anexo_url && msg.anexo_tipo === 'documento' ? (
                            <a
                              href={msg.anexo_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`mt-1 inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm underline-offset-2 hover:underline ${
                                isOwn ? 'text-white/95' : 'text-[#0097b2]'
                              }`}
                            >
                              <Paperclip size={14} aria-hidden />
                              Ver anexo
                            </a>
                          ) : null}

                          <div
                            className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                              isOwn ? 'text-white/75' : 'text-gray-500'
                            }`}
                          >
                            <span>{formatarHora(msg.created_at)}</span>
                            {isOwn ? <span aria-hidden>✓</span> : null}
                          </div>
                        </>
                      )}
                    </div>

                    {podeEditarMsg && !emEdicao ? (
                      <div className="relative shrink-0 self-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setMenuMsgId(menuAberto ? null : msg.id)
                            setReacaoPickerId(null)
                          }}
                          className={`rounded-full p-1 text-gray-500 hover:bg-gray-100 ${
                            menuAberto ? 'bg-gray-100' : 'opacity-0 group-hover:opacity-100'
                          }`}
                          aria-label="Opções da mensagem"
                        >
                          <MoreVertical className="h-4 w-4" aria-hidden />
                        </button>
                        {menuAberto ? (
                          <div
                            className="absolute top-full z-30 mt-1 min-w-[8.5rem] rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                            style={isOwn ? { right: 0 } : { left: 0 }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setEditandoId(msg.id)
                                setEditTexto(msg.texto ?? '')
                                setMenuMsgId(null)
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50"
                            >
                              <Pencil className="h-4 w-4 text-[#0097b2]" aria-hidden />
                              Editar
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    </div>
                  </div>

                  {temReacoes ? (
                    <div className="mt-1 flex flex-wrap gap-1 px-1">
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

                  {podeReagir ? (
                    <div className="relative mt-0.5 px-1">
                      <button
                        type="button"
                        onClick={() => setReacaoPickerId(pickerAberto ? null : msg.id)}
                        className={`rounded-full px-2 py-0.5 text-xs text-gray-500 transition hover:bg-gray-200/80 ${
                          pickerAberto ? 'bg-gray-200/80' : 'opacity-0 group-hover:opacity-100'
                        }`}
                        aria-label="Reagir"
                      >
                        {pickerAberto ? '✕' : '😀'}
                      </button>
                      {pickerAberto ? (
                        <div className="mt-1 flex flex-wrap gap-0.5 rounded-full border border-gray-200 bg-white px-2 py-1 shadow-md">
                          {emojis.map((emoji) => {
                            const reacoes = /** @type {{ usuario_id: string, tipo: string }[]} */ (
                              asReacoesArray(msg.reacoes)
                            )
                            const ativo = uid ? reacoes.some((r) => r.usuario_id === uid && r.tipo === emoji) : false
                            return (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => {
                                  void handleReagir(msg.id, emoji)
                                  setReacaoPickerId(null)
                                }}
                                className={`rounded-full p-1 text-base hover:bg-gray-100 ${ativo ? 'bg-gray-100' : ''}`}
                              >
                                {emoji}
                              </button>
                            )
                          })}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {podePostar ? (
        <div
          className="sticky bottom-0 z-20 shrink-0 border-t border-gray-200 bg-white px-2 py-2"
          style={{ paddingBottom: paddingTeclado > 0 ? paddingTeclado : undefined }}
        >
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

          <div className="flex min-w-0 items-end gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center self-end text-gray-500 hover:text-[#0097b2]"
              aria-label="Anexo"
            >
              <Paperclip className="h-5 w-5" aria-hidden />
            </button>
            <textarea
              ref={textareaRef}
              rows={1}
              value={novaMensagem}
              disabled={!uid || enviando}
              onChange={(e) => setNovaMensagem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void handleEnviar()
                }
              }}
              placeholder="Digite uma mensagem..."
              className="max-h-24 min-h-10 min-w-0 flex-1 resize-none rounded-full border border-gray-200 bg-gray-100 px-4 py-2 text-sm leading-5 text-black placeholder:text-gray-400 focus:border-[#0097b2] focus:outline-none focus:ring-1 focus:ring-[#0097b2]"
            />
            {podeEnviar ? (
              <button
                type="button"
                onClick={() => void handleEnviar()}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center self-end rounded-full bg-[#0097b2] text-white shadow-sm transition hover:bg-[#0088a1]"
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
            ) : null}
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
          </div>
          {!uid ? <p className="mt-2 text-center text-xs text-gray-500">Entre na conta para enviar.</p> : null}
        </div>
      ) : null}
    </div>
  )
}
