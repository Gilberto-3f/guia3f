'use client'

import { useCallback, useEffect, useState } from 'react'
import { BarChart3, MessageCircle, Search, Send, X } from 'lucide-react'
import AvatarImage from '@/components/AvatarImage'
const INPUT_FIN = 'text-gray-900 placeholder:text-gray-500 caret-gray-900'

type AbaFinanceiro = 'profissional' | 'empresa' | 'historico'

type Destinatario = {
  usuarioId: string
  nome: string
  username: string
  fotoUrl: string | null
  subtitulo: string
}

type ConversaHistorico = {
  id: string
  alvo_usuario_id: string
  alvo_tipo: 'profissional' | 'empresa'
  status: string
  assunto: string | null
  encerrada_em: string | null
  alvo: { nome: string; username: string; fotoUrl: string | null }
}

type Mensagem = {
  id: string
  remetente_id: string
  texto: string
  created_at: string
}

type DesempenhoProf = {
  recomendacoesTotal: number
  topEmpresasIndicadas: Array<{ nome: string; categoria: string; total: number }>
  comissoesGanhasQtd: number
  comissoesGanhasValor: number
  parceriasFechadas: number
  atendimentosConcluidos: number
}

type DesempenhoEmp = {
  comissoesPagasQtd: number
  comissoesPagasValor: number
  receptivoPaxQtd: number
}

/**
 * Hub Canal Financeiro do ADM (pesquisa, mensageiro 1:1, desempenho, histórico).
 * @param {{ embedded?: boolean }} props — `embedded`: layout do app Canais (sem card de dashboard).
 */
