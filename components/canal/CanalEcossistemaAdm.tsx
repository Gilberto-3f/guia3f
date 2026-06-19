'use client'

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import { AlertTriangle, ChevronUp, MapPin, Send, UserRound } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import AvatarImage from '@/components/AvatarImage'
import CanalNaoLidasBadge from '@/components/CanalNaoLidasBadge'
import { buscarVistoEmOutroEcossistema, mapMensagemEcossistemaPayload, type EcossistemaConversaRow, type EcossistemaMensagemRow } from '@/lib/ecossistemaConversas'
import { notificarBadgeCanais } from '@/lib/canais-badge-events'
import { idUltimaMensagemPropriaVistaPeloOutro } from '@/lib/chatVisto'
import ChatReciboVisto from '@/components/chat/ChatReciboVisto'
import type { ProfissionalAtendimentoTurista } from '@/lib/emergenciaTurista'

type AbaEcossistema = 'turista' | 'profissional' | 'empresa' | 'historico'

type MembroCard = {
  usuarioId: string
  nome: string
  username: string
  fotoUrl: string | null
  subtitulo: string
  tipo: 'turista' | 'profissional' | 'empresa'
}

type ConversaComMembro = EcossistemaConversaRow & { membro: MembroCard; nao_lidas?: number }

type NaoLidasPorAba = Record<'turista' | 'profissional' | 'empresa', number>

const naoLidasPorAbaVazio = (): NaoLidasPorAba => ({ turista: 0, profissional: 0, empresa: 0 })

const COR_LOGO = '#0097b2'

