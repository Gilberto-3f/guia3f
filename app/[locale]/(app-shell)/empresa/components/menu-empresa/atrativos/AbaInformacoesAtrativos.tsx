'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Coins, CreditCard, Link2, MessageCircle, Ticket } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  COR_VERDE_BOTAO,
  formasPagamentoVazio,
  parseFormasPagamento,
  validarFormasPagamento,
  type FormasPagamentoHospedagem,
} from '@/lib/atrativosCatalogo'
import { MOEDAS_DINHEIRO } from '@/lib/hospedagemAcomodacoesCatalogo'
import {
  FLAG_MOEDA_PADRAO,
  LABEL_MOEDA_PADRAO,
  MOEDAS_PADRAO_LOJA,
  normalizarMoedaPadrao,
  type MoedaPadraoLoja,
} from '@/lib/comprasCdeMoedaPadrao'
import ChevronPasta from '../hospedagem/ChevronPasta'
import FeedbackAtrativosAjustes from './FeedbackAtrativosAjustes'

const COR = '#0097b2'

type Props = {
  empresaId: string
  whatsappGeral: string | null
  whatsappComercialInicial: string | null
  moedaPadraoInicial?: string | null
  onSalvo?: () => void
}

type FormPoliticas = {
  formas_pagamento: FormasPagamentoHospedagem
  regras_meia_entrada: string
}

function formVazio(): FormPoliticas {
  return {
    formas_pagamento: formasPagamentoVazio(),
    regras_meia_entrada: '',
  }
}

function toggleInList(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value]
}

function msgOk(m: string) {
  return m.includes('sucesso') || m.includes('salvo') || m.includes('Salvo') || m.includes('salva')
}

/**
 * Aba AJUSTES do botão dinâmico (atrativos): Feedback, moeda, WhatsApp, pagamento e meia-entrada.
 */
