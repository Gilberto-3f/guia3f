'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, MessageCircle } from 'lucide-react'
import AvatarImage from '@/components/AvatarImage'
import type { ParceriaRow } from '@/app/api/profissional/parcerias/route'
import { openWhatsAppChat } from '@/lib/whatsapp-empresa'

const VERDE = '#00D443'
const COR = '#0097b2'

function formatarDataHora(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

type AbaParcerias = 'andamento' | 'historico'

type Props = {
  compact?: boolean
}

/** Parcerias — em andamento / histórico + confirmação bilateral de pagamento. */
export default function ParceriasProfissional({ compact = false }: Props) {
  const [aba, setAba] = useState<AbaParcerias>('andamento')
  const [parcerias, setParcerias] = useState<ParceriaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [relatorioId, setRelatorioId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [msgAcao, setMsgAcao] = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const qs = aba === 'historico' ? '?historico=1' : ''
      const res = await fetch(`/api/profissional/parcerias${qs}`)
      const json = (await res.json()) as { ok?: boolean; parcerias?: ParceriaRow[]; error?: string }
      if (!json.ok) {
        setErro(json.error ?? 'Erro ao carregar parcerias.')
        setParcerias([])
        return
      }
      setParcerias(json.parcerias ?? [])
    } catch {
      setErro('Falha de conexão.')
      setParcerias([])
    } finally {
      setLoading(false)
    }
  }, [aba])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const confirmar = async (p: ParceriaRow, acao: 'pagamento' | 'recebimento') => {
    setBusyId(p.id)
    setMsgAcao('')
    try {
      const res = await fetch(
        `/api/profissional/parcerias/${encodeURIComponent(p.id)}/confirmar-pagamento`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ acao }),
        },
      )
      const json = (await res.json()) as { error?: string; liquidado?: boolean }
      if (!res.ok) {
        setMsgAcao(String(json.error ?? 'Não foi possível confirmar.'))
        return
      }
      setMsgAcao(
        json.liquidado
          ? 'Pagamento e recebimento confirmados. Parceria liquidada.'
          : 'Confirmação registrada. Aguardando a outra parte.',
      )
      await carregar()
    } catch {
      setMsgAcao('Falha de rede ao confirmar.')
    } finally {
      setBusyId(null)
    }
  }

  const abrirWhatsapp = (p: ParceriaRow) => {
    const phone = p.parceiro.whatsapp
    if (!phone) {
      setMsgAcao('WhatsApp do parceiro indisponível.')
      return
    }
    const handle = p.parceiro.username ? `@${p.parceiro.username}` : p.parceiro.nome
    const ok = openWhatsAppChat(
      phone,
      `Olá ${handle}, sobre nossa parceria no Guia 3F — vamos alinhar o pagamento/recebimento.`,
    )
    if (!ok) setMsgAcao('Não foi possível abrir o WhatsApp.')
  }

  return (
    <div className={`space-y-3 pb-4 ${compact ? 'px-0' : 'px-1'}`}>
      <div className="flex rounded-lg bg-gray-100 p-1">
        <button
          type="button"
          onClick={() => setAba('andamento')}
          className={`flex-1 rounded-md py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
            aba === 'andamento' ? 'text-white shadow-sm' : 'text-gray-600'
          }`}
          style={aba === 'andamento' ? { backgroundColor: VERDE } : undefined}
        >
          Em andamento
        </button>
        <button
          type="button"
          onClick={() => setAba('historico')}
          className={`flex-1 rounded-md py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
            aba === 'historico' ? 'text-white shadow-sm' : 'text-gray-600'
          }`}
          style={aba === 'historico' ? { backgroundColor: VERDE } : undefined}
        >
          Histórico
        </button>
      </div>

      {msgAcao ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-center text-xs text-amber-900">{msgAcao}</p>
      ) : null}

      {loading ? (
        <p className="py-8 text-center text-sm text-gray-500">Carregando parcerias...</p>
      ) : erro ? (
        <p className="py-8 text-center text-sm text-rose-600">{erro}</p>
      ) : parcerias.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-10 text-center text-sm text-gray-500">
          {aba === 'historico' ? 'Nenhuma parceria concluída ainda.' : 'Nenhuma parceria em andamento.'}
        </div>
      ) : (
        <ul className="space-y-2">
          {parcerias.map((p) => {
            const handle = p.parceiro.username
              ? `@${p.parceiro.username.replace(/^@+/, '')}`
              : '—'
            const aberto = expandido === p.id
            const mostrarRelatorio = relatorioId === p.id
            const mostrarBotaoPagar =
              p.papel !== 'indicador' && !p.pagamento_confirmado && !p.liquidado
            const mostrarBotaoReceber =
              p.papel === 'indicador' && !p.recebimento_confirmado && !p.liquidado
            const receberLiberado = p.pagamento_confirmado

            return (
              <li key={p.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                <button
                  type="button"
                  className="flex w-full items-center gap-3 p-3 text-left"
                  onClick={() => setExpandido(aberto ? null : p.id)}
                  aria-expanded={aberto}
                >
                  <AvatarImage
                    src={p.parceiro.foto_url}
                    alt=""
                    width={48}
                    height={48}
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gray-900">{p.parceiro.nome}</p>
                    <p className="truncate text-sm text-[#0097b2]">{handle}</p>
                    <p className="truncate text-xs text-gray-500">{p.parceiro.categorias || '—'}</p>
                  </div>
                  {aberto ? (
                    <ChevronUp className="h-5 w-5 shrink-0 text-[#0097b2]" aria-hidden />
                  ) : (
                    <ChevronDown className="h-5 w-5 shrink-0 text-gray-400" aria-hidden />
                  )}
                </button>

                {aberto ? (
                  <div className="space-y-2 border-t border-gray-100 px-3 pb-3 pt-2">
                    <p className="text-xs text-gray-500">
                      {aba === 'historico'
                        ? `Período: ${formatarDataHora(p.created_at)}`
                        : `Início: ${formatarDataHora(p.created_at)}`}
                    </p>
                    {aba === 'historico' && p.total_comissoes_estimadas != null ? (
                      <p className="text-xs font-medium text-[#15803d]">
                        Atrativos visitados: {p.total_comissoes_estimadas}
                      </p>
                    ) : null}
                    {p.turista ? (
                      <p className="text-xs font-medium text-[#15803d]">
                        Turista: {p.turista.nome} ({p.turista.username})
                        {p.contratado_em ? ` · ${formatarDataHora(p.contratado_em)}` : ''}
                      </p>
                    ) : null}

                    <div className="flex flex-wrap gap-1">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          p.status === 'em_andamento'
                            ? 'bg-[#0097b2]/15 text-[#0097b2]'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {p.status === 'em_andamento' ? 'Em andamento' : p.status}
                      </span>
                      {p.liquidado ? (
                        <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800">
                          Liquidado
                        </span>
                      ) : (
                        <>
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              p.pagamento_confirmado
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-50 text-amber-800'
                            }`}
                          >
                            {p.pagamento_confirmado ? 'Pag. ok' : 'Pag. pendente'}
                          </span>
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              p.recebimento_confirmado
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-50 text-amber-800'
                            }`}
                          >
                            {p.recebimento_confirmado ? 'Rec. ok' : 'Rec. pendente'}
                          </span>
                        </>
                      )}
                    </div>

                    {aba === 'andamento' && !p.liquidado ? (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {mostrarBotaoPagar ? (
                          <button
                            type="button"
                            disabled={busyId === p.id}
                            onClick={() => void confirmar(p, 'pagamento')}
                            className="flex-1 rounded-lg px-3 py-2.5 text-xs font-bold uppercase text-white disabled:opacity-50"
                            style={{ backgroundColor: VERDE }}
                          >
                            Confirmar pagamento
                          </button>
                        ) : null}
                        {mostrarBotaoReceber ? (
                          <button
                            type="button"
                            disabled={busyId === p.id || !receberLiberado}
                            onClick={() => void confirmar(p, 'recebimento')}
                            title={
                              receberLiberado
                                ? undefined
                                : 'Liberado após a confirmação de pagamento'
                            }
                            className="flex-1 rounded-lg px-3 py-2.5 text-xs font-bold uppercase text-white disabled:cursor-not-allowed disabled:opacity-40"
                            style={{ backgroundColor: COR }}
                          >
                            Confirmar recebimento
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => abrirWhatsapp(p)}
                          className="inline-flex items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs font-bold text-[#0097b2]"
                        >
                          <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                          WhatsApp
                        </button>
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => setRelatorioId(mostrarRelatorio ? null : p.id)}
                      className="w-full rounded-lg bg-[#0097b2]/10 py-2 text-xs font-bold uppercase text-[#0097b2] hover:bg-[#0097b2]/15"
                    >
                      {mostrarRelatorio ? 'Ocultar relatório' : 'Ver relatório'}
                    </button>

                    {mostrarRelatorio ? (
                      <div className="rounded-lg bg-gray-50 p-3">
                        <p className="mb-2 text-xs font-bold uppercase text-gray-500">
                          Atrativos selecionados
                        </p>
                        {p.atrativos.length === 0 ? (
                          <p className="text-xs text-gray-500">Nenhum atrativo registrado ainda.</p>
                        ) : (
                          <ul className="space-y-1">
                            {p.atrativos.map((a) => (
                              <li
                                key={`${a.empresa_id}-${a.selecionado_em}`}
                                className="flex justify-between text-xs"
                              >
                                <span className="font-medium text-gray-800">{a.empresa_nome}</span>
                                <span
                                  className={
                                    a.status === 'visitado'
                                      ? 'font-bold text-[#15803d]'
                                      : 'text-amber-700'
                                  }
                                >
                                  {a.status === 'visitado' ? 'Visitado' : 'Agendado'}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
