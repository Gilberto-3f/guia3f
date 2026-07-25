'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Coins, CreditCard, Home } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  COR_VERDE_BOTAO,
  MOEDAS_DINHEIRO,
  formasPagamentoVazio,
  parseFormasPagamento,
  validarFormasPagamento,
  type FormasPagamentoHospedagem,
} from '@/lib/hospedagemAcomodacoesCatalogo'
import {
  FLAG_MOEDA_PADRAO,
  LABEL_MOEDA_PADRAO,
  MOEDAS_PADRAO_LOJA,
  normalizarMoedaPadrao,
  type MoedaPadraoLoja,
} from '@/lib/comprasCdeMoedaPadrao'
import ChevronPasta from './ChevronPasta'
import FeedbackHospedagemAjustes from './FeedbackHospedagemAjustes'

const COR = '#0097b2'

type Props = {
  empresaId: string
  moedaPadraoInicial?: string | null
  onSalvo?: () => void
}

type FormPoliticas = {
  checkin_hora: string
  checkout_hora: string
  caucao_exige: boolean | null
  caucao_diarias: string
  cancelamento_gratuito: boolean | null
  cancelamento_dias_antes: string
  cancelamento_descricao: string
  restricao_idade: boolean | null
  restricao_idade_obs: string
  formas_pagamento: FormasPagamentoHospedagem
}

function formVazio(): FormPoliticas {
  return {
    checkin_hora: '',
    checkout_hora: '',
    caucao_exige: null,
    caucao_diarias: '',
    cancelamento_gratuito: null,
    cancelamento_dias_antes: '',
    cancelamento_descricao: '',
    restricao_idade: null,
    restricao_idade_obs: '',
    formas_pagamento: formasPagamentoVazio(),
  }
}

function validarPoliticasCasa(form: FormPoliticas): string | null {
  if (!form.checkin_hora) return 'Informe o horário de check-in.'
  if (!form.checkout_hora) return 'Informe o horário de check-out.'
  if (form.caucao_exige === null) return 'Informe se exige caução.'
  if (form.caucao_exige) {
    const n = Number(form.caucao_diarias)
    if (!Number.isFinite(n) || n < 1) return 'Informe para quantas diárias é o adiantamento.'
  }
  if (form.cancelamento_gratuito === null) return 'Informe se o cancelamento é gratuito.'
  if (!String(form.cancelamento_descricao).trim()) {
    return 'Descreva a política de cancelamento.'
  }
  if (form.cancelamento_gratuito) {
    const d = Number(form.cancelamento_dias_antes)
    if (!Number.isFinite(d) || d < 0) {
      return 'Informe com quantos dias de antecedência pode cancelar.'
    }
  }
  if (form.restricao_idade === null) {
    return 'Informe se há restrição de idade / comprovante para menores.'
  }
  return null
}

