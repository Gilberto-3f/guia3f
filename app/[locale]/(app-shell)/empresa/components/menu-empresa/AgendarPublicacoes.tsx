'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import {
  CalendarClock,
  Check,
  Clock,
  FileText,
  Image as ImageIcon,
  Info,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  consumirDraftAgendamento,
  lerSnapshotCardAgendamento,
  removerSnapshotCardAgendamento,
  salvarSnapshotCardAgendamento,
  type AgendamentoDraft,
  type StoryMetaAgendamento,
} from '@/lib/agendamentoConteudoDraft'
import { uploadMidiaAgendada } from '@/lib/agendamentoUpload'
import {
  dataHoraAgendamentoValida,
  maxDatetimeLocalInput,
  minDatetimeLocalInput,
} from '@/lib/publicarPublicacaoAgendada'
import { tentarProcessarPublicacoesAgendadas } from '@/lib/processarPublicacoesAgendadasClient'
import SecaoChevron from './SecaoChevron'

type AbaAgendar = 'programar' | 'agendados'
type TipoCard = 'story' | 'foto' | 'texto'

type CardProgramar = {
  key: string
  tipo: TipoCard | null
  texto: string
  arquivo: File | null
  previewUrl: string | null
  conteudoUrl: string | null
  storyMeta: StoryMetaAgendamento | null
  agendadoPara: string
  editadoNoFluxoNativo: boolean
}

type PublicacaoAgendada = {
  id: string
  tipo_conteudo: TipoCard
  texto: string | null
  foto_url: string | null
  agendado_para: string
  status: string
  publicado_em: string | null
  erro_msg: string | null
}

const LABEL_TIPO: Record<TipoCard, string> = {
  story: 'Story',
  foto: 'Foto',
  texto: 'Post de texto',
}

const LABEL_STATUS: Record<string, string> = {
  pendente: 'Aguardando',
  publicado: 'Publicado',
  erro: 'Erro',
  cancelado: 'Cancelado',
}