export default function AbaInformacoesAtrativos({
  empresaId,
  whatsappGeral,
  whatsappComercialInicial,
  moedaPadraoInicial = 'BRL',
  onSalvo,
}: Props) {
  const [form, setForm] = useState<FormPoliticas>(formVazio())
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [whatsappComercial, setWhatsappComercial] = useState(whatsappComercialInicial ?? '')
  const [moedaPadrao, setMoedaPadrao] = useState<MoedaPadraoLoja>(() =>
    normalizarMoedaPadrao(moedaPadraoInicial),
  )
  const [salvandoWhatsapp, setSalvandoWhatsapp] = useState(false)
  const [salvandoMoeda, setSalvandoMoeda] = useState(false)
  const [salvandoPagamento, setSalvandoPagamento] = useState(false)
  const [salvandoMeia, setSalvandoMeia] = useState(false)
  const [msgWhatsapp, setMsgWhatsapp] = useState<string | null>(null)
  const [msgMoeda, setMsgMoeda] = useState<string | null>(null)
  const [msgPagamento, setMsgPagamento] = useState<string | null>(null)
  const [msgMeia, setMsgMeia] = useState<string | null>(null)

  const [moedaAberta, setMoedaAberta] = useState(false)
  const [whatsappAberto, setWhatsappAberto] = useState(false)
  const [abertos, setAbertos] = useState({ pagamento: false, meia: false })

  useEffect(() => {
    setWhatsappComercial(whatsappComercialInicial ?? '')
  }, [whatsappComercialInicial])

  useEffect(() => {
    setMoedaPadrao(normalizarMoedaPadrao(moedaPadraoInicial))
  }, [moedaPadraoInicial])

  const carregar = useCallback(async () => {
    if (!empresaId) return
    setCarregando(true)
    try {
      const { data, error } = await supabase
        .from('atrativos_politicas')
        .select('*')
        .eq('empresa_id', empresaId)
        .maybeSingle()
      if (error) throw error
      if (data) {
        setForm({
          formas_pagamento: parseFormasPagamento(data.formas_pagamento),
          regras_meia_entrada: String(data.regras_meia_entrada ?? ''),
        })
      } else {
        setForm(formVazio())
      }
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

  const salvarWhatsapp = async () => {
    const valor = whatsappComercial.trim()
    if (!valor) {
      setMsgWhatsapp('Informe o WhatsApp de atendimento.')
      return
    }
    setSalvandoWhatsapp(true)
    setMsgWhatsapp(null)
    try {
      const { error } = await supabase
        .from('empresas')
        .update({ whatsapp_comercial: valor })
        .eq('id', empresaId)
      if (error) throw error
      setMsgWhatsapp('Salvo com sucesso!')
      onSalvo?.()
      window.dispatchEvent(new Event('perfil-atualizado'))
    } catch (e) {
      setMsgWhatsapp(e instanceof Error ? e.message : 'Não foi possível salvar.')
    } finally {
      setSalvandoWhatsapp(false)
    }
  }

  const sincronizarComGeral = () => {
    const g = String(whatsappGeral ?? '').trim()
    if (!g) {
      setMsgWhatsapp('Não há WhatsApp geral cadastrado na página da empresa.')
      return
    }
    setWhatsappComercial(g)
    setMsgWhatsapp(null)
  }

  const salvarPagamento = async () => {
    const errPag = validarFormasPagamento(form.formas_pagamento)
    if (errPag) {
      setMsgPagamento(errPag)
      return
    }
    setSalvandoPagamento(true)
    setMsgPagamento(null)
    try {
      const { error } = await supabase.from('atrativos_politicas').upsert(
        {
          empresa_id: empresaId,
          formas_pagamento: form.formas_pagamento,
          regras_meia_entrada: form.regras_meia_entrada.trim(),
        },
        { onConflict: 'empresa_id' },
      )
      if (error) throw error
      setMsgPagamento('Salvo com sucesso!')
    } catch (e) {
      setMsgPagamento(e instanceof Error ? e.message : 'Não foi possível salvar.')
    } finally {
      setSalvandoPagamento(false)
    }
  }

  const salvarMeia = async () => {
    setSalvandoMeia(true)
    setMsgMeia(null)
    try {
      const { error } = await supabase.from('atrativos_politicas').upsert(
        {
          empresa_id: empresaId,
          formas_pagamento: form.formas_pagamento,
          regras_meia_entrada: form.regras_meia_entrada.trim(),
        },
        { onConflict: 'empresa_id' },
      )
      if (error) throw error
      setMsgMeia('Salvo com sucesso!')
    } catch (e) {
      setMsgMeia(e instanceof Error ? e.message : 'Não foi possível salvar.')
    } finally {
      setSalvandoMeia(false)
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

      <FeedbackAtrativosAjustes empresaId={empresaId} abertoInicial={false} rotuloBotaoDinamico="TICKETS" />

      <ChevronPasta
        titulo="Moeda padrão"
        aberto={moedaAberta}
        onToggle={() => setMoedaAberta((v) => !v)}
        icone={Coins}
        corTitulo={COR}
      >
        <div className="space-y-3 px-1 pb-1">
          <p className="text-xs text-gray-500">
            Moeda principal dos preços dos tickets no cadastro e no drawer. O visitante vê conversões
            nas demais moedas quando aplicável.
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
        titulo="WhatsApp"
        aberto={whatsappAberto}
        onToggle={() => setWhatsappAberto((v) => !v)}
        icone={MessageCircle}
        corTitulo={COR}
      >
        <div className="space-y-3 px-1 pb-1">
          <p className="text-xs text-gray-500">
            Número de atendimento usado na pasta Ver Mais do drawer dos atrativos. Não substitui o
            WhatsApp geral da página.
          </p>
          <label className={labelCls}>
            Número *
            <input
              type="tel"
              value={whatsappComercial}
              onChange={(e) => {
                setWhatsappComercial(e.target.value)
                setMsgWhatsapp(null)
              }}
              placeholder="55 45 99999-9999"
              className={inputCls}
            />
          </label>
          <button
            type="button"
            onClick={sincronizarComGeral}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#0097b2]/40 bg-[#0097b2]/5 py-2 text-xs font-semibold text-[#0097b2]"
          >
            <Link2 className="h-4 w-4" aria-hidden />
            Usar o mesmo número do WhatsApp geral
          </button>
          <button
            type="button"
            onClick={() => void salvarWhatsapp()}
            disabled={salvandoWhatsapp}
            className="w-full rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: COR_VERDE_BOTAO }}
          >
            {salvandoWhatsapp ? 'Salvando…' : 'SALVAR'}
          </button>
          {msgWhatsapp ? (
            <p
              className={`text-sm font-medium ${msgOk(msgWhatsapp) ? 'text-emerald-700' : 'text-rose-600'}`}
            >
              {msgWhatsapp}
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

      <ChevronPasta
        titulo="Regras da meia-entrada"
        aberto={abertos.meia}
        onToggle={() => setAbertos((a) => ({ ...a, meia: !a.meia }))}
        icone={Ticket}
        corTitulo={COR}
      >
        <div className="space-y-3 px-1 pb-1">
          <label className={labelCls}>
            Quem tem direito e como comprovar
            <textarea
              rows={5}
              value={form.regras_meia_entrada}
              onChange={(e) => {
                patch({ regras_meia_entrada: e.target.value })
                setMsgMeia(null)
              }}
              className={inputCls}
              placeholder="Ex.: estudantes com carteirinha, idosos 60+, crianças até 5 anos…"
            />
          </label>
          <button
            type="button"
            onClick={() => void salvarMeia()}
            disabled={salvandoMeia || !empresaId}
            className="w-full rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: COR_VERDE_BOTAO }}
          >
            {salvandoMeia ? 'Salvando…' : 'SALVAR'}
          </button>
          {msgMeia ? (
            <p className={`text-sm font-medium ${msgOk(msgMeia) ? 'text-emerald-700' : 'text-rose-600'}`}>
              {msgMeia}
            </p>
          ) : null}
        </div>
      </ChevronPasta>
    </div>
  )
}
