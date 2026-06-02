'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { BarChart3, ChevronUp, MessageCircle, Search, Send, X } from 'lucide-react'
import AvatarImage from '@/components/AvatarImage'
import CanalMensagemAudio from '@/components/CanalMensagemAudio'
import CanalMensagemImagem from '@/components/CanalMensagemImagem'
import { rotuloCategoriaCardFinanceiro } from '@/lib/canaisProfissionaisListaUi'
import { ehAnexoAudioCanal, ehAnexoImagemCanal } from '@/lib/canalAnexoUrl'
import type { FinanceiroMensagemRow } from '@/lib/financeiroConversas'

const INPUT_FIN = 'text-gray-900 placeholder:text-gray-500 caret-gray-900'
const AVATAR_QUADRADO = 'shrink-0 rounded-md object-cover'
const STORAGE_KEY = 'guia-canal-financeiro-adm-v1'

const btnAcaoCls = (ativo: boolean) =>
  `flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-sm font-semibold text-white transition-colors ${
    ativo ? 'bg-[#00D443] hover:bg-[#00b83b]' : 'bg-[#0097b2] hover:bg-[#008099]'
  }`

type AbaFinanceiro = 'profissional' | 'empresa' | 'historico'
type AbaBusca = 'profissional' | 'empresa'

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
  texto: string | null
  anexo_url: string | null
  anexo_tipo: string | null
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

type CardPainel = {
  selecionado: Destinatario | null
  conversaId: string | null
  mensagens: Mensagem[]
  textoMsg: string
  painelMensageiro: boolean
  painelDesempenho: boolean
  desempenho: DesempenhoProf | DesempenhoEmp | null
}

type CardsPorAba = Record<AbaBusca, CardPainel>

type PersistidoAdm = {
  aba: AbaFinanceiro
  cards: CardsPorAba
}

function cardVazio(): CardPainel {
  return {
    selecionado: null,
    conversaId: null,
    mensagens: [],
    textoMsg: '',
    painelMensageiro: false,
    painelDesempenho: false,
    desempenho: null,
  }
}

function cardsIniciais(): CardsPorAba {
  return { profissional: cardVazio(), empresa: cardVazio() }
}

function lerPersistido(): PersistidoAdm | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistidoAdm
    if (!parsed?.cards?.profissional || !parsed?.cards?.empresa) return null
    return {
      aba: parsed.aba ?? 'profissional',
      cards: {
        profissional: { ...cardVazio(), ...parsed.cards.profissional, mensagens: [] },
        empresa: { ...cardVazio(), ...parsed.cards.empresa, mensagens: [] },
      },
    }
  } catch {
    return null
  }
}