function novoCard(): CardProgramar {
  return {
    key: `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    tipo: null,
    texto: '',
    arquivo: null,
    previewUrl: null,
    conteudoUrl: null,
    storyMeta: null,
    agendadoPara: '',
    editadoNoFluxoNativo: false,
  }
}

function tabCls(ativa: boolean) {
  return [
    'flex min-h-[54px] flex-1 items-center justify-center gap-2.5 rounded-lg border px-3 py-2 text-[15px] font-medium transition',
    ativa
      ? 'border-[#00D443] bg-[#00D443] text-white shadow-sm'
      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300',
  ].join(' ')
}

function tipoBtnCls(ativo: boolean) {
  return [
    'flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-xs font-semibold transition',
    ativo
      ? 'border-[#0097b2] bg-[#0097b2]/10 text-[#0097b2]'
      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300',
  ].join(' ')
}

function passoArquivoCompleto(card: CardProgramar): boolean {
  if (card.tipo === 'texto') return true
  return Boolean(card.conteudoUrl || card.arquivo)
}

function passoLegendaCompleto(card: CardProgramar): boolean {
  if (card.tipo === 'texto') return card.texto.trim().length > 0
  if (card.tipo === 'story' || card.tipo === 'foto') {
    return card.editadoNoFluxoNativo || card.texto.trim().length > 0
  }
  return false
}

function passoDataCompleto(card: CardProgramar): boolean {
  return Boolean(dataHoraAgendamentoValida(card.agendadoPara))
}

function aplicarDraftNoCard(card: CardProgramar, draft: AgendamentoDraft): CardProgramar {
  if (draft.kind === 'story') {
    return {
      ...card,
      tipo: 'story',
      conteudoUrl: draft.conteudoUrl,
      texto: draft.texto,
      storyMeta: draft.story_meta,
      previewUrl: draft.previewUrl,
      editadoNoFluxoNativo: true,
      arquivo: null,
    }
  }
  return {
    ...card,
    tipo: 'foto',
    conteudoUrl: draft.conteudoUrl,
    texto: draft.texto,
    previewUrl: draft.previewUrl,
    editadoNoFluxoNativo: true,
    arquivo: null,
  }
}

function PassoSecao({
  numero,
  titulo,
  liberado,
  completo,
  children,
}: {
  numero: number
  titulo: string
  liberado: boolean
  completo: boolean
  children: ReactNode
}) {
  return (
    <div
      className={[
        'rounded-xl border p-3 transition',
        liberado ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50/60 opacity-60',
      ].join(' ')}
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className={[
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
            completo ? 'bg-[#00D443] text-white' : liberado ? 'bg-[#0097b2]/15 text-[#0097b2]' : 'bg-gray-200 text-gray-500',
          ].join(' ')}
        >
          {completo ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden /> : numero}
        </span>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">{titulo}</p>
      </div>
      {liberado ? children : null}
    </div>
  )
}

function PopupInfoAgendamento({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  if (!aberto) return null
  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={onFechar}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="info-agendamento-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="info-agendamento-titulo" className="text-lg font-bold text-gray-900">
          Agendamento de publicações
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-gray-700">
          Publicações agendadas são publicadas automaticamente no feed ou nos stories na data e horário
          definidos (até 1 mês de antecedência).
        </p>
        <p className="mt-3 text-sm leading-relaxed text-gray-700">
          Stories e fotos são editados nas mesmas páginas de criação do app, garantindo o formato original.
        </p>
        <button
          type="button"
          onClick={onFechar}
          className="mt-5 w-full rounded-lg bg-[#0097b2] px-4 py-3 text-sm font-bold text-white hover:opacity-95"
        >
          Entendi
        </button>
      </div>
    </div>
  )
}

export default function AgendarPublicacoes({
  usuarioId,
  empresaId,
}: {
  usuarioId: string | null
  empresaId: string | null
}) {
  const searchParams = useSearchParams()
  const [secaoAberta, setSecaoAberta] = useState(false)
  const [infoAberto, setInfoAberto] = useState(false)
  const [aba, setAba] = useState<AbaAgendar>('programar')
  const [cards, setCards] = useState<CardProgramar[]>([novoCard()])
  const [agendados, setAgendados] = useState<PublicacaoAgendada[]>([])
  const [loadingLista, setLoadingLista] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const carregarAgendados = useCallback(async () => {
    if (!usuarioId) {
      setAgendados([])
      return
    }
    setLoadingLista(true)
    try {
      const { data, error } = await supabase
        .from('publicacoes_agendadas')
        .select('id, tipo_conteudo, texto, foto_url, agendado_para, status, publicado_em, erro_msg')
        .eq('usuario_id', usuarioId)
        .neq('status', 'cancelado')
        .order('agendado_para', { ascending: false })
        .limit(100)
      if (error) throw error
      setAgendados((data ?? []) as PublicacaoAgendada[])
    } catch {
      setAgendados([])
    } finally {
      setLoadingLista(false)
    }
  }, [usuarioId])

  const processarVencidos = useCallback(async () => {
    await tentarProcessarPublicacoesAgendadas()
  }, [])

  useEffect(() => {
    const agendarKey = searchParams.get('agendar')
    const secao = searchParams.get('secao')
    const abaParam = searchParams.get('aba')
    if (secao === 'agendar' || agendarKey) {
      setSecaoAberta(true)
      if (abaParam === 'agendados') setAba('agendados')
      else setAba('programar')
    }
    if (!agendarKey) return

    const draft = consumirDraftAgendamento(agendarKey)
    const snapshot = lerSnapshotCardAgendamento(agendarKey)
    if (snapshot) removerSnapshotCardAgendamento(agendarKey)
    setCards((lista) => {
      const existe = lista.some((c) => c.key === agendarKey)
      const base = existe ? lista : [...lista, { ...novoCard(), key: agendarKey }]
      return base.map((c) => {
        if (c.key !== agendarKey) return c
        let next = c
        if (snapshot) {
          next = {
            ...next,
            tipo: snapshot.tipo,
            texto: snapshot.texto,
            agendadoPara: snapshot.agendadoPara,
          }
        }
        if (draft) next = aplicarDraftNoCard(next, draft)
        return next
      })
    })
  }, [searchParams])

  useEffect(() => {
    if (!secaoAberta) return
    void processarVencidos().then(() => carregarAgendados())
    const intervalo = window.setInterval(() => {
      void processarVencidos().then(() => carregarAgendados())
    }, 60_000)
    return () => window.clearInterval(intervalo)
  }, [secaoAberta, processarVencidos, carregarAgendados])

  useEffect(() => {
    if (aba === 'agendados') void carregarAgendados()
  }, [aba, carregarAgendados])

  const minDt = useMemo(() => minDatetimeLocalInput(), [])
  const maxDt = useMemo(() => maxDatetimeLocalInput(), [])

  const atualizarCard = (key: string, patch: Partial<CardProgramar>) => {
    setCards((lista) =>
      lista.map((c) => {
        if (c.key !== key) return c
        const next = { ...c, ...patch }
        if (patch.tipo && patch.tipo !== c.tipo) {
          if (c.previewUrl) URL.revokeObjectURL(c.previewUrl)
          return {
            ...next,
            texto: '',
            arquivo: null,
            previewUrl: null,
            conteudoUrl: null,
            storyMeta: null,
            editadoNoFluxoNativo: false,
          }
        }
        return next
      }),
    )
  }

  const removerCard = (key: string) => {
    setCards((lista) => {
      const alvo = lista.find((c) => c.key === key)
      if (alvo?.previewUrl && !alvo.previewUrl.startsWith('http')) URL.revokeObjectURL(alvo.previewUrl)
      const next = lista.filter((c) => c.key !== key)
      return next.length ? next : [novoCard()]
    })
  }

  const adicionarCard = () => {
    const ultimo = cards[cards.length - 1]
    if (ultimo && !passoDataCompleto(ultimo)) return
    setCards((lista) => [...lista, novoCard()])
  }

  const validarCards = (): string | null => {
    if (!usuarioId) return 'Faça login para agendar publicações.'
    for (let i = 0; i < cards.length; i += 1) {
      const c = cards[i]
      const n = i + 1
      if (!c.tipo) return `Publicação ${n}: selecione o tipo de conteúdo.`
      const iso = dataHoraAgendamentoValida(c.agendadoPara)
      if (!iso) return `Publicação ${n}: informe data e hora válidas (até 1 mês).`
      if ((c.tipo === 'foto' || c.tipo === 'story') && !c.conteudoUrl && !c.arquivo) {
        return `Publicação ${n}: edite o ${LABEL_TIPO[c.tipo].toLowerCase()} antes de agendar.`
      }
      if (c.tipo === 'texto' && !c.texto.trim()) {
        return `Publicação ${n}: escreva o texto da publicação.`
      }
    }
    return null
  }

  const agendar = async () => {
    const erroValidacao = validarCards()
    if (erroValidacao) {
      setFeedback(erroValidacao)
      return
    }
    if (!usuarioId) return

    setSalvando(true)
    setFeedback(null)
    try {
      const rows = []
      for (const card of cards) {
        if (!card.tipo) continue
        const agendadoIso = dataHoraAgendamentoValida(card.agendadoPara)!
        let url: string | null = card.conteudoUrl
        if (!url && card.arquivo) {
          url = await uploadMidiaAgendada(usuarioId, card.tipo === 'story' ? 'story' : 'foto', card.arquivo)
        }
        rows.push({
          usuario_id: usuarioId,
          empresa_id: empresaId,
          tipo_conteudo: card.tipo,
          texto: card.texto.trim() || null,
          foto_url: url,
          conteudo_url: url,
          story_meta:
            card.tipo === 'story'
              ? card.storyMeta ?? {
                  texto_sobreposto: {
                    texto: card.texto.trim() || null,
                    posicao_x: 50,
                    posicao_y: 70,
                    link_posicao_x: 50,
                    link_posicao_y: 82,
                    fundo_fit: 'contain',
                    fundo_scale: 1,
                    fundo_pan_x_pct: 0,
                    fundo_pan_y_pct: 0,
                    texto_scale: 1,
                  },
                }
              : null,
          autor_tipo: 'empresa',
          agendado_para: agendadoIso,
          status: 'pendente',
        })
      }

      const { error } = await supabase.from('publicacoes_agendadas').insert(rows)
      if (error) throw error

      cards.forEach((c) => {
        if (c.previewUrl && !c.previewUrl.startsWith('http')) URL.revokeObjectURL(c.previewUrl)
      })
      setCards([novoCard()])
      setAba('agendados')
      setFeedback(`${rows.length} publicação(ões) agendada(s) com sucesso.`)
      cards.forEach((c) => removerSnapshotCardAgendamento(c.key))
      await carregarAgendados()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Não foi possível agendar.'
      setFeedback(msg)
    } finally {
      setSalvando(false)
    }
  }

  const cancelarAgendado = async (id: string) => {
    const { error } = await supabase
      .from('publicacoes_agendadas')
      .update({ status: 'cancelado' })
      .eq('id', id)
      .eq('status', 'pendente')
    if (!error) void carregarAgendados()
  }

  const podeAgendar = cards.every(
    (c) => c.tipo && passoArquivoCompleto(c) && passoLegendaCompleto(c) && passoDataCompleto(c),
  )
  const podeAdicionarCard = cards.length === 0 || passoDataCompleto(cards[cards.length - 1])

  return (
    <>
      <SecaoChevron
        titulo="Agendar Publicações"
        aberta={secaoAberta}
        onToggle={() => setSecaoAberta((v) => !v)}
        leading={
          <button
            type="button"
            onClick={() => setInfoAberto(true)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#0097b2] transition hover:bg-[#0097b2]/10"
            aria-label="Informações sobre agendamento de publicações"
          >
            <Info className="h-4 w-4" strokeWidth={2.25} aria-hidden />
          </button>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2.5" role="tablist" aria-label="Agendar publicações">
            <button
              type="button"
              role="tab"
              aria-selected={aba === 'programar'}
              onClick={() => setAba('programar')}
              className={tabCls(aba === 'programar')}
            >
              <CalendarClock className="h-[22px] w-[22px] shrink-0" strokeWidth={2} aria-hidden />
              <span>Programar</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={aba === 'agendados'}
              onClick={() => setAba('agendados')}
              className={tabCls(aba === 'agendados')}
            >
              <Clock className="h-[22px] w-[22px] shrink-0" strokeWidth={2} aria-hidden />
              <span>Agendados</span>
            </button>
          </div>

          {feedback ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {feedback}
            </p>
          ) : null}

          {aba === 'programar' ? (
            <div className="space-y-4">
              {cards.map((card, index) => {
                const tipoOk = card.tipo != null
                const arquivoOk = passoArquivoCompleto(card)
                const legendaOk = passoLegendaCompleto(card)
                const dataOk = passoDataCompleto(card)

                return (
                  <div key={card.key} className="rounded-xl border border-gray-200 bg-gray-50/80 p-4">
                    <div className="relative mb-4 flex items-center justify-center">
                      <p className="text-center text-sm font-bold text-[#001f3f]">Publicação {index + 1}</p>
                      {cards.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removerCard(card.key)}
                          className="absolute right-0 rounded-lg p-1.5 text-gray-500 hover:bg-white hover:text-rose-600"
                          aria-label="Remover publicação"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      ) : null}
                    </div>

                    <div className="space-y-3">
                      <PassoSecao numero={1} titulo="Tipo de conteúdo" liberado completo={tipoOk}>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => atualizarCard(card.key, { tipo: 'story' })}
                            className={tipoBtnCls(card.tipo === 'story')}
                          >
                            <Sparkles className="h-5 w-5" aria-hidden />
                            Story
                          </button>
                          <button
                            type="button"
                            onClick={() => atualizarCard(card.key, { tipo: 'foto' })}
                            className={tipoBtnCls(card.tipo === 'foto')}
                          >
                            <ImageIcon className="h-5 w-5" aria-hidden />
                            Foto
                          </button>
                          <button
                            type="button"
                            onClick={() => atualizarCard(card.key, { tipo: 'texto' })}
                            className={tipoBtnCls(card.tipo === 'texto')}
                          >
                            <FileText className="h-5 w-5" aria-hidden />
                            Texto
                          </button>
                        </div>
                      </PassoSecao>

                      {card.tipo && card.tipo !== 'texto' ? (
                        <PassoSecao
                          numero={2}
                          titulo="Anexar arquivo"
                          liberado={tipoOk}
                          completo={arquivoOk}
                        >
                          <Link
                            href={
                              card.tipo === 'story'
                                ? `/feed/story/criar?agendar=${encodeURIComponent(card.key)}`
                                : `/feed/criar?agendar=${encodeURIComponent(card.key)}`
                            }
                            onClick={() => {
                              if (card.tipo) {
                                salvarSnapshotCardAgendamento(card.key, {
                                  tipo: card.tipo,
                                  texto: card.texto,
                                  agendadoPara: card.agendadoPara,
                                })
                              }
                            }}
                            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-white py-5 text-sm font-semibold text-[#0097b2] transition hover:border-[#0097b2]/50 hover:bg-[#0097b2]/5"
                          >
                            {arquivoOk ? (
                              <>
                                <Check className="h-5 w-5 text-[#00D443]" aria-hidden />
                                {card.tipo === 'story' ? 'Story editado — toque para refazer' : 'Foto editada — toque para refazer'}
                              </>
                            ) : (
                              <>
                                <Pencil className="h-5 w-5" aria-hidden />
                                {card.tipo === 'story' ? 'Editar story' : 'Editar foto com legenda'}
                              </>
                            )}
                          </Link>
                          {card.previewUrl ? (
                            <img
                              src={card.previewUrl}
                              alt=""
                              className="mt-3 max-h-48 w-full rounded-lg object-contain bg-black/5"
                            />
                          ) : null}
                        </PassoSecao>
                      ) : null}

                      <PassoSecao
                        numero={card.tipo === 'texto' ? 2 : 3}
                        titulo={card.tipo === 'texto' ? 'Texto da publicação' : 'Legenda'}
                        liberado={tipoOk && (card.tipo === 'texto' || arquivoOk)}
                        completo={legendaOk}
                      >
                        {card.tipo === 'texto' || !card.editadoNoFluxoNativo ? (
                          <textarea
                            value={card.texto}
                            onChange={(e) => atualizarCard(card.key, { texto: e.target.value })}
                            rows={card.tipo === 'texto' ? 4 : 2}
                            readOnly={card.editadoNoFluxoNativo && card.tipo !== 'texto'}
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#0097b2] read-only:bg-gray-50 read-only:text-gray-600"
                            placeholder={
                              card.tipo === 'texto' ? 'Escreva o post de texto…' : 'Legenda da publicação…'
                            }
                          />
                        ) : (
                          <p className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700">
                            {card.texto.trim() || 'Sem legenda'}
                          </p>
                        )}
                      </PassoSecao>

                      <PassoSecao
                        numero={card.tipo === 'texto' ? 3 : 4}
                        titulo="Data e hora"
                        liberado={tipoOk && legendaOk && (card.tipo === 'texto' || arquivoOk)}
                        completo={dataOk}
                      >
                        <input
                          id={`dt-${card.key}`}
                          type="datetime-local"
                          min={minDt}
                          max={maxDt}
                          value={card.agendadoPara}
                          onChange={(e) => atualizarCard(card.key, { agendadoPara: e.target.value })}
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#0097b2]"
                        />
                        <p className="mt-1 text-[11px] text-gray-500">Até 1 mês a partir de hoje.</p>
                      </PassoSecao>
                    </div>
                  </div>
                )
              })}

              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={adicionarCard}
                  disabled={!podeAdicionarCard}
                  className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#0097b2] bg-white text-[#0097b2] shadow-sm transition hover:bg-[#0097b2]/10 disabled:opacity-40"
                  aria-label="Adicionar outra publicação"
                >
                  <Plus className="h-6 w-6" strokeWidth={2.5} aria-hidden />
                </button>
              </div>

              <button
                type="button"
                onClick={() => void agendar()}
                disabled={salvando || !usuarioId || !podeAgendar}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00D443] px-4 py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-sm transition hover:brightness-95 disabled:opacity-60"
              >
                {salvando ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                ) : (
                  <CalendarClock className="h-5 w-5" aria-hidden />
                )}
                Agendar
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {loadingLista ? (
                <p className="py-6 text-center text-sm text-gray-500">Carregando agendamentos…</p>
              ) : agendados.length === 0 ? (
                <div className="rounded-lg bg-gray-50 py-8 text-center text-sm text-gray-500">
                  Nenhuma publicação agendada ainda.
                </div>
              ) : (
                agendados.map((item) => (
                  <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[#001f3f]">{LABEL_TIPO[item.tipo_conteudo]}</p>
                        {item.texto ? (
                          <p className="mt-1 line-clamp-2 text-sm text-gray-600">{item.texto}</p>
                        ) : null}
                        <p className="mt-2 text-xs text-gray-500">
                          Agendado para {new Date(item.agendado_para).toLocaleString('pt-BR')}
                          {item.publicado_em
                            ? ` · Publicado em ${new Date(item.publicado_em).toLocaleString('pt-BR')}`
                            : ''}
                        </p>
                        {item.erro_msg ? (
                          <p className="mt-1 text-xs text-rose-600">{item.erro_msg}</p>
                        ) : null}
                      </div>
                      <span
                        className={[
                          'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase',
                          item.status === 'publicado'
                            ? 'bg-emerald-50 text-emerald-700'
                            : item.status === 'erro'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-amber-50 text-amber-800',
                        ].join(' ')}
                      >
                        {LABEL_STATUS[item.status] ?? item.status}
                      </span>
                    </div>
                    {item.foto_url && item.tipo_conteudo !== 'texto' ? (
                      <img
                        src={item.foto_url}
                        alt=""
                        className="mt-3 max-h-32 w-full rounded-lg object-contain bg-gray-50"
                      />
                    ) : null}
                    {item.status === 'pendente' ? (
                      <button
                        type="button"
                        onClick={() => void cancelarAgendado(item.id)}
                        className="mt-3 text-xs font-semibold text-rose-600 hover:underline"
                      >
                        Cancelar agendamento
                      </button>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </SecaoChevron>
      <PopupInfoAgendamento aberto={infoAberto} onFechar={() => setInfoAberto(false)} />
    </>
  )
}
