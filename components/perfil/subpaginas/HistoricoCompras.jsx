'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import {
  Briefcase,
  ShoppingBag,
  Bed,
  Ticket,
  Car,
  ChevronDown,
  ChevronUp,
  UserRound,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  listarComprasTurista,
  marcarComprasTuristaComoVistas,
} from '@/lib/turistaCompras'
import { rotuloFormaPagamentoReservaHospedagem } from '@/lib/reservaHospedagem'
import { notificarBadgeCanais } from '@/lib/canais-badge-events'
import AvatarImage from '@/components/AvatarImage'
import UsuarioHandleVerificado from '@/components/UsuarioHandleVerificado'
import ChatCorridaMobilidade from '@/components/mobilidade/ChatCorridaMobilidade'
import PopupItemEsquecido from '@/components/perfil/subpaginas/emergencia/PopupItemEsquecido'

const STATUS_ROTULO = {
  pendente: 'Aguardando anfitrião',
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
  registrada: 'Registrada',
  concluida: 'Concluída',
}

function iconeCompra(tipo) {
  if (tipo === 'reserva_hospedagem') return Bed
  if (tipo === 'compra_ticket') return Ticket
  if (tipo === 'mobilidade' || tipo === 'mobilidade_corrida') return Car
  return ShoppingBag
}

function statusCls(status) {
  if (status === 'confirmada' || status === 'registrada' || status === 'concluida') {
    return 'bg-emerald-50 text-emerald-700'
  }
  if (status === 'pendente') return 'bg-amber-50 text-amber-700'
  if (status === 'cancelada') return 'bg-red-50 text-red-700'
  return 'bg-gray-100 text-gray-600'
}

