'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarClock,
  CirclePlus,
  Clock,
  FileText,
  Image as ImageIcon,
  Info,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
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
  tipo: TipoCard
  texto: string
  arquivo: File | null
  previewUrl: string | null
  agendadoPara: string
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
    tipo: 'foto',
    texto: '',
    arquivo: null,
    previewUrl: null,
    agendadoPara: '',
  }
}

function tabCls(ativa: boolean) {
  return [
    'flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold uppercase tracking-wide transition',
    ativa ? 'bg-[#00D443] text-white shadow-sm' : 'bg-white text-gray-500',
  ].join(' ')
}

function tipoBtnCls(ativo: boolean) {
  return [
    'flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-[11px] font-bold uppercase tracking-wide transition',
    ativo
      ? 'border-[#0097b2] bg-[#0097b2]/10 text-[#0097b2]'
      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300',
  ].join(' ')
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
          Posts de texto, fotos e stories seguem as mesmas regras das páginas de criação do app.
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

async function uploadMidiaAgendada(
  usuarioId: string,
  tipo: TipoCard,
  arquivo: File,
): Promise<string> {
  const bucket = tipo === 'story' ? 'stories' : 'posts'
  const ext = arquivo.name.split('.').pop() || 'jpg'
  const path = `${usuarioId}/agendados/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from(bucket).upload(path, arquivo, {
    upsert: false,
    contentType: arquivo.type || 'image/jpeg',
  })
  if (error) throw error
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

export default function AgendarPublicacoes({
  usuarioId,
  empresaId,
}: {
  usuarioId: string | null
  empresaId: string | null
}) {
  const [secaoAberta, setSecaoAberta] = useState(false)
  const [infoAberto, setInfoAberto] = useState(false)
  const [aba, setAba] = useState<AbaAgendar>('programar')
  const [cards, setCards] = useState<CardProgramar[]>([novoCard()])
  const [agendados, setAgendados] = useState<PublicacaoAgendada[]>([])
  const [loadingLista, setLoadingLista] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

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
        .order('agendado_para', { ascending: true })
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
    if (!secaoAberta) return
    void processarVencidos().then(() => carregarAgendados())
  }, [secaoAberta, processarVencidos, carregarAgendados])

  useEffect(() => {
    if (aba === 'agendados') void carregarAgendados()
  }, [aba, carregarAgendados])

  const minDt = useMemo(() => minDatetimeLocalInput(), [])
  const maxDt = useMemo(() => maxDatetimeLocalInput(), [])

  const atualizarCard = (key: string, patch: Partial<CardProgramar>) => {
    setCards((lista) => lista.map((c) => (c.key === key ? { ...c, ...patch } : c)))
  }

  const removerCard = (key: string) => {
    setCards((lista) => {
      const alvo = lista.find((c) => c.key === key)
      if (alvo?.previewUrl) URL.revokeObjectURL(alvo.previewUrl)
      const next = lista.filter((c) => c.key !== key)
      return next.length ? next : [novoCard()]
    })
  }

  const adicionarCard = () => {
    setCards((lista) => [...lista, novoCard()])
  }

  const onArquivo = (key: string, file: File | null) => {
    if (!file) return
    const previewUrl = URL.createObjectURL(file)
    setCards((lista) =>
      lista.map((c) => {
        if (c.key !== key) return c
        if (c.previewUrl) URL.revokeObjectURL(c.previewUrl)
        return { ...c, arquivo: file, previewUrl }
      }),
    )
  }

  const validarCards = (): string | null => {
    if (!usuarioId) return 'Faça login para agendar publicações.'
    for (let i = 0; i < cards.length; i += 1) {
      const c = cards[i]
      const n = i + 1
      const iso = dataHoraAgendamentoValida(c.agendadoPara)
      if (!iso) return `Card ${n}: informe data e hora válidas (até 1 mês).`
      if ((c.tipo === 'foto' || c.tipo === 'story') && !c.arquivo) {
        return `Card ${n}: anexe uma imagem para ${LABEL_TIPO[c.tipo].toLowerCase()}.`
      }
      if (c.tipo === 'texto' && !c.texto.trim()) {
        return `Card ${n}: escreva o texto da publicação.`
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
        const agendadoIso = dataHoraAgendamentoValida(card.agendadoPara)!
        let url: string | null = null
        if (card.arquivo) {
          url = await uploadMidiaAgendada(usuarioId, card.tipo, card.arquivo)
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
              ? {
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
        if (c.previewUrl) URL.revokeObjectURL(c.previewUrl)
      })
      setCards([novoCard()])
      setAba('agendados')
      setFeedback(`${rows.length} publicação(ões) agendada(s) com sucesso.`)
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

  return (
    <>
    <SecaoChevron
      titulo="Agendar Publicação"
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
        <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Agendar publicações">
          <button
            type="button"
            role="tab"
            aria-selected={aba === 'programar'}
            onClick={() => setAba('programar')}
            className={tabCls(aba === 'programar')}
          >
            <CalendarClock className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
            <span>Programar</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={aba === 'agendados'}
            onClick={() => setAba('agendados')}
            className={tabCls(aba === 'agendados')}
          >
            <Clock className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
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
            {cards.map((card, index) => (
              <div key={card.key} className="rounded-xl border border-gray-200 bg-gray-50/80 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-[#001f3f]">Publicação {index + 1}</p>
                  {cards.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removerCard(card.key)}
                      className="rounded-lg p-1.5 text-gray-500 hover:bg-white hover:text-rose-600"
                      aria-label="Remover publicação"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  ) : null}
                </div>

                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Tipo de conteúdo</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => atualizarCard(card.key, { tipo: 'story' })} className={tipoBtnCls(card.tipo === 'story')}>
                    <Sparkles className="h-4 w-4" aria-hidden />
                    Story
                  </button>
                  <button type="button" onClick={() => atualizarCard(card.key, { tipo: 'foto' })} className={tipoBtnCls(card.tipo === 'foto')}>
                    <ImageIcon className="h-4 w-4" aria-hidden />
                    Foto
                  </button>
                  <button type="button" onClick={() => atualizarCard(card.key, { tipo: 'texto' })} className={tipoBtnCls(card.tipo === 'texto')}>
                    <FileText className="h-4 w-4" aria-hidden />
                    Texto
                  </button>
                </div>

                {card.tipo !== 'texto' ? (
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Anexar arquivo</p>
                    <input
                      ref={(el) => {
                        inputRefs.current[card.key] = el
                      }}
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => onArquivo(card.key, e.target.files?.[0] ?? null)}
                    />
                    <button
                      type="button"
                      onClick={() => inputRefs.current[card.key]?.click()}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-white py-6 text-sm font-semibold text-[#0097b2] transition hover:border-[#0097b2]/50 hover:bg-[#0097b2]/5"
                    >
                      <CirclePlus className="h-5 w-5" aria-hidden />
                      {card.arquivo ? card.arquivo.name : 'Adicionar imagem'}
                    </button>
                    {card.previewUrl ? (
                      <img
                        src={card.previewUrl}
                        alt=""
                        className="mt-3 max-h-40 w-full rounded-lg object-cover"
                      />
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-4">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {card.tipo === 'texto' ? 'Texto da publicação' : 'Legenda (opcional)'}
                  </label>
                  <textarea
                    value={card.texto}
                    onChange={(e) => atualizarCard(card.key, { texto: e.target.value })}
                    rows={card.tipo === 'texto' ? 4 : 2}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#0097b2]"
                    placeholder={card.tipo === 'texto' ? 'Escreva o post de texto…' : 'Legenda da publicação…'}
                  />
                </div>

                <div className="mt-4">
                  <label
                    htmlFor={`dt-${card.key}`}
                    className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500"
                  >
                    Data e hora
                  </label>
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
                </div>
              </div>
            ))}

            <div className="flex justify-center">
              <button
                type="button"
                onClick={adicionarCard}
                className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#0097b2] bg-white text-[#0097b2] shadow-sm transition hover:bg-[#0097b2]/10"
                aria-label="Adicionar outra publicação"
              >
                <Plus className="h-6 w-6" strokeWidth={2.5} aria-hidden />
              </button>
            </div>

            <button
              type="button"
              onClick={() => void agendar()}
              disabled={salvando || !usuarioId}
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
                        {new Date(item.agendado_para).toLocaleString('pt-BR')}
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
