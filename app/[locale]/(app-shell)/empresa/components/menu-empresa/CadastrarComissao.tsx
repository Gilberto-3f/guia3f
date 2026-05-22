'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import BotaoInfoBeneficio from '@/components/comissoes/BotaoInfoBeneficio'
import ModoApresentacaoIcon from '@/components/ModoApresentacaoIcon'
import { useDashboardEmpresa } from '@/app/[locale]/(app-shell)/dashboard/empresa/hooks/useDashboardEmpresa'
import {
  classeStatusOferta,
  listarBeneficiosOferta,
  mapaOfertasAtivasPorComunidade,
  ofertaPodeSerRemovidaPelaEmpresa,
  rotuloStatusOferta,
  ROTULOS_BENEFICIO,
} from '@/lib/comissoesBeneficiosInfo'
import type { TipoBeneficioComissao } from '@/lib/comissoesBeneficiosInfo'
import { supabase } from '@/lib/supabase'

const COMUNIDADES = [
  { label: 'Motorista de APP', iconeKey: 'motorista_app' },
  { label: 'Guia de Turismo', iconeKey: 'guia' },
  { label: 'Motorista de Van', iconeKey: 'van' },
  { label: 'Taxista', iconeKey: 'taxista' },
  { label: 'Anfitrião', iconeKey: 'anfitriao' },
] as const

type ComunidadeLabel = (typeof COMUNIDADES)[number]['label']

const ICONE_POR_CATEGORIA: Record<string, string> = Object.fromEntries(
  COMUNIDADES.map((c) => [c.label, c.iconeKey])
)

const SEM_PRAZO_DATA = '2099-12-31'

const INPUT_CLS =
  'rounded-lg border border-gray-200 bg-white p-2 text-sm text-gray-900 placeholder:text-gray-400'

function abaCls(ativa: boolean) {
  return `flex-1 border-b-[3px] py-3 text-center text-sm font-semibold transition-colors sm:text-base ${
    ativa ? 'border-[#0097b2] text-[#0097b2]' : 'border-transparent text-gray-500'
  }`
}

function criarBeneficiosVazio() {
  return {
    pax: { ativo: false, valor: 0 },
    percentual: { ativo: false, valor: 0 },
    fixo: { ativo: false, valor: 0 },
    extra: { ativo: false, texto: '' },
  }
}

function criarFormularioVazio() {
  return {
    beneficios: criarBeneficiosVazio(),
    porTempoLimitado: false,
    validade: '',
  }
}

function formulariosIniciais() {
  return Object.fromEntries(COMUNIDADES.map((c) => [c.label, criarFormularioVazio()])) as Record<
    ComunidadeLabel,
    ReturnType<typeof criarFormularioVazio>
  >
}

function comunidadesAbertasIniciais() {
  return Object.fromEntries(COMUNIDADES.map((c) => [c.label, false])) as Record<ComunidadeLabel, boolean>
}

function textoValidadeOferta(oferta: Record<string, unknown>) {
  const raw = oferta.beneficios
  const b =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as { por_tempo_limitado?: boolean })
      : {}
  const limitado = b.por_tempo_limitado === true
  const data = oferta.data_validade ? String(oferta.data_validade).slice(0, 10) : ''
  if (!limitado || !data || data === SEM_PRAZO_DATA) return null
  return `Por tempo limitado até ${new Date(data + 'T12:00:00').toLocaleDateString('pt-BR')}`
}