function salvarPersistido(aba: AbaFinanceiro, cards: CardsPorAba) {
  if (typeof window === 'undefined') return
  const payload: PersistidoAdm = {
    aba,
    cards: {
      profissional: {
        ...cards.profissional,
        mensagens: [],
        desempenho: null,
      },
      empresa: {
        ...cards.empresa,
        mensagens: [],
        desempenho: null,
      },
    },
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

const COR_LOGO = '#0097b2'

function BotaoFecharCard({
  onClick,
  ariaLabel = 'Fechar',
}: {
  onClick: () => void
  ariaLabel?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white shadow-sm hover:opacity-90"
      style={{ backgroundColor: COR_LOGO }}
      aria-label={ariaLabel}
    >
      <X className="h-3 w-3" strokeWidth={2.5} aria-hidden />
    </button>
  )
}

function BotaoChevronHistorico({ onClick, expandido }: { onClick: () => void; expandido: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white hover:bg-white/15"
      aria-label={expandido ? 'Recolher diálogo' : 'Expandir diálogo'}
      aria-expanded={expandido}
    >
      <ChevronUp
        className={`h-6 w-6 transition-transform ${expandido ? '' : 'rotate-180'}`}
        strokeWidth={2.5}
        aria-hidden
      />
    </button>
  )
}

/**
 * Hub Canal Financeiro do ADM (pesquisa, mensageiro 1:1, desempenho, histórico).
 * @param {{ embedded?: boolean }} props — `embedded`: layout do app Canais (sem card de dashboard).
 */
export default function CanalFinanceiroAdm({ embedded = false }: { embedded?: boolean }) {
  const persistido = useRef(lerPersistido())
  const [aba, setAba] = useState<AbaFinanceiro>(persistido.current?.aba ?? 'profissional')
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<Destinatario[]>([])
  const [buscando, setBuscando] = useState(false)
  const [cards, setCards] = useState<CardsPorAba>(persistido.current?.cards ?? cardsIniciais())
  const [enviando, setEnviando] = useState(false)
  const [abrindoChat, setAbrindoChat] = useState(false)
  const [historico, setHistorico] = useState<ConversaHistorico[]>([])
  const [historicoDetalhe, setHistoricoDetalhe] = useState<string | null>(null)
  const [historicoMensagens, setHistoricoMensagens] = useState<FinanceiroMensagemRow[]>([])
  const [historicoAdmId, setHistoricoAdmId] = useState<string | null>(null)
  const [historicoCarregando, setHistoricoCarregando] = useState(false)
  const [historicoErro, setHistoricoErro] = useState<string | null>(null)
  const [carregandoDesempenho, setCarregandoDesempenho] = useState(false)
  const [restaurado, setRestaurado] = useState(false)

  const abaBusca: AbaBusca = aba === 'empresa' ? 'empresa' : 'profissional'
  const painel = cards[abaBusca]
  const selecionado = painel.selecionado
  const conversaId = painel.conversaId
  const mensagens = painel.mensagens
  const textoMsg = painel.textoMsg
  const painelMensageiro = painel.painelMensageiro
  const painelDesempenho = painel.painelDesempenho
  const desempenho = painel.desempenho
  const conversaEmAndamento = Boolean(conversaId)

  const abaCls = (ativo: boolean) =>
    `flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition-colors sm:text-sm ${
      ativo ? 'bg-[#00D443] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
    }`

  const patchPainel = useCallback((tipo: AbaBusca, patch: Partial<CardPainel>) => {
    setCards((prev) => ({
      ...prev,
      [tipo]: { ...prev[tipo], ...patch },
    }))
  }, [])

  const limparPainel = useCallback(
    (tipo: AbaBusca) => {
      patchPainel(tipo, cardVazio())
    },
    [patchPainel],
  )

  const carregarHistorico = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/financeiro-conversas')
      const json = (await res.json()) as { ok?: boolean; conversas?: ConversaHistorico[] }
      if (json.ok && json.conversas) setHistorico(json.conversas)
    } catch {
      setHistorico([])
    }
  }, [])

  const sincronizarConversasAbertas = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/financeiro-conversas?status=aberta')
      const json = (await res.json()) as {
        ok?: boolean
        conversas?: Array<{
          id: string
          alvo_tipo: AbaBusca
          alvo: Destinatario
        }>
      }
      if (!json.ok || !json.conversas) return

      setCards((prev) => {
        const next = { ...prev }
        for (const c of json.conversas ?? []) {
          const tipo = c.alvo_tipo === 'empresa' ? 'empresa' : 'profissional'
          const atual = next[tipo]
          if (!atual.selecionado || atual.selecionado.usuarioId === c.alvo.usuarioId) {
            next[tipo] = {
              ...atual,
              selecionado: c.alvo,
              conversaId: c.id,
              painelMensageiro: true,
            }
          }
        }
        return next
      })
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    void sincronizarConversasAbertas().finally(() => setRestaurado(true))
  }, [sincronizarConversasAbertas])

  useEffect(() => {
    if (!restaurado) return
    salvarPersistido(aba, cards)
  }, [aba, cards, restaurado])

  useEffect(() => {
    if (aba === 'historico') void carregarHistorico()
  }, [aba, carregarHistorico])

  useEffect(() => {
    const termo = busca.trim()
    if (aba === 'historico' || selecionado || termo.length < 2) {
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
  }, [busca, abaBusca, aba, selecionado])

  const carregarMensagens = useCallback(
    async (tipo: AbaBusca, id: string) => {
      const res = await fetch(`/api/admin/financeiro-conversas/${id}/mensagens`)
      const json = (await res.json()) as { mensagens?: Mensagem[] }
      patchPainel(tipo, { mensagens: json.mensagens ?? [] })
    },
    [patchPainel],
  )

  useEffect(() => {
    if (aba === 'historico') return
    const p = cards[abaBusca]
    if (p.conversaId && p.painelMensageiro) {
      void carregarMensagens(abaBusca, p.conversaId)
    }
  }, [aba, abaBusca, cards[abaBusca].conversaId, cards[abaBusca].painelMensageiro, carregarMensagens])

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
      patchPainel(abaBusca, {
        mensagens: [...mensagens, json.mensagem!],
        textoMsg: '',
      })
    } finally {
      setEnviando(false)
    }
  }

  const carregarDesempenho = async () => {
    if (!selecionado) return
    setCarregandoDesempenho(true)
    patchPainel(abaBusca, { desempenho: null })
    try {
      const res = await fetch(
        `/api/admin/financeiro-desempenho?tipo=${abaBusca}&usuario_id=${encodeURIComponent(selecionado.usuarioId)}`,
      )
      const json = (await res.json()) as { desempenho?: DesempenhoProf | DesempenhoEmp }
      patchPainel(abaBusca, { desempenho: json.desempenho ?? null })
    } finally {
      setCarregandoDesempenho(false)
    }
  }

  const toggleMensageiro = async () => {
    if (painelMensageiro) {
      patchPainel(abaBusca, { painelMensageiro: false })
      return
    }
    if (!conversaId) {
      setAbrindoChat(true)
      try {
        const res = await fetch('/api/admin/financeiro-conversas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            alvo_usuario_id: selecionado!.usuarioId,
            alvo_tipo: abaBusca,
          }),
        })
        const json = (await res.json()) as { ok?: boolean; conversa?: { id: string }; error?: string }
        if (!json.ok || !json.conversa?.id) {
          window.alert(json.error ?? 'Não foi possível abrir o mensageiro.')
          return
        }
        patchPainel(abaBusca, { conversaId: json.conversa.id, painelMensageiro: true })
        await carregarMensagens(abaBusca, json.conversa.id)
      } catch {
        window.alert('Erro ao abrir mensageiro.')
      } finally {
        setAbrindoChat(false)
      }
      return
    }
    await carregarMensagens(abaBusca, conversaId)
    patchPainel(abaBusca, { painelMensageiro: true })
  }

  const toggleDesempenho = async () => {
    if (painelDesempenho) {
      patchPainel(abaBusca, { painelDesempenho: false })
      return
    }
    patchPainel(abaBusca, { painelDesempenho: true })
    if (!desempenho) await carregarDesempenho()
  }

  const registrarAcessoConversa = async (id: string) => {
    try {
      await fetch(`/api/admin/financeiro-conversas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'registrar_acesso' }),
      })
      void carregarHistorico()
    } catch {
      /* ignore */
    }
  }

  const encerrarConversaAtiva = async () => {
    if (!conversaId) return
    try {
      const res = await fetch(`/api/admin/financeiro-conversas/${conversaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'encerrar' }),
      })
      if (!res.ok) {
        window.alert('Erro ao arquivar conversa.')
        return
      }
      limparPainel(abaBusca)
      void carregarHistorico()
    } catch {
      window.alert('Erro ao arquivar conversa.')
    }
  }

  const fecharCardLocalizado = () => {
    limparPainel(abaBusca)
  }

  const fecharCardOuArquivar = () => {
    if (conversaEmAndamento) void encerrarConversaAtiva()
    else fecharCardLocalizado()
  }

  const fecharHistoricoDetalhe = () => {
    setHistoricoDetalhe(null)
    setHistoricoMensagens([])
    setHistoricoAdmId(null)
    setHistoricoErro(null)
  }

  const verHistoricoDetalhe = async (id: string) => {
    if (historicoDetalhe === id) {
      fecharHistoricoDetalhe()
      return
    }
    setHistoricoDetalhe(id)
    setHistoricoCarregando(true)
    setHistoricoErro(null)
    setHistoricoMensagens([])
    try {
      const res = await fetch(`/api/admin/financeiro-conversas/${id}`)
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        mensagens?: FinanceiroMensagemRow[]
        conversa?: { adm_usuario_id?: string }
      }
      if (!res.ok || json.ok === false) {
        setHistoricoErro(json.error ?? 'Não foi possível carregar o diálogo.')
        return
      }
      setHistoricoMensagens(json.mensagens ?? [])
      setHistoricoAdmId(
        json.conversa?.adm_usuario_id != null ? String(json.conversa.adm_usuario_id) : null,
      )
      void registrarAcessoConversa(id)
    } catch {
      setHistoricoErro('Erro de rede ao carregar o diálogo.')
    } finally {
      setHistoricoCarregando(false)
    }
  }

  const selecionarDestinatario = (r: Destinatario) => {
    patchPainel(abaBusca, {
      selecionado: r,
      conversaId: null,
      mensagens: [],
      textoMsg: '',
      painelMensageiro: false,
      painelDesempenho: false,
      desempenho: null,
    })
    setBusca('')
    setResultados([])

    void (async () => {
      try {
        const res = await fetch('/api/admin/financeiro-conversas?status=aberta')
        const json = (await res.json()) as {
          conversas?: Array<{ id: string; alvo: Destinatario }>
        }
        const aberta = json.conversas?.find((c) => c.alvo.usuarioId === r.usuarioId)
        if (aberta) {
          patchPainel(abaBusca, {
            selecionado: r,
            conversaId: aberta.id,
            painelMensageiro: true,
          })
          void registrarAcessoConversa(aberta.id)
          await carregarMensagens(abaBusca, aberta.id)
        }
      } catch {
        /* ignore */
      }
    })()
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
          onClick={() => setAba('profissional')}
        >
          Profissional
        </button>
        <button
          type="button"
          role="tab"
          className={abaCls(aba === 'empresa')}
          onClick={() => setAba('empresa')}
        >
          Empresas
        </button>
        <button
          type="button"
          role="tab"
          className={abaCls(aba === 'historico')}
          onClick={() => {
            setAba('historico')
            fecharHistoricoDetalhe()
          }}
        >
          Histórico
        </button>
      </div>

      {aba === 'historico' ? (
        <div className={`mt-4 flex min-h-0 flex-1 flex-col ${embedded ? 'min-h-[min(70vh,32rem)]' : ''}`}>
          {historico.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">Nenhuma conversa encerrada ainda.</p>
          ) : (
            <ul className={`mt-2 space-y-2 overflow-y-auto ${embedded ? 'max-h-[min(70vh,32rem)]' : 'max-h-80'}`}>
              {historico.map((h) => {
                const expandido = historicoDetalhe === h.id
                return (
                  <li key={h.id}>
                    <div className="overflow-hidden rounded-xl shadow-sm">
                      <div
                        className="relative flex items-center gap-2 px-3 py-2"
                        style={{ backgroundColor: COR_LOGO }}
                      >
                        <button
                          type="button"
                          onClick={() => void verHistoricoDetalhe(h.id)}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <AvatarImage
                            src={h.alvo.fotoUrl}
                            alt=""
                            width={40}
                            height={40}
                            className={`${AVATAR_QUADRADO} ring-2 ring-white`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium text-white">{h.alvo.nome}</div>
                            <div className="text-xs text-white/90">
                              {h.alvo_tipo === 'profissional' ? 'Profissional' : 'Empresa'}
                              {h.encerrada_em ? ` · ${new Date(h.encerrada_em).toLocaleString('pt-BR')}` : ''}
                            </div>
                            {h.assunto ? (
                              <div className="line-clamp-3 whitespace-pre-line text-xs text-white/80">
                                {h.assunto}
                              </div>
                            ) : null}
                          </div>
                        </button>
                        <BotaoChevronHistorico
                          expandido={expandido}
                          onClick={() => {
                            if (expandido) fecharHistoricoDetalhe()
                            else void verHistoricoDetalhe(h.id)
                          }}
                        />
                      </div>

                      {expandido ? (
                        <div className="bg-white">
                          <ListaMensagensFinanceiro
                            mensagens={historicoMensagens}
                            viewerUserId={historicoAdmId ?? ''}
                            carregando={historicoCarregando}
                            erro={historicoErro}
                            className="max-h-52 px-3 py-3"
                          />
                        </div>
                      ) : null}
                    </div>
                  </li>
                )
              })}
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
          {buscando && !selecionado ? <p className="mt-2 text-xs text-gray-500">Buscando…</p> : null}

          {resultados.length > 0 && !selecionado ? (
            <ul className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-gray-100 bg-white">
              {resultados.map((r) => (
                <li key={r.usuarioId}>
                  <button
                    type="button"
                    onClick={() => selecionarDestinatario(r)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-gray-50"
                  >
                    <AvatarImage src={r.fotoUrl} alt="" width={40} height={40} className={AVATAR_QUADRADO} />
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
            <div className="relative mt-4 rounded-xl border border-[#0097b2]/25 bg-white p-4 shadow-sm">
              <div className="absolute right-2 top-2 z-10">
                <BotaoFecharCard
                  onClick={fecharCardOuArquivar}
                  ariaLabel={
                    conversaEmAndamento
                      ? 'Encerrar diálogo, arquivar e fechar card'
                      : 'Fechar card'
                  }
                />
              </div>
              <div className="flex items-start gap-3 pr-10">
                <AvatarImage
                  src={selecionado.fotoUrl}
                  alt=""
                  width={56}
                  height={56}
                  className={`h-14 w-14 ${AVATAR_QUADRADO}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-lg font-semibold leading-tight text-gray-900">{selecionado.nome}</div>
                  <div className="text-sm text-gray-600">{selecionado.username}</div>
                </div>
              </div>

              {selecionado.subtitulo ? (
                <p className="mt-3 text-lg font-semibold leading-snug text-[#0097b2]">
                  {rotuloCategoriaCardFinanceiro(selecionado.subtitulo)}
                </p>
              ) : null}

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  disabled={abrindoChat}
                  onClick={() => void toggleMensageiro()}
                  className={`${btnAcaoCls(painelMensageiro)} disabled:opacity-50`}
                  aria-pressed={painelMensageiro}
                >
                  <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
                  {abrindoChat ? 'Abrindo…' : 'Mensageiro'}
                </button>
                <button
                  type="button"
                  onClick={() => void toggleDesempenho()}
                  className={btnAcaoCls(painelDesempenho)}
                  aria-pressed={painelDesempenho}
                >
                  <BarChart3 className="h-4 w-4 shrink-0" aria-hidden />
                  Desempenho
                </button>
              </div>

              {painelMensageiro ? (
                <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50">
                  {conversaId ? (
                    <>
                      <ListaMensagensFinanceiro
                        mensagens={mensagens}
                        viewerUserId=""
                        className="max-h-52 p-3"
                      />
                      <div className="flex items-center gap-2 border-t border-gray-100 bg-white p-2">
                        <input
                          type="text"
                          value={textoMsg}
                          onChange={(e) => patchPainel(abaBusca, { textoMsg: e.target.value })}
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
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#00D443] text-white disabled:opacity-50"
                          aria-label="Enviar"
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="p-4 text-center text-sm text-gray-500">A preparar mensageiro…</p>
                  )}
                </div>
              ) : null}

              {painelDesempenho ? (
                <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-900">
                  <p className="mb-2 font-semibold text-gray-900">Desempenho financeiro</p>
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

function ListaMensagensFinanceiro({
  mensagens,
  viewerUserId,
  carregando = false,
  erro = null,
  className = '',
}: {
  mensagens: Array<Mensagem | FinanceiroMensagemRow>
  viewerUserId: string
  carregando?: boolean
  erro?: string | null
  className?: string
}) {
  if (carregando) {
    return <p className={`py-4 text-center text-xs text-gray-500 ${className}`}>Carregando mensagens…</p>
  }
  if (erro) {
    return <p className={`py-4 text-center text-xs text-red-600 ${className}`}>{erro}</p>
  }
  if (mensagens.length === 0) {
    return (
      <p className={`py-4 text-center text-xs text-gray-500 ${className}`}>
        Nenhuma mensagem nesta conversa.
      </p>
    )
  }

  return (
    <ul className={`space-y-2 overflow-y-auto ${className}`}>
      {mensagens.map((m) => {
        const own = viewerUserId ? m.remetente_id === viewerUserId : false
        return (
          <li
            key={m.id}
            className={`max-w-[92%] rounded-2xl px-2 py-1.5 text-sm ${
              own ? 'ml-auto bg-[#d4edf4] text-gray-900' : 'bg-white text-gray-900 shadow-sm'
            }`}
          >
            {m.texto ? <p className="whitespace-pre-wrap break-words">{m.texto}</p> : null}
            {ehAnexoImagemCanal(m.anexo_url, m.anexo_tipo) && m.anexo_url ? (
              <div className="mt-1">
                <CanalMensagemImagem src={m.anexo_url} />
              </div>
            ) : null}
            {ehAnexoAudioCanal(m.anexo_url, m.anexo_tipo) && m.anexo_url ? (
              <div className="mt-1">
                <CanalMensagemAudio src={m.anexo_url} isOwn={own} />
              </div>
            ) : null}
            {m.anexo_url && m.anexo_tipo === 'documento' ? (
              <a
                href={m.anexo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 block text-xs text-[#0097b2] underline"
              >
                Ver anexo
              </a>
            ) : null}
            <div className="text-[10px] text-gray-400">
              {new Date(m.created_at).toLocaleString('pt-BR')}
            </div>
          </li>
        )
      })}
    </ul>
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