function formatarData(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatarDataHora(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatBrl(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return null
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function rotuloPagamentoMobilidade(pag) {
  const p = String(pag ?? '').trim().toLowerCase()
  if (!p) return null
  if (p === 'dinheiro') return 'Dinheiro'
  if (p === 'pix') return 'Pix'
  if (p === 'cartao' || p === 'cartao_credito' || p === 'cartao_debito') return 'Cartão'
  return p
}

function ehMobilidade(tipo) {
  return tipo === 'mobilidade' || tipo === 'mobilidade_corrida'
}

/** @param {{ id?: string, referencia_id?: string | null, metadata?: Record<string, unknown> }} item */
function solicitacaoIdDoItem(item) {
  const meta = item.metadata && typeof item.metadata === 'object' ? item.metadata : {}
  if (meta.solicitacao_id != null && String(meta.solicitacao_id).trim()) {
    return String(meta.solicitacao_id).trim()
  }
  if (item.referencia_id != null && String(item.referencia_id).trim()) {
    return String(item.referencia_id).trim()
  }
  const id = String(item.id ?? '')
  if (id.startsWith('mob-')) return id.slice(4)
  return null
}

const STATUS_MOB_ATIVOS = new Set(['aceita', 'a_caminho', 'no_local', 'em_viagem', 'buscando', 'pendente'])

function podeItemEsquecido(item) {
  if (!ehMobilidade(item.tipo)) return false
  if (!solicitacaoIdDoItem(item)) return false
  return !STATUS_MOB_ATIVOS.has(String(item.status ?? '').toLowerCase())
}

function podeCancelarReserva(item) {
  if (String(item.tipo) !== 'reserva_hospedagem') return false
  const status = String(item.status ?? '')
  return status === 'pendente' || status === 'confirmada'
}

/**
 * @param {{ usuarioId: string | null }} props
 */
export default function HistoricoCompras({ usuarioId }) {
  const router = useRouter()
  const [aba, setAba] = useState(/** @type {'servicos' | 'compras'} */ ('compras'))
  const [loading, setLoading] = useState(true)
  const [itens, setItens] = useState(/** @type {import('@/lib/turistaCompras').TuristaCompraRow[]} */ ([]))
  const [mobilidadeExtra, setMobilidadeExtra] = useState([])
  const [abertoId, setAbertoId] = useState(/** @type {string | null} */ (null))
  const [cancelandoId, setCancelandoId] = useState(/** @type {string | null} */ (null))
  const [popupItemSolId, setPopupItemSolId] = useState(/** @type {string | null} */ (null))
  /** @type {[Record<string, { conversaId: string, status: string }>, Function]} */
  const [conversasPorSol, setConversasPorSol] = useState({})

  const carregar = useCallback(async () => {
    if (!usuarioId) {
      setItens([])
      setMobilidadeExtra([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const categoria = aba === 'servicos' ? 'servicos' : 'compras'
      const lista = await listarComprasTurista(supabase, usuarioId, { categoria, limit: 80 })
      setItens(lista)

      if (aba === 'servicos') {
        const { data: sols } = await supabase
          .from('solicitacao_mobilidade')
          .select(
            'id, status, created_at, profissional_id, origem_nome, destino_nome, valor_estimado, pagamento, lugares, data_agendada, profissionais(nome_completo, nome_usuario, foto_perfil_url, foto_url, usuario_id)',
          )
          .eq('turista_id', usuarioId)
          .order('created_at', { ascending: false })
          .limit(40)

        const refsCompra = new Set(
          lista.filter((i) => i.referencia_id).map((i) => String(i.referencia_id)),
        )

        const extra = (sols ?? [])
          .filter((s) => !refsCompra.has(String(s.id)))
          .map((s) => {
            const prof = s.profissionais && typeof s.profissionais === 'object' ? s.profissionais : null
            const nome =
              prof?.nome_completo != null
                ? String(prof.nome_completo)
                : prof?.nome_usuario != null
                  ? String(prof.nome_usuario)
                  : 'Profissional'
            const foto =
              prof?.foto_perfil_url != null && String(prof.foto_perfil_url).trim()
                ? String(prof.foto_perfil_url)
                : prof?.foto_url != null && String(prof.foto_url).trim()
                  ? String(prof.foto_url)
                  : null
            return {
              id: `mob-${s.id}`,
              titulo: nome,
              descricao:
                s.origem_nome || s.destino_nome
                  ? `${s.origem_nome ?? '—'} → ${s.destino_nome ?? '—'}`
                  : null,
              status: String(s.status ?? 'pendente'),
              registrado_em: String(s.created_at ?? ''),
              tipo: 'mobilidade',
              empresa_id: null,
              profissional_usuario_id: prof?.usuario_id != null ? String(prof.usuario_id) : null,
              pendente: false,
              metadata: {
                kind: 'mobilidade_corrida',
                solicitacao_id: String(s.id),
                profissional_nome: nome,
                profissional_username:
                  prof?.nome_usuario != null
                    ? String(prof.nome_usuario).replace(/^@+/, '')
                    : null,
                profissional_foto_url: foto,
                origem_nome: s.origem_nome != null ? String(s.origem_nome) : null,
                destino_nome: s.destino_nome != null ? String(s.destino_nome) : null,
                valor_estimado: s.valor_estimado != null ? Number(s.valor_estimado) : null,
                pagamento: s.pagamento != null ? String(s.pagamento) : null,
                lugares: s.lugares != null ? Number(s.lugares) : null,
                data_agendada: s.data_agendada != null ? String(s.data_agendada) : null,
                atendimento: s.data_agendada ? 'agendado' : 'imediato',
              },
            }
          })
        setMobilidadeExtra(extra)
      } else {
        setMobilidadeExtra([])
      }
    } finally {
      setLoading(false)
    }

    void marcarComprasTuristaComoVistas(supabase, usuarioId).then(() => {
      window.dispatchEvent(new CustomEvent('turista-compras-lidas'))
    })
  }, [usuarioId, aba])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const carregarConversaSolicitacao = useCallback(async (solicitacaoId) => {
    const sid = String(solicitacaoId ?? '').trim()
    if (!sid) return
    try {
      const res = await fetch(
        `/api/mobilidade/chat/item-esquecido?solicitacao_id=${encodeURIComponent(sid)}`,
      )
      const json = await res.json()
      if (!res.ok || !json.conversa_id) {
        setConversasPorSol((prev) => {
          const next = { ...prev }
          delete next[sid]
          return next
        })
        return
      }
      setConversasPorSol((prev) => ({
        ...prev,
        [sid]: { conversaId: String(json.conversa_id), status: String(json.status ?? 'encerrada') },
      }))
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (!abertoId || aba !== 'servicos') return
    const item = [...itens, ...mobilidadeExtra].find((i) => i.id === abertoId)
    if (!item || !ehMobilidade(item.tipo)) return
    const sid = solicitacaoIdDoItem(item)
    if (sid) void carregarConversaSolicitacao(sid)
  }, [abertoId, aba, itens, mobilidadeExtra, carregarConversaSolicitacao])

  const tabCls = (ativo) =>
    `flex-1 py-2.5 text-center text-xs font-semibold tracking-wide transition-colors ${
      ativo ? 'border-b-[3px] border-[#0097b2] text-[#0097b2]' : 'border-b-[3px] border-transparent text-gray-500'
    }`

  const listaExibir = aba === 'servicos' ? [...itens, ...mobilidadeExtra] : itens

  const abrirEmpresa = (empresaId) => {
    if (!empresaId) return
    router.push(`/empresa/${empresaId}`)
  }

  const abrirPerfilProf = (usuarioIdProf) => {
    if (!usuarioIdProf) return
    router.push(`/perfil/${usuarioIdProf}`)
  }

  const cancelarReserva = async (item) => {
    const reservaId = item.referencia_id != null ? String(item.referencia_id).trim() : ''
    if (!reservaId || cancelandoId) return
    const ok = window.confirm('Deseja cancelar esta reserva? O anfitrião será notificado.')
    if (!ok) return

    setCancelandoId(item.id)
    try {
      const res = await fetch('/api/reservas-hospedagem/cancelar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reserva_id: reservaId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        window.alert(json.error ?? 'Não foi possível cancelar a reserva.')
        return
      }
      notificarBadgeCanais()
      setAbertoId(null)
      await carregar()
    } catch {
      window.alert('Erro de conexão.')
    } finally {
      setCancelandoId(null)
    }
  }

  return (
    <div className="px-1 pb-4">
      <div className="mb-1 flex border-b border-gray-200">
        <button type="button" className={tabCls(aba === 'servicos')} onClick={() => setAba('servicos')}>
          SERVIÇOS
        </button>
        <button type="button" className={tabCls(aba === 'compras')} onClick={() => setAba('compras')}>
          COMPRAS
        </button>
      </div>

      <div className="mt-4">
        <div className="mb-3 flex items-center gap-2 text-sm text-gray-600">
          {aba === 'servicos' ? (
            <>
              <Briefcase className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
              <span>Serviços de profissionais contratados pelo app.</span>
            </>
          ) : (
            <>
              <ShoppingBag className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
              <span>Tickets e reservas feitas pelo aplicativo.</span>
            </>
          )}
        </div>

        {loading ? (
          <ul className="space-y-2" aria-busy="true">
            {[1, 2, 3].map((i) => (
              <li key={i} className="h-20 animate-pulse rounded-xl bg-gray-100" />
            ))}
          </ul>
        ) : listaExibir.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-10 text-center text-sm text-gray-400">
            {aba === 'servicos' ? 'Nenhum serviço contratado ainda' : 'Nenhuma compra registrada ainda'}
          </div>
        ) : (
          <ul className="space-y-2">
            {listaExibir.map((item) => {
              const Ico = iconeCompra(item.tipo)
              const status = String(item.status ?? 'registrada')
              const meta =
                item.metadata && typeof item.metadata === 'object' ? item.metadata : {}
              const mobilidade = ehMobilidade(item.tipo)
              const formaPag = mobilidade
                ? rotuloPagamentoMobilidade(meta.pagamento)
                : rotuloFormaPagamentoReservaHospedagem(meta.forma_pagamento)
              const motivoRecusa = meta.motivo_recusa != null ? String(meta.motivo_recusa) : null
              const expandivel = podeCancelarReserva(item) || mobilidade
              const expandido = abertoId === item.id
              const fotoUrl =
                meta.profissional_foto_url != null ? String(meta.profissional_foto_url) : null
              const username = String(meta.profissional_username ?? '')
                .replace(/^@+/, '')
                .trim()
              const nomeProf =
                meta.profissional_nome != null
                  ? String(meta.profissional_nome)
                  : String(item.titulo ?? 'Profissional')
              const valorTxt = formatBrl(meta.valor_estimado)
              const quando =
                formatarDataHora(meta.concluido_em) || formatarDataHora(item.registrado_em)

              return (
                <li key={item.id} className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                  <div className="flex w-full items-start gap-3 px-3 py-3 text-left">
                    {mobilidade ? (
                      <button
                        type="button"
                        onClick={() => abrirPerfilProf(item.profissional_usuario_id)}
                        disabled={!item.profissional_usuario_id}
                        className="flex min-w-0 flex-1 items-start gap-3 disabled:cursor-default"
                      >
                        <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[#0097b2]/10">
                          {fotoUrl ? (
                            <AvatarImage
                              src={fotoUrl}
                              alt=""
                              fill
                              className="object-cover"
                              sizes="40px"
                            />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-[#0097b2]">
                              <UserRound className="h-5 w-5" aria-hidden />
                            </span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold leading-tight text-gray-900">
                              {nomeProf}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusCls(status)}`}
                            >
                              {STATUS_ROTULO[status] ?? status}
                            </span>
                            {item.pendente ? (
                              <span className="h-2 w-2 shrink-0 rounded-full bg-[#00D443]" aria-label="Novo" />
                            ) : null}
                          </span>
                          {username ? (
                            <UsuarioHandleVerificado
                              username={username}
                              asButton={false}
                              className="mt-0 text-xs font-normal leading-tight text-gray-600"
                            />
                          ) : null}
                          {item.descricao ? (
                            <span className="mt-0.5 block text-xs text-gray-600">{item.descricao}</span>
                          ) : null}
                          <span className="mt-1 block text-[11px] text-gray-400">
                            {formatarData(item.registrado_em)}
                          </span>
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => abrirEmpresa(item.empresa_id)}
                        disabled={!item.empresa_id}
                        className="flex min-w-0 flex-1 items-start gap-3 disabled:cursor-default"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0097b2]/10 text-[#0097b2]">
                          <Ico className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900">{item.titulo}</span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusCls(status)}`}
                            >
                              {STATUS_ROTULO[status] ?? status}
                            </span>
                            {item.pendente ? (
                              <span className="h-2 w-2 shrink-0 rounded-full bg-[#00D443]" aria-label="Novo" />
                            ) : null}
                          </span>
                          {item.descricao ? (
                            <span className="mt-0.5 block text-xs text-gray-600">{item.descricao}</span>
                          ) : null}
                          {formaPag ? (
                            <span className="mt-0.5 block text-xs text-gray-500">Pagamento: {formaPag}</span>
                          ) : null}
                          {motivoRecusa ? (
                            <span className="mt-0.5 block text-xs text-red-600">Motivo: {motivoRecusa}</span>
                          ) : null}
                          <span className="mt-1 block text-[11px] text-gray-400">
                            {formatarData(item.registrado_em)}
                          </span>
                        </span>
                      </button>
                    )}

                    {expandivel ? (
                      <button
                        type="button"
                        onClick={() => setAbertoId(expandido ? null : item.id)}
                        className="mt-1 shrink-0 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                        aria-expanded={expandido}
                        aria-label={expandido ? 'Recolher' : 'Ver resumo'}
                      >
                        {expandido ? (
                          <ChevronUp className="h-5 w-5" aria-hidden />
                        ) : (
                          <ChevronDown className="h-5 w-5" aria-hidden />
                        )}
                      </button>
                    ) : null}
                  </div>

                  {expandivel && expandido ? (
                    <div className="border-t border-gray-100 px-3 py-3">
                      {mobilidade ? (
                        <>
                          <ul className="space-y-1.5 text-sm text-gray-800">
                            {quando ? (
                              <li>
                                <span className="font-semibold text-gray-600">Quando: </span>
                                {quando}
                              </li>
                            ) : null}
                            <li>
                              <span className="font-semibold text-gray-600">Origem: </span>
                              {meta.origem_nome != null ? String(meta.origem_nome) : '—'}
                            </li>
                            <li>
                              <span className="font-semibold text-gray-600">Destino: </span>
                              {meta.destino_nome != null ? String(meta.destino_nome) : '—'}
                            </li>
                            {valorTxt ? (
                              <li>
                                <span className="font-semibold text-gray-600">Valor: </span>
                                {valorTxt}
                              </li>
                            ) : null}
                            {formaPag ? (
                              <li>
                                <span className="font-semibold text-gray-600">Pagamento: </span>
                                {formaPag}
                              </li>
                            ) : null}
                            <li>
                              <span className="font-semibold text-gray-600">Passageiros: </span>
                              {meta.lugares != null ? Number(meta.lugares) : 1}
                            </li>
                            <li>
                              <span className="font-semibold text-gray-600">Tipo: </span>
                              {meta.atendimento === 'agendado' ? 'Agendado' : 'Imediato'}
                            </li>
                          </ul>
                          {(() => {
                            const solId = solicitacaoIdDoItem(item)
                            const conv = solId ? conversasPorSol[solId] : null
                            const mostrarArquivo = conv && conv.status === 'encerrada'
                            const mostrarAtivo = conv && conv.status === 'aberta'
                            return (
                              <div className="mt-3 space-y-3">
                                {mostrarArquivo || mostrarAtivo ? (
                                  <ChatCorridaMobilidade
                                    conversaId={conv.conversaId}
                                    compact
                                    somenteLeitura={mostrarArquivo}
                                    titulo="Item esquecido"
                                    hint={
                                      mostrarAtivo
                                        ? 'Chat aberto — combine a devolução'
                                        : undefined
                                    }
                                    permiteEncerrar={Boolean(mostrarAtivo)}
                                    onEncerrada={() => {
                                      if (solId) void carregarConversaSolicitacao(solId)
                                    }}
                                  />
                                ) : null}
                                {podeItemEsquecido(item) && solId && !mostrarAtivo ? (
                                  <button
                                    type="button"
                                    onClick={() => setPopupItemSolId(solId)}
                                    className="w-full rounded-xl bg-[#0097b2] py-2.5 text-sm font-bold uppercase tracking-wide text-white hover:bg-[#007d94]"
                                  >
                                    Item esquecido
                                  </button>
                                ) : null}
                              </div>
                            )
                          })()}
                        </>
                      ) : (
                        <button
                          type="button"
                          disabled={cancelandoId === item.id}
                          onClick={() => void cancelarReserva(item)}
                          className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                        >
                          {cancelandoId === item.id ? 'Cancelando…' : 'Cancelar reserva'}
                        </button>
                      )}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <PopupItemEsquecido
        aberto={Boolean(popupItemSolId)}
        solicitacaoId={popupItemSolId ?? ''}
        onFechar={() => {
          const sid = popupItemSolId
          setPopupItemSolId(null)
          if (sid) void carregarConversaSolicitacao(sid)
        }}
        onChatEncerrado={() => {
          if (popupItemSolId) void carregarConversaSolicitacao(popupItemSolId)
        }}
      />
    </div>
  )
}
