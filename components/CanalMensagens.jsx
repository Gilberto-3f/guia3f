'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { Send, Paperclip, Image as ImageIcon } from 'lucide-react'

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
 * @param {{ mensagem: Record<string, unknown> }} args
 */
async function buscarRemetente({ mensagem }) {
  const remetenteId = mensagem.remetente_id
  if (!remetenteId) {
    return { id: '', nome: 'Usuário', foto_url: null, role: '' }
  }

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('id, email, role')
    .eq('id', remetenteId)
    .maybeSingle()

  const email = usuario?.email ?? ''
  let nome = email ? email.split('@')[0] : 'Usuário'
  let foto = null
  const role = usuario?.role ?? ''

  if (usuario?.role === 'turista') {
    const { data: turista } = await supabase
      .from('turistas')
      .select('nome_completo, foto_perfil_url')
      .eq('usuario_id', usuario.id)
      .maybeSingle()
    if (turista?.nome_completo) nome = String(turista.nome_completo)
    if (turista?.foto_perfil_url) foto = String(turista.foto_perfil_url)
  } else if (usuario?.role === 'profissional') {
    const { data: profissional } = await supabase
      .from('profissionais')
      .select('nome_completo, foto_perfil_url')
      .eq('usuario_id', usuario.id)
      .maybeSingle()
    if (profissional?.nome_completo) nome = String(profissional.nome_completo)
    if (profissional?.foto_perfil_url) foto = String(profissional.foto_perfil_url)
  } else if (usuario?.role === 'empresa') {
    const { data: empresa } = await supabase
      .from('empresas')
      .select('nome_fantasia, foto_url')
      .eq('usuario_id', usuario.id)
      .maybeSingle()
    if (empresa?.nome_fantasia) nome = String(empresa.nome_fantasia)
    if (empresa?.foto_url) foto = String(empresa.foto_url)
  }

  return {
    id: usuario?.id != null ? String(usuario.id) : '',
    nome,
    foto_url: foto,
    role,
  }
}

/**
 * @param {{
 *   canalId: string
 *   paisTab?: string
 *   podePostar: boolean
 *   podeReagir: boolean
 * }} props
 */
