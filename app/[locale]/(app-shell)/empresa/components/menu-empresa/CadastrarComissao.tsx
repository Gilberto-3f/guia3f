'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import ModoApresentacaoIcon from '@/components/ModoApresentacaoIcon'
import { useDashboardEmpresa } from '@/app/[locale]/(app-shell)/dashboard/empresa/hooks/useDashboardEmpresa'
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

function resumoBeneficios(b: Record<string, { ativo?: boolean; valor?: number; texto?: string }>) {
  const partes: string[] = []
  if (b.pax?.ativo) partes.push(`PAX: R$ ${b.pax.valor ?? 0}`)
  if (b.percentual?.ativo) partes.push(`% venda: ${b.percentual.valor ?? 0}%`)
  if (b.fixo?.ativo) partes.push(`Indicação: R$ ${b.fixo.valor ?? 0}`)
  if (b.extra?.ativo && b.extra.texto) partes.push(`Extra: ${String(b.extra.texto).slice(0, 80)}`)
  return partes.length ? partes.join(' · ') : 'Nenhum benefício informado'
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

  const handleSubmit = async (categoria: ComunidadeLabel) => {
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

    setMsg(null)
    setSalvando(categoria)

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
      setMsg(error.message)
      return
    }

    setFormularios((p) => ({ ...p, [categoria]: criarFormularioVazio() }))
    setComunidadesAbertas((p) => ({ ...p, [categoria]: false }))
    setMsg(`Oferta cadastrada para ${categoria}.`)
    void carregar()
  }

  const renderBeneficios = (categoria: ComunidadeLabel) => {
    const form = formularios[categoria]
    const beneficios = form.beneficios

    return (
      <div className="space-y-3 border-t border-gray-100 pt-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="checkbox"
            id={`${categoria}-pax`}
            checked={beneficios.pax.ativo}
            onChange={(e) =>
              atualizarBeneficios(categoria, {
                ...beneficios,
                pax: { ...beneficios.pax, ativo: e.target.checked },
              })
            }
          />
          <label htmlFor={`${categoria}-pax`} className="text-sm text-gray-700">
            PAX (por cliente)
          </label>
          {beneficios.pax.ativo ? (
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
              className={`w-32 ${INPUT_CLS}`}
            />
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="checkbox"
            id={`${categoria}-pct`}
            checked={beneficios.percentual.ativo}
            onChange={(e) =>
              atualizarBeneficios(categoria, {
                ...beneficios,
                percentual: { ...beneficios.percentual, ativo: e.target.checked },
              })
            }
          />
          <label htmlFor={`${categoria}-pct`} className="text-sm text-gray-700">
            % sobre venda
          </label>
          {beneficios.percentual.ativo ? (
            <input
              type="number"
              placeholder="%"
              value={beneficios.percentual.valor || ''}
              onChange={(e) =>
                atualizarBeneficios(categoria, {
                  ...beneficios,
                  percentual: { ...beneficios.percentual, valor: parseFloat(e.target.value) || 0 },
                })
              }
              className={`w-32 ${INPUT_CLS}`}
            />
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="checkbox"
            id={`${categoria}-fixo`}
            checked={beneficios.fixo.ativo}
            onChange={(e) =>
              atualizarBeneficios(categoria, {
                ...beneficios,
                fixo: { ...beneficios.fixo, ativo: e.target.checked },
              })
            }
          />
          <label htmlFor={`${categoria}-fixo`} className="text-sm text-gray-700">
            Valor fixo por indicação
          </label>
          {beneficios.fixo.ativo ? (
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
              className={`w-32 ${INPUT_CLS}`}
            />
          ) : null}
        </div>

        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id={`${categoria}-extra`}
            checked={beneficios.extra.ativo}
            onChange={(e) =>
              atualizarBeneficios(categoria, {
                ...beneficios,
                extra: { ...beneficios.extra, ativo: e.target.checked },
              })
            }
            className="mt-2"
          />
          <div className="flex-1">
            <label htmlFor={`${categoria}-extra`} className="text-sm text-gray-700">
              Benefício extra
            </label>
            {beneficios.extra.ativo ? (
              <textarea
                placeholder="Descreva o benefício extra…"
                value={beneficios.extra.texto}
                onChange={(e) =>
                  atualizarBeneficios(categoria, {
                    ...beneficios,
                    extra: { ...beneficios.extra, texto: e.target.value },
                  })
                }
                className={`mt-1 w-full ${INPUT_CLS}`}
                rows={2}
              />
            ) : null}
          </div>
        </div>

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
          onClick={() => void handleSubmit(categoria)}
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
                  <span className="min-w-0 flex-1 text-sm font-semibold text-gray-900">{label}</span>
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
                const categoria = String(oferta.categoria_profissional ?? '')
                const iconeKey = ICONE_POR_CATEGORIA[categoria] ?? 'profissional'
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

                return (
                  <li key={String(oferta.id)} className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
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
                    <p className="mt-1 text-sm text-gray-600">{resumoBeneficios(b)}</p>
                    {validadeTxt ? <p className="mt-1 text-xs text-amber-700">{validadeTxt}</p> : null}
                    <p className="mt-2 text-xs text-gray-400 capitalize">Status: {String(oferta.status ?? 'pendente')}</p>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