function SimNao({
  value,
  onChange,
}: {
  value: boolean | null
  onChange: (v: boolean) => void
}) {
  return (
    <div className="mt-1.5 flex gap-2">
      {[
        { v: true, label: 'Sim' },
        { v: false, label: 'Não' },
      ].map((op) => (
        <button
          key={String(op.v)}
          type="button"
          onClick={() => onChange(op.v)}
          className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${
            value === op.v
              ? 'border-[#0097b2] bg-[#0097b2] text-white'
              : 'border-gray-200 bg-white text-gray-700'
          }`}
        >
          {op.label}
        </button>
      ))}
    </div>
  )
}

function toggleInList(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value]
}

function msgOk(m: string) {
  return m.includes('sucesso') || m.includes('salvo') || m.includes('Salvo') || m.includes('salva')
}

function payloadPoliticas(empresaId: string, form: FormPoliticas) {
  return {
    empresa_id: empresaId,
    checkin_hora: form.checkin_hora,
    checkout_hora: form.checkout_hora,
    caucao_exige: Boolean(form.caucao_exige),
    caucao_diarias: form.caucao_exige ? Math.max(1, Math.floor(Number(form.caucao_diarias))) : null,
    cancelamento_gratuito: Boolean(form.cancelamento_gratuito),
    cancelamento_dias_antes: form.cancelamento_gratuito
      ? Math.max(0, Math.floor(Number(form.cancelamento_dias_antes)))
      : form.cancelamento_dias_antes.trim()
        ? Math.max(0, Math.floor(Number(form.cancelamento_dias_antes)))
        : null,
    cancelamento_descricao: form.cancelamento_descricao.trim(),
    restricao_idade: Boolean(form.restricao_idade),
    restricao_idade_obs: form.restricao_idade_obs.trim() || null,
    formas_pagamento: form.formas_pagamento,
  }
}

/**
 * Aba AJUSTES do botão dinâmico (hospedagem): Feedback, moeda, políticas e pagamento.
 */
export default function AbaInformacoes({
  empresaId,
  moedaPadraoInicial = 'BRL',
  onSalvo,
}: Props) {
  const [form, setForm] = useState<FormPoliticas>(formVazio())
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [moedaPadrao, setMoedaPadrao] = useState<MoedaPadraoLoja>(() =>
    normalizarMoedaPadrao(moedaPadraoInicial),
  )
  const [salvandoMoeda, setSalvandoMoeda] = useState(false)
  const [salvandoPoliticas, setSalvandoPoliticas] = useState(false)
  const [salvandoPagamento, setSalvandoPagamento] = useState(false)
  const [msgMoeda, setMsgMoeda] = useState<string | null>(null)
  const [msgPoliticas, setMsgPoliticas] = useState<string | null>(null)
  const [msgPagamento, setMsgPagamento] = useState<string | null>(null)

  const [moedaAberta, setMoedaAberta] = useState(false)
  /** Pastas de políticas/pagamento iniciam fechadas (pedido Fase 2). */
  const [abertos, setAbertos] = useState({ politicas: false, pagamento: false })

  useEffect(() => {
    setMoedaPadrao(normalizarMoedaPadrao(moedaPadraoInicial))
  }, [moedaPadraoInicial])

  const carregar = useCallback(async () => {
    if (!empresaId) return
    setCarregando(true)
    try {
      const { data, error } = await supabase
        .from('hospedagem_politicas')
        .select('*')
        .eq('empresa_id', empresaId)
        .maybeSingle()
      if (error) throw error
      if (!data) {
        setForm(formVazio())
        setErro(null)
        return
      }
      const checkin =
        typeof data.checkin_hora === 'string'
          ? data.checkin_hora.slice(0, 5)
          : String(data.checkin_hora ?? '').slice(0, 5)
      const checkout =
        typeof data.checkout_hora === 'string'
          ? data.checkout_hora.slice(0, 5)
          : String(data.checkout_hora ?? '').slice(0, 5)
      setForm({
        checkin_hora: checkin,
        checkout_hora: checkout,
        caucao_exige: Boolean(data.caucao_exige),
        caucao_diarias: data.caucao_diarias != null ? String(data.caucao_diarias) : '',
        cancelamento_gratuito: Boolean(data.cancelamento_gratuito),
        cancelamento_dias_antes:
          data.cancelamento_dias_antes != null ? String(data.cancelamento_dias_antes) : '',
        cancelamento_descricao: String(data.cancelamento_descricao ?? ''),
        restricao_idade: Boolean(data.restricao_idade),
        restricao_idade_obs: data.restricao_idade_obs != null ? String(data.restricao_idade_obs) : '',
        formas_pagamento: parseFormasPagamento(data.formas_pagamento),
      })
      setErro(null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar informações.')
    } finally {
      setCarregando(false)
    }
  }, [empresaId])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const patch = (partial: Partial<FormPoliticas>) => setForm((f) => ({ ...f, ...partial }))

  const salvarMoeda = async () => {
    setSalvandoMoeda(true)
    setMsgMoeda(null)
    try {
      const { error } = await supabase
        .from('empresas')
        .update({ moeda_padrao: moedaPadrao })
        .eq('id', empresaId)
      if (error) throw error
      setMsgMoeda('Salvo com sucesso!')
      onSalvo?.()
      window.dispatchEvent(new Event('perfil-atualizado'))
    } catch (e) {
      setMsgMoeda(e instanceof Error ? e.message : 'Não foi possível salvar a moeda.')
    } finally {
      setSalvandoMoeda(false)
    }
  }

  const salvarPoliticas = async () => {
    const validacao = validarPoliticasCasa(form)
    if (validacao) {
      setMsgPoliticas(validacao)
      return
    }
    setSalvandoPoliticas(true)
    setMsgPoliticas(null)
    try {
      const { error } = await supabase
        .from('hospedagem_politicas')
        .upsert(payloadPoliticas(empresaId, form), { onConflict: 'empresa_id' })
      if (error) throw error
      setMsgPoliticas('Salvo com sucesso!')
      await carregar()
    } catch (e) {
      setMsgPoliticas(e instanceof Error ? e.message : 'Não foi possível salvar.')
    } finally {
      setSalvandoPoliticas(false)
    }
  }

  const salvarPagamento = async () => {
    const errPag = validarFormasPagamento(form.formas_pagamento)
    if (errPag) {
      setMsgPagamento(errPag)
      return
    }
    // checkin/checkout são NOT NULL no banco — exige políticas mínimas no upsert.
    const casaErr = validarPoliticasCasa(form)
    if (casaErr) {
      setMsgPagamento('Salve as Políticas da casa antes (check-in/out e demais campos obrigatórios).')
      return
    }
    setSalvandoPagamento(true)
    setMsgPagamento(null)
    try {
      const { error } = await supabase
        .from('hospedagem_politicas')
        .upsert(payloadPoliticas(empresaId, form), { onConflict: 'empresa_id' })
      if (error) throw error
      setMsgPagamento('Salvo com sucesso!')
      await carregar()
    } catch (e) {
      setMsgPagamento(e instanceof Error ? e.message : 'Não foi possível salvar.')
    } finally {
      setSalvandoPagamento(false)
    }
  }

  const inputCls =
    'mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#0097b2]'
  const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-gray-500'
  const fp = form.formas_pagamento

  if (carregando) {
    return <p className="text-sm text-gray-500">Carregando ajustes…</p>
  }

  return (
    <div className="space-y-4">
      {erro ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{erro}</p>
      ) : null}

      <FeedbackHospedagemAjustes empresaId={empresaId} abertoInicial={false} />

      <ChevronPasta
        titulo="Moeda padrão"
        aberto={moedaAberta}
        onToggle={() => setMoedaAberta((v) => !v)}
        icone={Coins}
        corTitulo={COR}
      >
        <div className="space-y-3 px-1 pb-1">
          <p className="text-xs text-gray-500">
            Moeda principal dos preços das diárias no cadastro e no drawer de reservas.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {MOEDAS_PADRAO_LOJA.map((m) => {
              const ativo = moedaPadrao === m
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMoedaPadrao(m)
                    setMsgMoeda(null)
                  }}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                    ativo
                      ? 'border-[#0097b2] bg-[#0097b2]/10 text-[#0097b2]'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                  aria-pressed={ativo}
                >
                  <span className="text-base leading-none" aria-hidden>
                    {FLAG_MOEDA_PADRAO[m]}
                  </span>
                  {LABEL_MOEDA_PADRAO[m]}
                </button>
              )
            })}
          </div>
          <button
            type="button"
            onClick={() => void salvarMoeda()}
            disabled={salvandoMoeda}
            className="w-full rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: COR_VERDE_BOTAO }}
          >
            {salvandoMoeda ? 'Salvando…' : 'SALVAR'}
          </button>
          {msgMoeda ? (
            <p className={`text-sm font-medium ${msgOk(msgMoeda) ? 'text-emerald-700' : 'text-rose-600'}`}>
              {msgMoeda}
            </p>
          ) : null}
        </div>
      </ChevronPasta>

      <ChevronPasta
        titulo="Políticas da casa"
        aberto={abertos.politicas}
        onToggle={() => setAbertos((a) => ({ ...a, politicas: !a.politicas }))}
        icone={Home}
        corTitulo={COR}
      >
        <div className="space-y-4 px-1 pb-1">
          <div className="grid grid-cols-2 gap-3">
            <label className={labelCls}>
              Check-in
              <input
                type="time"
                value={form.checkin_hora}
                onChange={(e) => {
                  patch({ checkin_hora: e.target.value })
                  setMsgPoliticas(null)
                }}
                className={inputCls}
              />
            </label>
            <label className={labelCls}>
              Check-out
              <input
                type="time"
                value={form.checkout_hora}
                onChange={(e) => {
                  patch({ checkout_hora: e.target.value })
                  setMsgPoliticas(null)
                }}
                className={inputCls}
              />
            </label>
          </div>

          <div>
            <p className={labelCls}>Caução — exige adiantamento na pré-reserva?</p>
            <SimNao
              value={form.caucao_exige}
              onChange={(v) => {
                patch({ caucao_exige: v })
                setMsgPoliticas(null)
              }}
            />
            {form.caucao_exige === true ? (
              <label className={`${labelCls} mt-2`}>
                Pagamento para quantas diárias?
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={form.caucao_diarias}
                  onChange={(e) => {
                    patch({ caucao_diarias: e.target.value })
                    setMsgPoliticas(null)
                  }}
                  className={inputCls}
                />
              </label>
            ) : null}
          </div>

          <div>
            <p className={labelCls}>Política de cancelamento — gratuito?</p>
            <SimNao
              value={form.cancelamento_gratuito}
              onChange={(v) => {
                patch({ cancelamento_gratuito: v })
                setMsgPoliticas(null)
              }}
            />
            {form.cancelamento_gratuito === true ? (
              <label className={`${labelCls} mt-2`}>
                Pode cancelar quantos dias antes?
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={form.cancelamento_dias_antes}
                  onChange={(e) => {
                    patch({ cancelamento_dias_antes: e.target.value })
                    setMsgPoliticas(null)
                  }}
                  className={inputCls}
                />
              </label>
            ) : null}
            <label className={`${labelCls} mt-2`}>
              Descrição da política
              <textarea
                rows={3}
                value={form.cancelamento_descricao}
                onChange={(e) => {
                  patch({ cancelamento_descricao: e.target.value })
                  setMsgPoliticas(null)
                }}
                className={inputCls}
                placeholder="Descreva as regras de cancelamento"
              />
            </label>
          </div>

          <div>
            <p className={labelCls}>Restrição de idade — comprovante para hóspedes menores?</p>
            <SimNao
              value={form.restricao_idade}
              onChange={(v) => {
                patch({ restricao_idade: v })
                setMsgPoliticas(null)
              }}
            />
            <label className={`${labelCls} mt-2`}>
              Observação (opcional)
              <input
                type="text"
                value={form.restricao_idade_obs}
                onChange={(e) => {
                  patch({ restricao_idade_obs: e.target.value })
                  setMsgPoliticas(null)
                }}
                className={inputCls}
              />
            </label>
          </div>

          <button
            type="button"
            onClick={() => void salvarPoliticas()}
            disabled={salvandoPoliticas || !empresaId}
            className="w-full rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: COR_VERDE_BOTAO }}
          >
            {salvandoPoliticas ? 'Salvando…' : 'SALVAR'}
          </button>
          {msgPoliticas ? (
            <p
              className={`text-sm font-medium ${msgOk(msgPoliticas) ? 'text-emerald-700' : 'text-rose-600'}`}
            >
              {msgPoliticas}
            </p>
          ) : null}
        </div>
      </ChevronPasta>

      <ChevronPasta
        titulo="Forma de pagamento"
        aberto={abertos.pagamento}
        onToggle={() => setAbertos((a) => ({ ...a, pagamento: !a.pagamento }))}
        icone={CreditCard}
        corTitulo={COR}
      >
        <div className="space-y-3 px-1 pb-1">
          <ul className="space-y-2">
            {(
              [
                { key: 'dinheiro' as const, label: 'Dinheiro' },
                { key: 'pix' as const, label: 'PIX' },
                { key: 'cartao_credito' as const, label: 'Cartão de Crédito' },
                { key: 'cartao_debito' as const, label: 'Cartão de Débito' },
              ] as const
            ).map((op) => {
              const ativo = Boolean(fp[op.key])
              return (
                <li key={op.key}>
                  <button
                    type="button"
                    onClick={() => {
                      patch({
                        formas_pagamento: { ...fp, [op.key]: !ativo },
                      })
                      setMsgPagamento(null)
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm ${
                      ativo ? 'border-[#0097b2] bg-[#0097b2]/10' : 'border-gray-200'
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded border ${
                        ativo ? 'border-[#0097b2] bg-[#0097b2]' : 'border-gray-300'
                      }`}
                    >
                      {ativo ? <Check className="h-2.5 w-2.5 text-white" aria-hidden /> : null}
                    </span>
                    {op.label}
                  </button>
                  {op.key === 'dinheiro' && fp.dinheiro ? (
                    <ul className="mt-2 ml-6 space-y-1.5">
                      {MOEDAS_DINHEIRO.map((m) => {
                        const mAtivo = fp.moedas.includes(m.value)
                        return (
                          <li key={m.value}>
                            <button
                              type="button"
                              onClick={() => {
                                patch({
                                  formas_pagamento: {
                                    ...fp,
                                    moedas: toggleInList(fp.moedas, m.value),
                                  },
                                })
                                setMsgPagamento(null)
                              }}
                              className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs ${
                                mAtivo ? 'border-[#0097b2] bg-[#0097b2]/10' : 'border-gray-200'
                              }`}
                            >
                              <span
                                className={`flex h-3.5 w-3.5 items-center justify-center rounded border ${
                                  mAtivo ? 'border-[#0097b2] bg-[#0097b2]' : 'border-gray-300'
                                }`}
                              >
                                {mAtivo ? (
                                  <Check className="h-2 w-2 text-white" aria-hidden />
                                ) : null}
                              </span>
                              {m.label}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  ) : null}
                </li>
              )
            })}
          </ul>
          <button
            type="button"
            onClick={() => void salvarPagamento()}
            disabled={salvandoPagamento || !empresaId}
            className="w-full rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: COR_VERDE_BOTAO }}
          >
            {salvandoPagamento ? 'Salvando…' : 'SALVAR'}
          </button>
          {msgPagamento ? (
            <p
              className={`text-sm font-medium ${msgOk(msgPagamento) ? 'text-emerald-700' : 'text-rose-600'}`}
            >
              {msgPagamento}
            </p>
          ) : null}
        </div>
      </ChevronPasta>
    </div>
  )
}