export default function CanalMensagens({ canalId, paisTab = 'geral', podePostar, podeReagir }) {
  /** @type {Array<{ id: string, texto: string | null, anexo_url: string | null, anexo_tipo: string | null, reacoes: unknown[], created_at: string, remetente: { id: string, nome: string, foto_url: string | null, role: string } }>} */
  const [mensagens, setMensagens] = useState([])
  const [novaMensagem, setNovaMensagem] = useState('')
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [anexo, setAnexo] = useState(/** @type {File | null} */ (null))
  const [anexoPreview, setAnexoPreview] = useState(/** @type {string | null} */ (null))
  const [uid, setUid] = useState(/** @type {string | null} */ (null))
  const messagesEndRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const fileInputRef = useRef(/** @type {HTMLInputElement | null} */ (null))

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const carregarMensagens = useCallback(async () => {
    if (!canalId) return
    setLoading(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      setUid(session?.user?.id ?? null)

      let q = supabase.from('mensagens_canal').select('*').eq('canal_id', canalId)

      if (paisTab && paisTab !== 'geral') {
        q = q.or(`pais.eq.${paisTab},pais.eq.geral`)
      }

      const { data, error } = await q.order('created_at', { ascending: true }).limit(80)

      if (error) throw error

      const mensagensCompletas = await Promise.all(
        (data ?? []).map(async (msg) => {
          const m = /** @type {Record<string, unknown>} */ (msg)
          const remetente = await buscarRemetente({ mensagem: m })
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
      )

      setMensagens(mensagensCompletas)
      setTimeout(scrollToBottom, 100)
    } catch (e) {
      console.error('Erro ao carregar mensagens:', e)
    } finally {
      setLoading(false)
    }
  }, [canalId, paisTab])

  useEffect(() => {
    void carregarMensagens()
  }, [carregarMensagens])

  useEffect(() => {
    if (!canalId) return

    const channel = supabase
      .channel(`mensagens-canal-${canalId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensagens_canal', filter: `canal_id=eq.${canalId}` },
        async (payload) => {
          const row = /** @type {Record<string, unknown>} */ (payload.new)
          const remetente = await buscarRemetente({ mensagem: row })
          setMensagens((prev) => {
            if (prev.some((p) => p.id === String(row.id))) return prev
            return [
              ...prev,
              {
                id: String(row.id),
                texto: row.texto != null ? String(row.texto) : null,
                anexo_url: row.anexo_url != null ? String(row.anexo_url) : null,
                anexo_tipo: row.anexo_tipo != null ? String(row.anexo_tipo) : null,
                reacoes: asReacoesArray(row.reacoes),
                created_at: String(row.created_at ?? ''),
                remetente,
              },
            ]
          })
          setTimeout(scrollToBottom, 100)
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [canalId])

  const handleEnviar = async () => {
    if (!novaMensagem.trim() && !anexo) return

    setEnviando(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) return

      let anexoUrl = null
      let anexoTipo = null

      if (anexo) {
        const fileExt = anexo.name.split('.').pop() || 'bin'
        const fileName = `${Date.now()}.${fileExt}`
        const filePath = `${session.user.id}/${canalId}/${fileName}`

        const { error: uploadError } = await supabase.storage.from('mensagens').upload(filePath, anexo)

        if (!uploadError) {
          const { data: pub } = supabase.storage.from('mensagens').getPublicUrl(filePath)
          anexoUrl = pub.publicUrl
          anexoTipo = anexo.type.startsWith('image/') ? 'imagem' : 'documento'
        }
      }

      const paisMsg = paisTab && paisTab !== 'geral' ? paisTab : 'geral'

      const { error } = await supabase.from('mensagens_canal').insert({
        canal_id: canalId,
        remetente_id: session.user.id,
        texto: novaMensagem.trim() || null,
        anexo_url: anexoUrl,
        anexo_tipo: anexoTipo,
        pais: paisMsg,
      })

      if (error) throw error

      setNovaMensagem('')
      setAnexo(null)
      setAnexoPreview(null)
      await carregarMensagens()
    } catch (e) {
      console.error('Erro ao enviar mensagem:', e)
    } finally {
      setEnviando(false)
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

  /**
   * @param {string} data
   */
  const formatarData = (data) => {
    const date = new Date(data)
    const hoje = new Date()
    const ontem = new Date(hoje)
    ontem.setDate(ontem.getDate() - 1)

    if (date.toDateString() === hoje.toDateString()) {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }
    if (date.toDateString() === ontem.toDateString()) {
      return `Ontem ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    }
    return date.toLocaleDateString('pt-BR')
  }

  if (!canalId) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 text-gray-400">Selecione um canal.</div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="animate-pulse text-gray-400">Carregando mensagens...</div>
      </div>
    )
  }

  const emojis = ['👍', '❤️', '😂', '😮', '😢', '😡']

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {mensagens.length === 0 ? (
          <div className="py-8 text-center text-gray-400">Nenhuma mensagem ainda. Seja o primeiro a enviar!</div>
        ) : (
          mensagens.map((msg) => (
            <div key={msg.id} className="flex gap-3">
              {msg.remetente.foto_url ? (
                <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full">
                  <Image src={msg.remetente.foto_url} alt="" width={32} height={32} className="object-cover" />
                </div>
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200">
                  <span className="text-xs text-gray-500">{msg.remetente.nome.charAt(0).toUpperCase()}</span>
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-gray-800">{msg.remetente.nome}</span>
                  <span className="text-xs text-gray-400">{formatarData(msg.created_at)}</span>
                </div>

                {msg.texto ? <p className="mb-2 text-sm text-gray-700">{msg.texto}</p> : null}

                {msg.anexo_url && msg.anexo_tipo === 'imagem' ? (
                  <div className="relative mb-2 h-40 max-w-[200px]">
                    <Image src={msg.anexo_url} alt="" fill className="rounded-lg object-cover" sizes="200px" />
                  </div>
                ) : null}

                {msg.anexo_url && msg.anexo_tipo === 'documento' ? (
                  <a
                    href={msg.anexo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mb-2 inline-flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1 text-sm text-gray-600 hover:bg-gray-200"
                  >
                    <Paperclip size={14} aria-hidden />
                    Ver anexo
                  </a>
                ) : null}

                {podeReagir ? (
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {emojis.map((emoji) => {
                      const reacoes = /** @type {{ usuario_id: string, tipo: string }[]} */ (asReacoesArray(msg.reacoes))
                      const ativo = uid ? reacoes.some((r) => r.usuario_id === uid && r.tipo === emoji) : false
                      return (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => void handleReagir(msg.id, emoji)}
                          className={`rounded-full p-1 text-sm hover:bg-gray-100 ${ativo ? 'opacity-100' : 'opacity-60'}`}
                        >
                          {emoji}
                        </button>
                      )
                    })}
                    {asReacoesArray(msg.reacoes).length > 0 ? (
                      <span className="ml-1 text-xs text-gray-400">{asReacoesArray(msg.reacoes).length}</span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {podePostar ? (
        <div className="border-t border-gray-100 bg-white p-4">
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

          <div className="flex gap-2">
            <input
              type="text"
              value={novaMensagem}
              onChange={(e) => setNovaMensagem(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleEnviar()}
              placeholder="Digite sua mensagem..."
              className="flex-1 rounded-lg border border-gray-200 p-2 focus:outline-none focus:ring-2 focus:ring-[#0097b2]"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-gray-500 hover:text-[#0097b2]"
              aria-label="Anexo"
            >
              <ImageIcon size={20} />
            </button>
            <button
              type="button"
              onClick={() => void handleEnviar()}
              disabled={(!novaMensagem.trim() && !anexo) || enviando}
              className="rounded-lg bg-[#0097b2] p-2 text-white disabled:opacity-50"
              aria-label="Enviar"
            >
              <Send size={20} />
            </button>
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
        </div>
      ) : null}
    </div>
  )
}