export default function CanalFinanceiroAdm({ embedded = false }: { embedded?: boolean }) {
  const [aba, setAba] = useState<AbaFinanceiro>('profissional')
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<Destinatario[]>([])
  const [buscando, setBuscando] = useState(false)
  const [selecionado, setSelecionado] = useState<Destinatario | null>(null)
  const [conversaId, setConversaId] = useState<string | null>(null)
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [textoMsg, setTextoMsg] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [abrindoChat, setAbrindoChat] = useState(false)
  const [historico, setHistorico] = useState<ConversaHistorico[]>([])
  const [historicoDetalhe, setHistoricoDetalhe] = useState<string | null>(null)
  const [desempenho, setDesempenho] = useState<DesempenhoProf | DesempenhoEmp | null>(null)
  const [mostrarDesempenho, setMostrarDesempenho] = useState(false)
  const [carregandoDesempenho, setCarregandoDesempenho] = useState(false)

  const abaBusca: 'profissional' | 'empresa' = aba === 'empresa' ? 'empresa' : 'profissional'

  const abaCls = (ativo: boolean) =>
    `flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition-colors sm:text-sm ${
      ativo ? 'bg-[#00D443] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
    }`

  const carregarHistorico = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/financeiro-conversas')
      const json = (await res.json()) as { ok?: boolean; conversas?: ConversaHistorico[] }
      if (json.ok && json.conversas) setHistorico(json.conversas)
    } catch {
      setHistorico([])
    }
  }, [])

  useEffect(() => {
    if (aba === 'historico') void carregarHistorico()
  }, [aba, carregarHistorico])

  useEffect(() => {
    const termo = busca.trim()
    if (aba === 'historico' || termo.length < 2) {
      setResultados([])
      return
    }
    const t = setTimeout(() => {
      void (async () => {
        setBuscando(true)
        try {
          const res = await fetch(
            `/api/admin/financeiro-busca?tipo=${abaBusca}&q=${encodeURIComponent(termo)}`,
          )
          const json = (await res.json()) as { resultados?: Destinatario[] }
          setResultados(json.resultados ?? [])
        } catch {
          setResultados([])
        } finally {
          setBuscando(false)
        }
      })()
    }, 320)
    return () => clearTimeout(t)
  }, [busca, abaBusca, aba])

  const carregarMensagens = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/financeiro-conversas/${id}/mensagens`)
    const json = (await res.json()) as { mensagens?: Mensagem[] }
    setMensagens(json.mensagens ?? [])
  }, [])

  const abrirMensageiro = async () => {
    if (!selecionado) return
    setAbrindoChat(true)
    try {
      const res = await fetch('/api/admin/financeiro-conversas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alvo_usuario_id: selecionado.usuarioId,
          alvo_tipo: abaBusca,
        }),
      })
      const json = (await res.json()) as { ok?: boolean; conversa?: { id: string }; error?: string }
      if (!json.ok || !json.conversa?.id) {
        window.alert(json.error ?? 'Não foi possível abrir o mensageiro.')
        return
      }
      setConversaId(json.conversa.id)
      await carregarMensagens(json.conversa.id)
    } catch {
      window.alert('Erro ao abrir mensageiro.')
    } finally {
      setAbrindoChat(false)
    }
  }

  const fecharMensageiro = async () => {
    if (!conversaId) {
      setConversaId(null)
      setMensagens([])
      return
    }
    try {
      await fetch(`/api/admin/financeiro-conversas/${conversaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'encerrar' }),
      })
      setConversaId(null)
      setMensagens([])
      setTextoMsg('')
      if (aba === 'historico') void carregarHistorico()
    } catch {
      window.alert('Erro ao encerrar conversa.')
    }
  }

  const enviarMensagem = async () => {
    if (!conversaId || !textoMsg.trim() || enviando) return
    setEnviando(true)
    try {
      const res = await fetch(`/api/admin/financeiro-conversas/${conversaId}/mensagens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: textoMsg.trim() }),
      })
      const json = (await res.json()) as { ok?: boolean; mensagem?: Mensagem; error?: string }
      if (!json.ok || !json.mensagem) {
        window.alert(json.error ?? 'Falha ao enviar.')
        return
      }
      setMensagens((prev) => [...prev, json.mensagem!])
      setTextoMsg('')
    } finally {
      setEnviando(false)
    }
  }

  const analisarDesempenho = async () => {
    if (!selecionado) return
    setMostrarDesempenho(true)
    setCarregandoDesempenho(true)
    setDesempenho(null)
    try {
      const res = await fetch(
        `/api/admin/financeiro-desempenho?tipo=${abaBusca}&usuario_id=${encodeURIComponent(selecionado.usuarioId)}`,
      )
      const json = (await res.json()) as { desempenho?: DesempenhoProf | DesempenhoEmp }
      setDesempenho(json.desempenho ?? null)
    } finally {
      setCarregandoDesempenho(false)
    }
  }

  const verHistoricoDetalhe = async (id: string) => {
    setHistoricoDetalhe(id)
    const res = await fetch(`/api/admin/financeiro-conversas/${id}`)
    const json = (await res.json()) as { mensagens?: Mensagem[] }
    setMensagens(json.mensagens ?? [])
  }

  const limparSelecao = () => {
    setSelecionado(null)
    setConversaId(null)
    setMensagens([])
    setMostrarDesempenho(false)
    setDesempenho(null)
    setHistoricoDetalhe(null)
  }

  const shellClass = embedded
    ? 'canal-financeiro-ui flex min-h-0 flex-1 flex-col overflow-y-auto bg-gray-50 p-4'
    : 'canal-financeiro-ui rounded-2xl border border-gray-200 bg-white p-4 shadow-sm'

  return (
    <div className={shellClass}>
      <div className="flex shrink-0 gap-2" role="tablist">
        <button
          type="button"
          role="tab"
          className={abaCls(aba === 'profissional')}
          onClick={() => {
            setAba('profissional')
            limparSelecao()
            setBusca('')
          }}
        >
          Profissional
        </button>
        <button
          type="button"
          role="tab"
          className={abaCls(aba === 'empresa')}
          onClick={() => {
            setAba('empresa')
            limparSelecao()
            setBusca('')
          }}
        >
          Empresas
        </button>
        <button
          type="button"
          role="tab"
          className={abaCls(aba === 'historico')}
          onClick={() => {
            setAba('historico')
            limparSelecao()
          }}
        >
          Histórico
        </button>
      </div>

      {aba === 'historico' ? (
        <div className="mt-4 min-h-0 flex-1">
          {historicoDetalhe ? (
            <div>
              <button
                type="button"
                className="mb-2 text-sm font-medium text-gray-900"
                onClick={() => {
                  setHistoricoDetalhe(null)
                  setMensagens([])
                }}
              >
                ← Voltar à lista
              </button>
              <ul
                className={`space-y-2 overflow-y-auto rounded-xl border border-gray-100 bg-white p-3 ${
                  embedded ? 'max-h-[min(70vh,32rem)]' : 'max-h-64'
                }`}
              >
                {mensagens.map((m) => (
                  <li key={m.id} className="text-sm text-gray-800">
                    <span className="text-xs text-gray-500">
                      {new Date(m.created_at).toLocaleString('pt-BR')} ·{' '}
                    </span>
                    {m.texto}
                  </li>
                ))}
              </ul>
            </div>
          ) : historico.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">Nenhuma conversa encerrada ainda.</p>
          ) : (
            <ul className={`mt-2 space-y-2 overflow-y-auto ${embedded ? 'max-h-[min(70vh,32rem)]' : 'max-h-80'}`}>
              {historico.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => void verHistoricoDetalhe(h.id)}
                    className="flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-white px-3 py-2 text-left shadow-sm hover:bg-gray-50"
                  >
                    <AvatarImage src={h.alvo.fotoUrl} alt="" width={40} height={40} className="rounded-full" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-gray-900">{h.alvo.nome}</div>
                      <div className="text-xs text-gray-500">
                        {h.alvo.username} · {h.alvo_tipo === 'profissional' ? 'Profissional' : 'Empresa'}
                        {h.encerrada_em ? ` · ${new Date(h.encerrada_em).toLocaleString('pt-BR')}` : ''}
                      </div>
                      {h.assunto ? <div className="truncate text-xs text-gray-600">{h.assunto}</div> : null}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <>
          <div className="relative mt-4">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              aria-hidden
            />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={
                abaBusca === 'profissional'
                  ? 'Buscar por nome ou @username…'
                  : 'Buscar empresa por nome ou @…'
              }
              className={`w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#00D443] focus:ring-1 focus:ring-[#00D443] ${INPUT_FIN}`}
            />
          </div>
          {buscando ? <p className="mt-2 text-xs text-gray-500">Buscando…</p> : null}

          {resultados.length > 0 && !selecionado ? (
            <ul className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-gray-100 bg-white">
              {resultados.map((r) => (
                <li key={r.usuarioId}>
                  <button
                    type="button"
                    onClick={() => setSelecionado(r)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-gray-50"
                  >
                    <AvatarImage src={r.fotoUrl} alt="" width={36} height={36} className="rounded-full" />
                    <div>
                      <div className="text-sm font-medium text-gray-800">{r.nome}</div>
                      <div className="text-xs text-gray-500">{r.username}</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {selecionado ? (
            <div className="mt-4 rounded-xl border border-[#00D443]/30 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <AvatarImage src={selecionado.fotoUrl} alt="" width={56} height={56} className="rounded-full" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-gray-900">{selecionado.nome}</div>
                  <div className="text-sm text-gray-600">{selecionado.username}</div>
                  {selecionado.subtitulo ? (
                    <div className="mt-0.5 text-xs text-gray-500">{selecionado.subtitulo}</div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={limparSelecao}
                  className="text-gray-400 hover:text-gray-600"
                  aria-label="Limpar seleção"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {conversaId ? (
                  <button
                    type="button"
                    onClick={() => void fecharMensageiro()}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Fechar mensageiro
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={abrindoChat}
                    onClick={() => void abrirMensageiro()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#00D443] px-3 py-2 text-sm font-semibold text-white hover:bg-[#00b83b] disabled:opacity-50"
                  >
                    <MessageCircle className="h-4 w-4" aria-hidden />
                    {abrindoChat ? 'Abrindo…' : 'Abrir mensageiro'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void analisarDesempenho()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#00D443] px-3 py-2 text-sm font-medium text-[#00D443] hover:bg-[#00D443]/10"
                >
                  <BarChart3 className="h-4 w-4" aria-hidden />
                  Analisar desempenho
                </button>
              </div>

              {conversaId ? (
                <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50">
                  <ul className="max-h-52 space-y-2 overflow-y-auto p-3">
                    {mensagens.length === 0 ? (
                      <li className="text-center text-xs text-gray-500">
                        Nenhuma mensagem ainda. Envie a primeira.
                      </li>
                    ) : (
                      mensagens.map((m) => (
                        <li key={m.id} className="rounded-lg bg-white px-2 py-1.5 text-sm text-gray-800">
                          {m.texto}
                          <div className="text-[10px] text-gray-400">
                            {new Date(m.created_at).toLocaleString('pt-BR')}
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                  <div className="flex gap-2 border-t border-gray-100 bg-white p-2">
                    <input
                      type="text"
                      value={textoMsg}
                      onChange={(e) => setTextoMsg(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          void enviarMensagem()
                        }
                      }}
                      placeholder="Mensagem…"
                      className={`min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#00D443] ${INPUT_FIN}`}
                    />
                    <button
                      type="button"
                      disabled={!textoMsg.trim() || enviando}
                      onClick={() => void enviarMensagem()}
                      className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#00D443] text-white disabled:opacity-50"
                      aria-label="Enviar"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : null}

              {mostrarDesempenho ? (
                <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-semibold text-gray-800">Desempenho financeiro</span>
                    <button
                      type="button"
                      className="text-xs text-gray-500"
                      onClick={() => setMostrarDesempenho(false)}
                    >
                      Fechar
                    </button>
                  </div>
                  {carregandoDesempenho ? (
                    <p className="text-gray-500">Carregando…</p>
                  ) : !desempenho ? (
                    <p className="text-gray-500">Sem dados.</p>
                  ) : abaBusca === 'profissional' ? (
                    <DesempenhoProfissionalView d={desempenho as DesempenhoProf} />
                  ) : (
                    <DesempenhoEmpresaView d={desempenho as DesempenhoEmp} />
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

function DesempenhoProfissionalView({ d }: { d: DesempenhoProf }) {
  return (
    <ul className="space-y-2 text-gray-700">
      <li>
        Recomendações gerais: <strong>{d.recomendacoesTotal}</strong>
      </li>
      <li>
        Comissões ganhas: <strong>{d.comissoesGanhasQtd}</strong> (R$ {d.comissoesGanhasValor.toFixed(2)})
      </li>
      <li>
        Parcerias fechadas: <strong>{d.parceriasFechadas}</strong>
      </li>
      <li>
        Atendimentos concluídos: <strong>{d.atendimentosConcluidos}</strong>
      </li>
      {d.topEmpresasIndicadas.length > 0 ? (
        <li>
          <span className="font-medium">Top empresas indicadas:</span>
          <ol className="mt-1 list-decimal pl-5 text-xs">
            {d.topEmpresasIndicadas.map((e, i) => (
              <li key={i}>
                {e.nome} ({e.categoria || '—'}) — {e.total}
              </li>
            ))}
          </ol>
        </li>
      ) : null}
    </ul>
  )
}

function DesempenhoEmpresaView({ d }: { d: DesempenhoEmp }) {
  return (
    <ul className="space-y-2 text-gray-700">
      <li>
        Comissões pagas: <strong>{d.comissoesPagasQtd}</strong> (R$ {d.comissoesPagasValor.toFixed(2)})
      </li>
      <li>
        Receptivo PAX no local: <strong>{d.receptivoPaxQtd}</strong> registros
      </li>
    </ul>
  )
}