export default function CadastrarComissao() {
  const { dados: empresa } = useDashboardEmpresa()
  const empresaId = empresa?.id ?? null

  const [aba, setAba] = useState<'comissao' | 'historico'>('comissao')
  const [formularios, setFormularios] = useState(formulariosIniciais)
  const [comunidadesAbertas, setComunidadesAbertas] = useState(comunidadesAbertasIniciais)
  const [ofertas, setOfertas] = useState<Array<Record<string, unknown>>>([])
  const [carregando, setCarregando] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)
  const [salvando, setSalvando] = useState<ComunidadeLabel | null>(null)
  const [beneficioInfoAberto, setBeneficioInfoAberto] = useState<string | null>(null)
  const [historicoStatusAberto, setHistoricoStatusAberto] = useState<Set<string>>(new Set())
  const [removendoOfertaId, setRemovendoOfertaId] = useState<string | null>(null)
  const [substituicaoPendente, setSubstituicaoPendente] = useState<{
    categoria: ComunidadeLabel
    ofertaAtivaId: string
  } | null>(null)

  const ofertasAtivasPorComunidade = useMemo(() => mapaOfertasAtivasPorComunidade(ofertas), [ofertas])

  const carregar = useCallback(async () => {
    if (!empresaId) {
      setOfertas([])
      setCarregando(false)
      return
    }
    setCarregando(true)
    const { data, error } = await supabase
      .from('comissao_oferta')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false })
    if (!error && data) setOfertas(data)
    setCarregando(false)
  }, [empresaId])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const toggleComunidade = (categoria: ComunidadeLabel) => {
    setComunidadesAbertas((p) => ({ ...p, [categoria]: !p[categoria] }))
  }

  const atualizarFormulario = (categoria: ComunidadeLabel, patch: Partial<ReturnType<typeof criarFormularioVazio>>) => {
    setFormularios((p) => ({
      ...p,
      [categoria]: { ...p[categoria], ...patch },
    }))
  }

  const atualizarBeneficios = (
    categoria: ComunidadeLabel,
    beneficios: ReturnType<typeof criarBeneficiosVazio>
  ) => {
    setFormularios((p) => ({
      ...p,
      [categoria]: { ...p[categoria], beneficios },
    }))
  }

  const temBeneficioAtivo = (beneficios: ReturnType<typeof criarBeneficiosVazio>) =>
    beneficios.pax.ativo ||
    beneficios.percentual.ativo ||
    beneficios.fixo.ativo ||
    (beneficios.extra.ativo && String(beneficios.extra.texto).trim() !== '')

  const executarCadastro = async (categoria: ComunidadeLabel, ofertaAtivaIdSubstituir: string | null) => {
    if (!empresaId) return
    const form = formularios[categoria]
    setSalvando(categoria)
    setMsg(null)

    if (ofertaAtivaIdSubstituir) {
      const { error: errRemover } = await supabase
        .from('comissao_oferta')
        .update({ status: 'removido' })
        .eq('id', ofertaAtivaIdSubstituir)
        .eq('empresa_id', empresaId)
      if (errRemover) {
        setSalvando(null)
        setMsg(errRemover.message || 'Não foi possível remover a oferta anterior.')
        return
      }
    }

    const beneficiosPayload = {
      ...form.beneficios,
      por_tempo_limitado: form.porTempoLimitado,
    }

    const { error } = await supabase.from('comissao_oferta').insert({
      empresa_id: empresaId,
      categoria_profissional: categoria,
      beneficios: beneficiosPayload,
      data_validade: form.porTempoLimitado && form.validade ? form.validade : SEM_PRAZO_DATA,
      status: 'pendente',
    })

    setSalvando(null)

    if (error) {
      if (error.code === '23505') {
        setMsg(
          'Já existe uma oferta ativa para esta comunidade. Remova a oferta atual no histórico ou confirme a substituição.'
        )
      } else {
        setMsg(error.message)
      }
      void carregar()
      return
    }

    setFormularios((p) => ({ ...p, [categoria]: criarFormularioVazio() }))
    setComunidadesAbertas((p) => ({ ...p, [categoria]: false }))
    setSubstituicaoPendente(null)
    setMsg(
      ofertaAtivaIdSubstituir
        ? `Oferta substituída para ${categoria}. A anterior foi marcada como removida.`
        : `Oferta cadastrada para ${categoria}.`
    )
    void carregar()
  }

  const handleSubmit = (categoria: ComunidadeLabel) => {
    if (!empresaId) return
    const form = formularios[categoria]
    if (!temBeneficioAtivo(form.beneficios)) {
      setMsg('Ative pelo menos um benefício antes de cadastrar.')
      return
    }
    if (form.porTempoLimitado && !form.validade) {
      setMsg('Informe a data limite ou desmarque "por tempo limitado?".')
      return
    }

    const ofertaAtiva = ofertasAtivasPorComunidade.get(categoria)
    if (ofertaAtiva) {
      const id = String(ofertaAtiva.id ?? '')
      if (id) {
        setSubstituicaoPendente({ categoria, ofertaAtivaId: id })
        return
      }
    }

    void executarCadastro(categoria, null)
  }

  const removerOferta = async (ofertaId: string) => {
    if (!empresaId || !ofertaId) return
    setRemovendoOfertaId(ofertaId)
    setMsg(null)
    const { error } = await supabase
      .from('comissao_oferta')
      .update({ status: 'removido' })
      .eq('id', ofertaId)
      .eq('empresa_id', empresaId)
    setRemovendoOfertaId(null)
    if (error) {
      setMsg(error.message || 'Não foi possível remover a oferta.')
      return
    }
    setHistoricoStatusAberto((prev) => {
      const next = new Set(prev)
      next.delete(ofertaId)
      return next
    })
    setMsg('Oferta removida. Ela não aparecerá mais para os profissionais.')
    void carregar()
  }

  const toggleHistoricoStatus = (ofertaId: string) => {
    setHistoricoStatusAberto((prev) => {
      const next = new Set(prev)
      if (next.has(ofertaId)) next.delete(ofertaId)
      else next.add(ofertaId)
      return next
    })
  }

  const renderLinhaBeneficio = (
    categoria: ComunidadeLabel,
    tipo: TipoBeneficioComissao,
    idSuffix: string,
    label: string,
    checked: boolean,
    onChecked: (ativo: boolean) => void,
    campo: ReactNode
  ) => {
    const infoKey = `${categoria}-${tipo}`
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id={`${categoria}-${idSuffix}`}
            checked={checked}
            onChange={(e) => onChecked(e.target.checked)}
            className="shrink-0"
          />
          <label htmlFor={`${categoria}-${idSuffix}`} className="min-w-0 flex-1 text-sm font-medium text-gray-700">
            {label}
          </label>
          <BotaoInfoBeneficio
            tipo={tipo}
            aberto={beneficioInfoAberto === infoKey}
            onToggle={() => setBeneficioInfoAberto((atual) => (atual === infoKey ? null : infoKey))}
            onFechar={() => setBeneficioInfoAberto(null)}
          />
        </div>
        {checked ? <div className="pl-6">{campo}</div> : null}
      </div>
    )
  }

  const renderBeneficios = (categoria: ComunidadeLabel) => {
    const form = formularios[categoria]
    const beneficios = form.beneficios

    return (
      <div className="space-y-4 border-t border-gray-100 pt-3">
        {renderLinhaBeneficio(
          categoria,
          'pax',
          'pax',
          ROTULOS_BENEFICIO.pax,
          beneficios.pax.ativo,
          (ativo) =>
            atualizarBeneficios(categoria, {
              ...beneficios,
              pax: { ...beneficios.pax, ativo },
            }),
          <input
            type="number"
            placeholder="Valor (R$)"
            value={beneficios.pax.valor || ''}
            onChange={(e) =>
              atualizarBeneficios(categoria, {
                ...beneficios,
                pax: { ...beneficios.pax, valor: parseFloat(e.target.value) || 0 },
              })
            }
            className={`w-full ${INPUT_CLS}`}
          />
        )}

        {renderLinhaBeneficio(
          categoria,
          'percentual',
          'pct',
          ROTULOS_BENEFICIO.percentual,
          beneficios.percentual.ativo,
          (ativo) =>
            atualizarBeneficios(categoria, {
              ...beneficios,
              percentual: { ...beneficios.percentual, ativo },
            }),
          <input
            type="number"
            placeholder="Percentual (%)"
            value={beneficios.percentual.valor || ''}
            onChange={(e) =>
              atualizarBeneficios(categoria, {
                ...beneficios,
                percentual: { ...beneficios.percentual, valor: parseFloat(e.target.value) || 0 },
              })
            }
            className={`w-full ${INPUT_CLS}`}
          />
        )}

        {renderLinhaBeneficio(
          categoria,
          'fixo',
          'fixo',
          ROTULOS_BENEFICIO.fixo,
          beneficios.fixo.ativo,
          (ativo) =>
            atualizarBeneficios(categoria, {
              ...beneficios,
              fixo: { ...beneficios.fixo, ativo },
            }),
          <input
            type="number"
            placeholder="Valor (R$)"
            value={beneficios.fixo.valor || ''}
            onChange={(e) =>
              atualizarBeneficios(categoria, {
                ...beneficios,
                fixo: { ...beneficios.fixo, valor: parseFloat(e.target.value) || 0 },
              })
            }
            className={`w-full ${INPUT_CLS}`}
          />
        )}

        {renderLinhaBeneficio(
          categoria,
          'extra',
          'extra',
          ROTULOS_BENEFICIO.extra,
          beneficios.extra.ativo,
          (ativo) =>
            atualizarBeneficios(categoria, {
              ...beneficios,
              extra: { ...beneficios.extra, ativo },
            }),
          <textarea
            placeholder="Descreva o benefício extra…"
            value={beneficios.extra.texto}
            onChange={(e) =>
              atualizarBeneficios(categoria, {
                ...beneficios,
                extra: { ...beneficios.extra, texto: e.target.value },
              })
            }
            className={`w-full ${INPUT_CLS}`}
            rows={2}
          />
        )}

        <div className="rounded-lg bg-gray-50 p-3">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id={`${categoria}-tempo`}
              checked={form.porTempoLimitado}
              onChange={(e) =>
                atualizarFormulario(categoria, {
                  porTempoLimitado: e.target.checked,
                  validade: e.target.checked ? form.validade : '',
                })
              }
            />
            <label htmlFor={`${categoria}-tempo`} className="text-sm font-medium text-gray-800">
              por tempo limitado?
            </label>
          </div>
          {form.porTempoLimitado ? (
            <input
              type="date"
              value={form.validade}
              onChange={(e) => atualizarFormulario(categoria, { validade: e.target.value })}
              className={`mt-2 w-full ${INPUT_CLS}`}
              aria-label="Data limite da oferta"
            />
          ) : (
            <p className="mt-2 text-xs text-gray-500">Opcional — a oferta permanece sem data de expiração.</p>
          )}
        </div>

        <button
          type="button"
          disabled={salvando === categoria}
          onClick={() => handleSubmit(categoria)}
          className="w-full rounded-xl bg-[#0097b2] py-2.5 text-sm font-bold text-white transition hover:bg-[#008199] disabled:opacity-60"
        >
          {salvando === categoria ? 'Cadastrando…' : 'Cadastrar'}
        </button>
      </div>
    )
  }

  if (!empresaId) {
    return (
      <div className="py-10 text-center text-sm text-gray-500">
        Empresa não encontrada. Volte ao perfil e tente novamente.
      </div>
    )
  }

  return (
    <div>
      <div className="-mx-4 flex border-b border-gray-200 bg-white px-0 sm:mx-0" role="tablist" aria-label="Cadastrar comissão">
        <button type="button" role="tab" aria-selected={aba === 'comissao'} className={abaCls(aba === 'comissao')} onClick={() => setAba('comissao')}>
          Comissão
        </button>
        <button type="button" role="tab" aria-selected={aba === 'historico'} className={abaCls(aba === 'historico')} onClick={() => setAba('historico')}>
          Histórico
        </button>
      </div>

      {msg ? <p className="mt-4 text-sm text-[#0097b2]">{msg}</p> : null}

      {aba === 'comissao' ? (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Comunidades</p>
          {COMUNIDADES.map(({ label, iconeKey }) => {
            const aberta = comunidadesAbertas[label]
            const ofertaAtiva = ofertasAtivasPorComunidade.get(label)
            const statusAtivo = ofertaAtiva ? String(ofertaAtiva.status ?? 'pendente') : null
            return (
              <div key={label} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                <button
                  type="button"
                  onClick={() => toggleComunidade(label)}
                  className="flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-gray-50"
                  aria-expanded={aberta}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-[#0097b2]">
                    <ModoApresentacaoIcon iconeKey={iconeKey} className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-gray-900">{label}</span>
                    {statusAtivo ? (
                      <span
                        className={`text-[11px] font-semibold ${classeStatusOferta(statusAtivo)}`}
                      >
                        {rotuloStatusOferta(statusAtivo)}
                      </span>
                    ) : null}
                  </span>
                  {aberta ? (
                    <ChevronUp className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
                  )}
                </button>
                {aberta ? <div className="px-3 pb-3">{renderBeneficios(label)}</div> : null}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {carregando ? (
            <p className="text-center text-sm text-gray-500">Carregando histórico…</p>
          ) : ofertas.length === 0 ? (
            <div className="rounded-lg bg-gray-50 p-6 text-center text-sm text-gray-500">Nenhuma oferta cadastrada ainda.</div>
          ) : (
            <ul className="space-y-3">
              {ofertas.map((oferta) => {
                const raw = oferta.beneficios
                const b =
                  raw && typeof raw === 'object' && !Array.isArray(raw)
                    ? (raw as Record<string, { ativo?: boolean; valor?: number; texto?: string }>)
                    : {}
                const itensBeneficio = listarBeneficiosOferta(b)
                const categoria = String(oferta.categoria_profissional ?? '')
                const iconeKey = ICONE_POR_CATEGORIA[categoria] ?? 'profissional'
                const ofertaId = String(oferta.id ?? '')
                const status = String(oferta.status ?? 'pendente')
                const dia = oferta.created_at
                  ? new Date(String(oferta.created_at)).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })
                  : '—'
                const hora = oferta.created_at
                  ? new Date(String(oferta.created_at)).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : ''
                const validadeTxt = textoValidadeOferta(oferta)
                const statusExpandido = historicoStatusAberto.has(ofertaId)
                const podeRemover = ofertaPodeSerRemovidaPelaEmpresa(status)
                const removendo = removendoOfertaId === ofertaId

                return (
                  <li key={ofertaId} className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-xs font-medium text-gray-500">{dia}</span>
                      {hora ? <span className="text-xs text-gray-400">{hora}</span> : null}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-[#0097b2]">
                        <ModoApresentacaoIcon iconeKey={iconeKey} className="h-4 w-4" />
                      </span>
                      <span className="font-bold text-[#001f3f]">{categoria}</span>
                    </div>
                    {itensBeneficio.length === 0 ? (
                      <p className="mt-2 text-sm text-gray-500">Nenhum benefício informado</p>
                    ) : (
                      <ul className="mt-2 space-y-1.5">
                        {itensBeneficio.map((item) => (
                          <li
                            key={`${ofertaId}-${item.label}`}
                            className="flex flex-wrap items-baseline gap-x-2 text-sm text-gray-700"
                          >
                            <span className="font-semibold text-gray-800">{item.label}:</span>
                            <span>{item.valor}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {validadeTxt ? <p className="mt-2 text-xs text-amber-700">{validadeTxt}</p> : null}
                    <div className="mt-3 border-t border-gray-100 pt-2">
                      <button
                        type="button"
                        onClick={() => toggleHistoricoStatus(ofertaId)}
                        className="flex w-full items-center justify-between gap-2 text-left"
                        aria-expanded={statusExpandido}
                      >
                        <span className="text-xs text-gray-500">
                          Status:{' '}
                          <span className={`font-semibold ${classeStatusOferta(status)}`}>
                            {rotuloStatusOferta(status)}
                          </span>
                        </span>
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${
                            statusExpandido ? 'rotate-180' : ''
                          }`}
                          aria-hidden
                        />
                      </button>
                      {statusExpandido ? (
                        <div className="mt-2 pl-1">
                          {podeRemover ? (
                            <button
                              type="button"
                              disabled={removendo}
                              onClick={() => void removerOferta(ofertaId)}
                              className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                            >
                              {removendo ? 'Removendo…' : 'Remover'}
                            </button>
                          ) : (
                            <p className="text-xs text-gray-500">
                              Esta oferta já foi removida e não é exibida aos profissionais.
                            </p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {substituicaoPendente ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="substituir-oferta-titulo"
        >
          <div className="w-full max-w-sm rounded-2xl bg-[#001f3f] p-5 text-white shadow-xl">
            <h2 id="substituir-oferta-titulo" className="text-base font-bold text-white">
              Substituir oferta ativa?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white">
              A oferta ativa de <strong>{substituicaoPendente.categoria}</strong> no momento mudará de status para{' '}
              <strong>Removido</strong>. Deseja substituir e enviar esta nova proposta para análise?
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={salvando === substituicaoPendente.categoria}
                onClick={() => setSubstituicaoPendente(null)}
                className="flex-1 rounded-xl border border-white py-2.5 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
              >
                Não
              </button>
              <button
                type="button"
                disabled={salvando === substituicaoPendente.categoria}
                onClick={() =>
                  void executarCadastro(
                    substituicaoPendente.categoria,
                    substituicaoPendente.ofertaAtivaId
                  )
                }
                className="flex-1 rounded-xl border border-white bg-green-600 py-2.5 text-sm font-bold text-white hover:bg-green-500 disabled:opacity-60"
              >
                {salvando === substituicaoPendente.categoria ? 'Salvando…' : 'Sim'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
