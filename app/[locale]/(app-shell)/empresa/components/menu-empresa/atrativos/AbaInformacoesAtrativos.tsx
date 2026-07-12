'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Save } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  COR_VERDE_BOTAO,
  formasPagamentoVazio,
  parseFormasPagamento,
  validarFormasPagamento,
  type FormasPagamentoHospedagem,
} from '@/lib/atrativosCatalogo'
import { MOEDAS_DINHEIRO } from '@/lib/hospedagemAcomodacoesCatalogo'
import ChevronPasta from '../hospedagem/ChevronPasta'

type Props = {
  empresaId: string
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

export default function AbaInformacoesAtrativos({ empresaId }: Props) {
  const [form, setForm] = useState<FormPoliticas>(formVazio())
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [abertos, setAbertos] = useState({ pagamento: false, meia: false })

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

  const salvar = async () => {
    const errPag = validarFormasPagamento(form.formas_pagamento)
    if (errPag) {
      setErro(errPag)
      return
    }
    setSalvando(true)
    setErro(null)
    setMsg(null)
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
      setMsg('Informações salvas.')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.')
    } finally {
      setSalvando(false)
    }
  }

  const inputCls =
    'mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#0097b2]'
  const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-gray-500'
  const fp = form.formas_pagamento

  if (carregando) {
    return <p className="text-sm text-gray-500">Carregando informações…</p>
  }

  return (
    <div className="space-y-3">
      <ChevronPasta
        titulo="Forma de pagamento"
        aberto={abertos.pagamento}
        onToggle={() => setAbertos((a) => ({ ...a, pagamento: !a.pagamento }))}
      >
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
                  onClick={() =>
                    patch({
                      formas_pagamento: { ...fp, [op.key]: !ativo },
                    })
                  }
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
                            onClick={() =>
                              patch({
                                formas_pagamento: {
                                  ...fp,
                                  moedas: toggleInList(fp.moedas, m.value),
                                },
                              })
                            }
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
      </ChevronPasta>

      <ChevronPasta
        titulo="Regras da meia-entrada"
        aberto={abertos.meia}
        onToggle={() => setAbertos((a) => ({ ...a, meia: !a.meia }))}
      >
        <label className={labelCls}>
          Quem tem direito e como comprovar
          <textarea
            rows={5}
            value={form.regras_meia_entrada}
            onChange={(e) => patch({ regras_meia_entrada: e.target.value })}
            className={inputCls}
            placeholder="Ex.: estudantes com carteirinha, idosos 60+, crianças até 5 anos…"
          />
        </label>
      </ChevronPasta>

      {erro ? <p className="text-sm text-rose-600">{erro}</p> : null}
      {msg ? <p className="text-sm text-emerald-700">{msg}</p> : null}

      <button
        type="button"
        onClick={() => void salvar()}
        disabled={salvando || !empresaId}
        className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-50"
        style={{ backgroundColor: COR_VERDE_BOTAO }}
      >
        <Save className="h-4 w-4" aria-hidden />
        {salvando ? 'Salvando…' : 'Salvar informações'}
      </button>
    </div>
  )
}