function formatarDataHora(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function bordaConversa(c: ConversaComMembro): string {
  if (c.status !== 'aberta') return 'border-gray-200 bg-white'
  if (c.motivo_emergencia === 'perdido') return 'border-[#0097b2] bg-[#0097b2]/5'
  if (c.motivo_emergencia === 'item_esquecido') return 'border-amber-300 bg-amber-50/60'
  if (c.urgente) return 'border-red-300 bg-red-50/60'
  return 'border-gray-200 bg-white'
}

const abaCls = (ativo: boolean) =>
  `flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold transition-colors sm:text-sm ${
    ativo ? 'bg-[#00D443] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
  }`

/**
 * Hub Mensageiro ECOSSISTEMA — ADM atende chats iniciados pelos membros.
 */
export default function CanalEcossistemaAdm({
  embedded = false,
  fecharPainelRef,
}: {
  embedded?: boolean
  fecharPainelRef?: MutableRefObject<(() => boolean) | null>
}) {
  const [aba, setAba] = useState<AbaEcossistema>('turista')
  const [conversas, setConversas] = useState<ConversaComMembro[]>([])
  const [naoLidasPorAba, setNaoLidasPorAba] = useState<NaoLidasPorAba>(naoLidasPorAbaVazio)
  const [selecionada, setSelecionada] = useState<ConversaComMembro | null>(null)
  const [mensagens, setMensagens] = useState<EcossistemaMensagemRow[]>([])
  const [textoMsg, setTextoMsg] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [painelAberto, setPainelAberto] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [adminUserId, setAdminUserId] = useState('')
  const [vistoEmOutroMs, setVistoEmOutroMs] = useState(0)
  const [profissionaisItem, setProfissionaisItem] = useState<ProfissionalAtendimentoTurista[]>([])
  const [carregandoProfissionais, setCarregandoProfissionais] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const painelAbertoRef = useRef(false)

  useEffect(() => {
    painelAbertoRef.current = painelAberto
  }, [painelAberto])

  useEffect(() => {
    if (!fecharPainelRef) return
    fecharPainelRef.current = () => {
      if (!painelAbertoRef.current) return false
      setPainelAberto(false)
      return true
    }
    return () => {
      fecharPainelRef.current = null
    }
  }, [fecharPainelRef])

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setAdminUserId(data.session?.user?.id ?? '')
    })
  }, [])

  const atualizarVistoOutro = useCallback(
    async (conversaId: string, membroUsuarioId: string) => {
      if (!adminUserId) return
      const ms = await buscarVistoEmOutroEcossistema(supabase, conversaId, adminUserId, membroUsuarioId)
      setVistoEmOutroMs(ms)
    },
    [adminUserId],
  )

  const carregarLista = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true)
    try {
      const status = aba === 'historico' ? 'encerrada' : 'aberta'
      const qs =
        aba === 'historico'
          ? ''
          : `&membro_tipo=${encodeURIComponent(aba)}`
      const res = await fetch(
        `/api/admin/ecossistema-conversas?status=${status === 'aberta' ? 'aberta' : 'encerrada'}${qs}`,
      )
      const json = (await res.json()) as {
        ok?: boolean
        conversas?: ConversaComMembro[]
        nao_lidas_por_aba?: NaoLidasPorAba
      }
      setConversas(json.conversas ?? [])
      if (json.nao_lidas_por_aba) setNaoLidasPorAba(json.nao_lidas_por_aba)
    } catch {
      if (!silencioso) setConversas([])
    } finally {
      if (!silencioso) setCarregando(false)
    }
  }, [aba])

  const carregarMensagens = useCallback(
    async (conversaId: string, membroUsuarioId: string) => {
      const res = await fetch(`/api/admin/ecossistema-conversas/${conversaId}/mensagens`)
      const json = (await res.json()) as { mensagens?: EcossistemaMensagemRow[] }
      setMensagens(json.mensagens ?? [])
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
      void atualizarVistoOutro(conversaId, membroUsuarioId)
    },
    [atualizarVistoOutro],
  )

  useEffect(() => {
    void carregarLista()
    setSelecionada(null)
    setPainelAberto(false)
  }, [carregarLista])

  useEffect(() => {
    const ch = supabase
      .channel('eco-adm-hub-lista')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ecossistema_mensagens' },
        () => {
          void carregarLista(true)
          notificarBadgeCanais()
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ecossistema_conversas' },
        () => {
          void carregarLista(true)
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(ch)
    }
  }, [carregarLista])

  useEffect(() => {
    if (!selecionada?.id || !painelAberto) return
    void (async () => {
      await carregarMensagens(selecionada.id, selecionada.membro_usuario_id)
      await carregarLista(true)
      notificarBadgeCanais()
    })()

    const ch = supabase
      .channel(`eco-adm-${selecionada.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ecossistema_mensagens',
          filter: `conversa_id=eq.${selecionada.id}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>
          if (!row?.id) return
          const nova = mapMensagemEcossistemaPayload(row)
          setMensagens((prev) => {
            if (prev.some((m) => m.id === nova.id)) return prev
            return [...prev, nova]
          })
          messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
          notificarBadgeCanais()
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ecossistema_conversa_leitura',
          filter: `conversa_id=eq.${selecionada.id}`,
        },
        () => {
          void atualizarVistoOutro(selecionada.id, selecionada.membro_usuario_id)
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(ch)
    }
  }, [selecionada?.id, selecionada?.membro_usuario_id, painelAberto, carregarMensagens, carregarLista, atualizarVistoOutro])

  useEffect(() => {
    if (!selecionada || selecionada.motivo_emergencia !== 'item_esquecido') {
      setProfissionaisItem([])
      return
    }
    let ativo = true
    setCarregandoProfissionais(true)
    void (async () => {
      try {
        const res = await fetch(
          `/api/admin/emergencia-profissionais-turista?turista_id=${encodeURIComponent(selecionada.membro_usuario_id)}`,
        )
        const json = (await res.json()) as { ok?: boolean; profissionais?: ProfissionalAtendimentoTurista[] }
        if (ativo) setProfissionaisItem(json.profissionais ?? [])
      } catch {
        if (ativo) setProfissionaisItem([])
      } finally {
        if (ativo) setCarregandoProfissionais(false)
      }
    })()
    return () => {
      ativo = false
    }
  }, [selecionada?.id, selecionada?.motivo_emergencia, selecionada?.membro_usuario_id])

  useEffect(() => {
    if (!selecionada?.id || selecionada.motivo_emergencia !== 'perdido' || !painelAberto) return

    const ch = supabase
      .channel(`eco-adm-loc-${selecionada.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ecossistema_conversas',
          filter: `id=eq.${selecionada.id}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown> | undefined
          if (!row) return
          const lat = row.loc_lat != null ? Number(row.loc_lat) : null
          const lng = row.loc_lng != null ? Number(row.loc_lng) : null
          const locAtualizada =
            row.loc_atualizada_em != null ? String(row.loc_atualizada_em) : selecionada.loc_atualizada_em
          setSelecionada((prev) =>
            prev && prev.id === selecionada.id
              ? {
                  ...prev,
                  loc_lat: lat,
                  loc_lng: lng,
                  loc_atualizada_em: locAtualizada,
                }
              : prev,
          )
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(ch)
    }
  }, [selecionada?.id, selecionada?.motivo_emergencia, painelAberto, selecionada?.loc_atualizada_em])

  const abrirConversa = (c: ConversaComMembro) => {
    setSelecionada(c)
    setPainelAberto(true)
    void fetch('/api/admin/ecossistema-conversas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversa_id: c.id }),
    })
  }

  const enviarMensagem = async () => {
    if (!selecionada?.id || !textoMsg.trim() || enviando) return
    setEnviando(true)
    try {
      const res = await fetch(`/api/admin/ecossistema-conversas/${selecionada.id}/mensagens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: textoMsg.trim() }),
      })
      const json = (await res.json()) as { ok?: boolean; mensagem?: EcossistemaMensagemRow; error?: string }
      if (!json.ok || !json.mensagem) {
        window.alert(json.error ?? 'Falha ao enviar.')
        return
      }
      setMensagens((prev) => {
        if (prev.some((m) => m.id === json.mensagem!.id)) return prev
        return [...prev, json.mensagem!]
      })
      setTextoMsg('')
      notificarBadgeCanais()
    } finally {
      setEnviando(false)
    }
  }

  const encerrarConversa = async () => {
    if (!selecionada?.id) return
    if (!window.confirm('Encerrar este diálogo? O usuário verá o registro na aba Decisões.')) return
    const res = await fetch(`/api/admin/ecossistema-conversas/${selecionada.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'encerrar' }),
    })
    const json = (await res.json()) as { ok?: boolean; error?: string }
    if (!json.ok) {
      window.alert(json.error ?? 'Erro ao encerrar.')
      return
    }
    setPainelAberto(false)
    setSelecionada(null)
    void carregarLista()
  }

  const wrapperCls = embedded
    ? 'relative flex min-h-0 flex-1 flex-col overflow-hidden'
    : 'relative mx-auto flex w-full max-w-3xl min-h-[70vh] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm'

  const mensagemVistoId =
    adminUserId && selecionada
      ? idUltimaMensagemPropriaVistaPeloOutro(mensagens, adminUserId, vistoEmOutroMs)
      : null

  return (
    <div className={wrapperCls}>
      <div className="shrink-0 border-b border-gray-100 bg-white p-3">
        <div className="flex gap-1">
          {(['turista', 'profissional', 'empresa', 'historico'] as AbaEcossistema[]).map((t) => (
            <button key={t} type="button" onClick={() => setAba(t)} className={abaCls(aba === t)}>
              <span>
                {t === 'historico' ? 'Histórico' : t === 'turista' ? 'Turistas' : t === 'profissional' ? 'Profissionais' : 'Empresas'}
              </span>
              {t !== 'historico' ? <CanalNaoLidasBadge count={naoLidasPorAba[t]} /> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {carregando ? (
          <p className="text-center text-sm text-gray-500">Carregando...</p>
        ) : conversas.length === 0 ? (
          <p className="rounded-lg bg-gray-50 p-6 text-center text-sm text-gray-500">
            {aba === 'historico' ? 'Nenhuma conversa encerrada.' : 'Nenhum chat aguardando nesta categoria.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {conversas.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => abrirConversa(c)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition hover:bg-gray-50 ${bordaConversa(c)}`}
                >
                  <AvatarImage
                    src={c.membro.fotoUrl}
                    alt=""
                    width={44}
                    height={44}
                    className="h-11 w-11 shrink-0 rounded-md object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold text-gray-900">{c.membro.nome}</span>
                      {c.motivo_emergencia === 'perdido' && c.status === 'aberta' ? (
                        <MapPin className="h-4 w-4 shrink-0 text-[#0097b2]" aria-hidden />
                      ) : null}
                      {c.urgente && c.status === 'aberta' && c.motivo_emergencia !== 'perdido' ? (
                        <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" aria-hidden />
                      ) : null}
                      {(c.nao_lidas ?? 0) > 0 ? <CanalNaoLidasBadge count={c.nao_lidas ?? 0} /> : null}
                    </div>
                    <div className="truncate text-xs text-[#0097b2]">{c.membro.username}</div>
                    {c.membro.subtitulo ? (
                      <div className="truncate text-xs text-gray-500">{c.membro.subtitulo}</div>
                    ) : null}
                  </div>
                  <ChevronUp className="h-5 w-5 shrink-0 rotate-90 text-gray-400" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {painelAberto && selecionada ? (
        <div className="absolute inset-0 z-20 flex flex-col bg-white sm:relative sm:inset-auto sm:shrink-0 sm:border-t sm:border-gray-200">
          <div className="flex shrink-0 items-center gap-2 bg-[#0097b2] px-3 py-2 text-white">
            <div className="min-w-0 flex-1 truncate font-semibold">
              {selecionada.membro.nome} · {selecionada.membro.username}
            </div>
            {selecionada.status === 'aberta' ? (
              <button
                type="button"
                onClick={() => void encerrarConversa()}
                className="shrink-0 rounded-lg bg-white/15 px-2 py-1 text-xs font-semibold hover:bg-white/25"
              >
                Encerrar
              </button>
            ) : null}
          </div>

          {selecionada.motivo_emergencia === 'item_esquecido' ? (
            <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-3 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
                Item esquecido — últimos profissionais
              </p>
              {carregandoProfissionais ? (
                <p className="mt-2 text-xs text-amber-700">Carregando profissionais...</p>
              ) : profissionaisItem.length === 0 ? (
                <p className="mt-2 text-xs text-amber-700">Nenhum atendimento recente encontrado.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {profissionaisItem.map((p) => (
                    <li
                      key={p.profissional_id}
                      className="flex items-center gap-2 rounded-lg border border-amber-200 bg-white px-2 py-2"
                    >
                      <AvatarImage
                        src={p.foto_url}
                        alt=""
                        width={36}
                        height={36}
                        className="h-9 w-9 shrink-0 rounded-md object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-gray-900">{p.nome}</div>
                        <div className="truncate text-xs text-[#0097b2]">
                          {p.username ? (p.username.startsWith('@') ? p.username : `@${p.username}`) : '—'}
                        </div>
                        <div className="text-xs text-gray-500">
                          Atendimento: {formatarDataHora(p.atendimento_em)}
                        </div>
                      </div>
                      <UserRound className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {selecionada.motivo_emergencia === 'perdido' ? (
            <div className="shrink-0 border-b border-[#0097b2]/30 bg-[#0097b2]/10 px-3 py-3">
              <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-[#007d94]">
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                Localização em tempo real
              </p>
              {selecionada.loc_lat != null &&
              selecionada.loc_lng != null &&
              Number.isFinite(selecionada.loc_lat) &&
              Number.isFinite(selecionada.loc_lng) ? (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-gray-700">
                    {selecionada.loc_lat.toFixed(5)}, {selecionada.loc_lng.toFixed(5)}
                  </p>
                  {selecionada.loc_atualizada_em ? (
                    <p className="text-xs text-gray-500">
                      Atualizado: {formatarDataHora(selecionada.loc_atualizada_em)}
                    </p>
                  ) : null}
                  <a
                    href={`https://www.google.com/maps?q=${selecionada.loc_lat},${selecionada.loc_lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg bg-[#0097b2] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#007d94]"
                  >
                    <MapPin className="h-3.5 w-3.5" aria-hidden />
                    Abrir no mapa
                  </a>
                </div>
              ) : (
                <p className="mt-2 text-xs text-gray-600">Aguardando GPS do turista...</p>
              )}
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto bg-[#e5ddd5] px-3 py-3" style={{ maxHeight: embedded ? undefined : '280px' }}>
            {mensagens.map((m) => {
              const adm = m.remetente_id !== selecionada.membro_usuario_id
              return (
                <div key={m.id} className={`mb-2 flex ${adm ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm text-gray-900 shadow-sm ${
                      adm ? 'bg-[#dcf8c6]' : 'bg-white'
                    }`}
                  >
                    {m.texto}
                    {adm ? <ChatReciboVisto visivel={m.id === mensagemVistoId} /> : null}
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          {selecionada.status === 'aberta' ? (
            <div className="flex shrink-0 items-center gap-2 border-t border-gray-200 px-3 py-2">
              <input
                value={textoMsg}
                onChange={(e) => setTextoMsg(e.target.value)}
                placeholder="Responder..."
                className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void enviarMensagem()
                }}
              />
              <button
                type="button"
                disabled={!textoMsg.trim() || enviando}
                onClick={() => void enviarMensagem()}
                className="flex h-10 w-10 items-center justify-center rounded-full text-white disabled:opacity-50"
                style={{ backgroundColor: COR_LOGO }}
                aria-label="Enviar"
              >
                <Send className="h-5 w-5" aria-hidden />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
