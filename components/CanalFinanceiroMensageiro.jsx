'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { Mic, Paperclip, Send } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import AvatarImage from '@/components/AvatarImage'
import FinanceiroDialogoVisual from '@/components/canal/FinanceiroDialogoVisual'
import {
  contentTypeUploadAudio,
  extensaoAudioGravacao,
  mimeTypeGravacaoCanal,
} from '@/lib/canalAudioGravacao'
import { compressImageFileForStoryUpload } from '@/lib/compress-story-image'
import {
  buscarConversaAbertaParaAlvo,
  buscarPerfisAdmFinanceiro,
  enviarMensagemConversaFinanceiro,
  listarConversasFinanceiroParaAlvo,
  listarMensagensConversa,
} from '@/lib/financeiroConversas'

const AVATAR_QUADRADO = 'shrink-0 rounded-md object-cover'

const TECLADO_BOTTOM_BAR_EVENT = 'guia-criar-keyboard'
const GRAVACAO_MIN_MS = 400

/**
 * @param {import('@/lib/financeiroConversas').FinanceiroConversaRow} c
 */
function rotuloDataConversa(c) {
  if (c.status === 'encerrada' && c.encerrada_em) {
    return new Date(c.encerrada_em).toLocaleString('pt-BR')
  }
  return new Date(c.updated_at).toLocaleString('pt-BR')
}

/**
 * Mensageiro ADM no canal financeiro (profissional/empresa).
 * @param {{ usuarioId: string }} props
 */
export default function CanalFinanceiroMensageiro({ usuarioId }) {
  const [loading, setLoading] = useState(true)
  const [conversaAberta, setConversaAberta] = useState(
    /** @type {import('@/lib/financeiroConversas').FinanceiroConversaRow | null} */ (null),
  )
  const [arquivadas, setArquivadas] = useState(
    /** @type {import('@/lib/financeiroConversas').FinanceiroConversaRow[]} */ ([]),
  )
  const [conversaVisualId, setConversaVisualId] = useState(/** @type {string | null} */ (null))
  const [perfisAdm, setPerfisAdm] = useState(
    /** @type {Map<string, import('@/lib/financeiroConversas').PerfilAdmFinanceiro>} */ (new Map()),
  )
  const [mensagens, setMensagens] = useState(
    /** @type {import('@/lib/financeiroConversas').FinanceiroMensagemRow[]} */ ([]),
  )
  const [novaMensagem, setNovaMensagem] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [paddingTeclado, setPaddingTeclado] = useState(0)
  const [anexo, setAnexo] = useState(/** @type {File | null} */ (null))
  const [anexoPreview, setAnexoPreview] = useState(/** @type {string | null} */ (null))
  const [gravandoAudio, setGravandoAudio] = useState(false)
  const [segundosGravacao, setSegundosGravacao] = useState(0)

  const textareaRef = useRef(/** @type {HTMLTextAreaElement | null} */ (null))
  const fileInputRef = useRef(/** @type {HTMLInputElement | null} */ (null))
  const messagesEndRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const gravandoAudioRef = useRef(false)
  const gravacaoSolicitadaRef = useRef(false)
  const enviarAoPararGravacaoRef = useRef(true)
  const mediaRecorderRef = useRef(/** @type {MediaRecorder | null} */ (null))
  const audioChunksRef = useRef(/** @type {BlobPart[]} */ ([]))
  const streamAudioRef = useRef(/** @type {MediaStream | null} */ (null))
  const gravacaoInicioRef = useRef(0)
  const gravacaoTimerRef = useRef(/** @type {ReturnType<typeof setInterval> | null} */ (null))
  const finalizarGravacaoAudioRef = useRef(
    /** @type {(enviar: boolean) => Promise<void>} */ (async () => {}),
  )

  const idAtivo = conversaVisualId

  const conversaAtual = useMemo(() => {
    if (!idAtivo) return null
    if (conversaAberta?.id === idAtivo) return conversaAberta
    return arquivadas.find((c) => c.id === idAtivo) ?? null
  }, [idAtivo, conversaAberta, arquivadas])

  const todasConversas = useMemo(() => {
    const list = /** @type {import('@/lib/financeiroConversas').FinanceiroConversaRow[]} */ ([])
    if (conversaAberta) list.push(conversaAberta)
    for (const c of arquivadas) {
      if (!list.some((x) => x.id === c.id)) list.push(c)
    }
    return list
  }, [conversaAberta, arquivadas])

  const podeResponder =
    conversaAtual != null &&
    conversaAtual.status === 'aberta' &&
    conversaAtual.iniciada_por_adm &&
    conversaAtual.id === conversaAberta?.id

  const emLista = !idAtivo

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [])

  const carregarConversas = useCallback(async () => {
    if (!usuarioId) return
    setLoading(true)
    try {
      const [aberta, todas] = await Promise.all([
        buscarConversaAbertaParaAlvo(supabase, usuarioId),
        listarConversasFinanceiroParaAlvo(supabase, usuarioId),
      ])
      const encerradas = todas.filter((c) => c.status === 'encerrada')
      setConversaAberta(aberta)
      setArquivadas(encerradas)
      setConversaVisualId(null)

      const admIds = [...new Set(todas.map((c) => c.adm_usuario_id))]
      const perfis = await buscarPerfisAdmFinanceiro(supabase, admIds)
      setPerfisAdm(perfis)
    } finally {
      setLoading(false)
    }
  }, [usuarioId])

  const carregarMensagens = useCallback(
    async (conversaId) => {
      if (!conversaId) {
        setMensagens([])
        return
      }
      const msgs = await listarMensagensConversa(supabase, conversaId)
      setMensagens(msgs)
      requestAnimationFrame(() => scrollToBottom())
    },
    [scrollToBottom],
  )

  useEffect(() => {
    void carregarConversas()
  }, [carregarConversas])

  useEffect(() => {
    if (idAtivo) void carregarMensagens(idAtivo)
    else setMensagens([])
  }, [idAtivo, carregarMensagens])

  useEffect(() => {
    if (!idAtivo) return
    const ch = supabase
      .channel(`financeiro-msg-${idAtivo}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'financeiro_mensagens',
          filter: `conversa_id=eq.${idAtivo}`,
        },
        () => {
          void carregarMensagens(idAtivo)
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [idAtivo, carregarMensagens])

  useEffect(() => {
    if (!podeResponder) return

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
  }, [podeResponder])

  useEffect(() => {
    if (!podeResponder) return
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 36), 96)}px`
  }, [novaMensagem, podeResponder])

  gravandoAudioRef.current = gravandoAudio

  const limparTimerGravacao = useCallback(() => {
    if (gravacaoTimerRef.current) {
      clearInterval(gravacaoTimerRef.current)
      gravacaoTimerRef.current = null
    }
  }, [])

  const pararStreamGravacao = useCallback(() => {
    streamAudioRef.current?.getTracks().forEach((t) => t.stop())
    streamAudioRef.current = null
  }, [])

  const uploadAnexo = useCallback(
    async (arquivoUpload, anexoTipoForcado) => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session || !idAtivo) throw new Error('Sessão inválida')

      let fileExt =
        arquivoUpload.type === 'image/jpeg' ? 'jpg' : arquivoUpload.name.split('.').pop() || 'bin'
      if (anexoTipoForcado === 'audio' || arquivoUpload.type.startsWith('audio/')) {
        fileExt = extensaoAudioGravacao(arquivoUpload.type || 'audio/webm')
      }
      const fileName = `${Date.now()}.${fileExt}`
      const filePath = `${session.user.id}/financeiro/${idAtivo}/${fileName}`

      const contentType =
        anexoTipoForcado === 'audio' || arquivoUpload.type.startsWith('audio/')
          ? contentTypeUploadAudio(arquivoUpload.type || 'audio/webm')
          : arquivoUpload.type || 'application/octet-stream'

      const { error: uploadError } = await supabase.storage.from('mensagens').upload(filePath, arquivoUpload, {
        upsert: true,
        contentType,
        cacheControl: '31536000',
      })
      if (uploadError) throw uploadError

      const { data: pub } = supabase.storage.from('mensagens').getPublicUrl(filePath)
      let anexoTipo = anexoTipoForcado
      if (!anexoTipo) {
        if (arquivoUpload.type.startsWith('image/')) anexoTipo = 'imagem'
        else if (arquivoUpload.type.startsWith('audio/')) anexoTipo = 'audio'
        else anexoTipo = 'documento'
      }
      return { url: pub.publicUrl, tipo: anexoTipo }
    },
    [idAtivo],
  )

  const enviarComAnexo = useCallback(
    async (texto, arquivo, anexoTipoForcado) => {
      if (!idAtivo || !podeResponder) return
      let anexoUrl = null
      let anexoTipo = null
      if (arquivo) {
        let arquivoUpload = arquivo
        if (arquivo.type.startsWith('image/')) {
          arquivoUpload = await compressImageFileForStoryUpload(arquivo, {
            maxWidth: 960,
            jpegQuality: 0.82,
            maxBytesSkip: 280_000,
          })
        }
        const up = await uploadAnexo(arquivoUpload, anexoTipoForcado ?? null)
        anexoUrl = up.url
        anexoTipo = up.tipo
      }
      const res = await enviarMensagemConversaFinanceiro(supabase, {
        conversaId: idAtivo,
        remetenteId: usuarioId,
        texto: texto || null,
        anexo_url: anexoUrl,
        anexo_tipo: anexoTipo,
      })
      if (res.ok && res.mensagem) {
        setMensagens((prev) => [...prev, res.mensagem])
        requestAnimationFrame(() => scrollToBottom())
      }
    },
    [idAtivo, podeResponder, uploadAnexo, usuarioId, scrollToBottom],
  )

  const handleEnviar = async () => {
    const texto = novaMensagem.trim()
    if ((!texto && !anexo) || enviando || gravandoAudio || !podeResponder) return
    setEnviando(true)
    const anexoEnviar = anexo
    setNovaMensagem('')
    setAnexo(null)
    setAnexoPreview(null)
    try {
      await enviarComAnexo(texto, anexoEnviar, null)
    } catch (e) {
      console.error('Erro ao enviar:', e)
      setNovaMensagem(texto)
      if (anexoEnviar) setAnexo(anexoEnviar)
    } finally {
      setEnviando(false)
    }
  }

  const iniciarGravacaoAudio = useCallback(async () => {
    if (enviando || gravandoAudioRef.current || !podeResponder || typeof navigator === 'undefined') return
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return

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
    } catch (e) {
      console.error('Microfone:', e)
      pararStreamGravacao()
      setGravandoAudio(false)
      gravacaoSolicitadaRef.current = false
    }
  }, [enviando, podeResponder, limparTimerGravacao, pararStreamGravacao])

  const finalizarGravacaoAudio = useCallback(
    async (enviar) => {
      enviarAoPararGravacaoRef.current = enviar
      if (!gravandoAudioRef.current && !mediaRecorderRef.current) {
        gravacaoSolicitadaRef.current = false
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
        await enviarComAnexo('', file, 'audio')
      } catch (e) {
        console.error('Áudio:', e)
      } finally {
        setEnviando(false)
      }
    },
    [enviarComAnexo, limparTimerGravacao, pararStreamGravacao],
  )
  finalizarGravacaoAudioRef.current = finalizarGravacaoAudio

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-8 text-sm text-gray-500">
        Carregando mensageiro…
      </div>
    )
  }

  if (emLista) {
    if (todasConversas.length === 0) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center text-sm text-gray-500">
          Nenhuma conversa iniciada pela administração.
        </div>
      )
    }

    return (
      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
        {todasConversas.map((c) => {
          const adm = perfisAdm.get(c.adm_usuario_id)
          const dataRotulo = rotuloDataConversa(c)
          const statusRotulo = c.status === 'aberta' ? 'Em andamento' : 'Encerrada'
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setConversaVisualId(c.id)}
                className="flex w-full items-center gap-3 rounded-xl bg-[#0097b2] px-3 py-2 text-left shadow-sm hover:bg-[#008099]"
              >
                <AvatarImage
                  src={adm?.fotoUrl ?? null}
                  alt=""
                  width={40}
                  height={40}
                  className={`${AVATAR_QUADRADO} ring-2 ring-white`}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-white">
                    {adm?.nome ?? 'Administração'}
                  </div>
                  <div className="text-xs text-white/90">
                    {statusRotulo} · {dataRotulo}
                  </div>
                  {c.assunto ? (
                    <div className="truncate text-xs text-white/80">{c.assunto}</div>
                  ) : null}
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    )
  }

  const admDialogo = conversaAtual ? perfisAdm.get(conversaAtual.adm_usuario_id) : null
  const metaDialogo = conversaAtual
    ? `${conversaAtual.status === 'aberta' ? 'Em andamento' : 'Encerrada'} · ${rotuloDataConversa(conversaAtual)}`
    : null

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <FinanceiroDialogoVisual
        mensagens={mensagens}
        viewerUserId={usuarioId}
        assunto={conversaAtual?.assunto}
        onFechar={() => setConversaVisualId(null)}
        messagesEndRef={messagesEndRef}
        cabecalhoHistorico
        cabecalhoNome={admDialogo?.nome ?? 'Administração'}
        cabecalhoFotoUrl={admDialogo?.fotoUrl ?? null}
        cabecalhoMeta={metaDialogo}
      />

      {podeResponder ? (
        <div
          className="sticky bottom-0 z-20 shrink-0 border-t border-gray-200 bg-white px-2 py-2"
          style={{ paddingBottom: paddingTeclado > 0 ? paddingTeclado : undefined }}
        >
          {gravandoAudio ? (
            <div className="mb-2 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              <span className="font-medium">Gravando…</span>
              <span className="tabular-nums">
                {Math.floor(segundosGravacao / 60)}:{String(segundosGravacao % 60).padStart(2, '0')}
              </span>
              <span className="text-xs">Solte para enviar</span>
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
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (!f) return
                setAnexo(f)
                if (f.type.startsWith('image/')) {
                  const reader = new FileReader()
                  reader.onloadend = () => {
                    setAnexoPreview(typeof reader.result === 'string' ? reader.result : null)
                  }
                  reader.readAsDataURL(f)
                } else {
                  setAnexoPreview(null)
                }
              }}
            />
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
              disabled={enviando || gravandoAudio}
              enterKeyHint="send"
              onChange={(e) => setNovaMensagem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void handleEnviar()
                }
              }}
              placeholder="Responder à administração…"
              className="max-h-24 min-h-10 min-w-0 flex-1 resize-none rounded-full border border-gray-200 bg-gray-100 px-4 py-2 text-sm leading-5 text-black placeholder:text-gray-400 focus:border-[#0097b2] focus:outline-none focus:ring-1 focus:ring-[#0097b2] disabled:opacity-60"
            />
            {novaMensagem.trim() || anexo ? (
              <button
                type="submit"
                disabled={enviando || gravandoAudio}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center self-end rounded-full bg-[#00D443] text-white disabled:opacity-50"
                aria-label="Enviar"
              >
                <Send className="h-5 w-5" aria-hidden />
              </button>
            ) : (
              <button
                type="button"
                disabled={enviando}
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
                  void finalizarGravacaoAudioRef.current(enviarAoPararGravacaoRef.current)
                }}
                onPointerCancel={() => {
                  void finalizarGravacaoAudioRef.current(false)
                }}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center self-end rounded-full bg-[#00D443] text-white disabled:opacity-50"
                aria-label="Gravar áudio"
              >
                <Mic className="h-5 w-5" aria-hidden />
              </button>
            )}
          </form>
        </div>
      ) : null}
    </div>
  )
}
