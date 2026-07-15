'use client'

import { useCallback, useEffect, useState } from 'react'
import { BarChart3, Link2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { contarCliquesBotaoDinamicoMes } from '@/lib/botaoDinamicoCliques'
import { COR_AZUL_LOGO, COR_VERDE_BOTAO } from '@/lib/comprasCdeCatalogo'

type Props = {
  empresaId: string
  whatsappGeral: string | null
  whatsappComercialInicial: string | null
  onSalvo?: () => void
}

export default function AbaContatos({
  empresaId,
  whatsappGeral,
  whatsappComercialInicial,
  onSalvo,
}: Props) {
  const [whatsappComercial, setWhatsappComercial] = useState(whatsappComercialInicial ?? '')
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [cliquesMes, setCliquesMes] = useState<number | null>(null)

  useEffect(() => {
    setWhatsappComercial(whatsappComercialInicial ?? '')
  }, [whatsappComercialInicial])

  const carregarCliques = useCallback(async () => {
    if (!empresaId) return
    const total = await contarCliquesBotaoDinamicoMes(supabase, empresaId)
    setCliquesMes(total)
  }, [empresaId])

  useEffect(() => {
    void carregarCliques()
  }, [carregarCliques])

  const salvar = async () => {
    const valor = whatsappComercial.trim()
    if (!valor) {
      setMsg('Informe o WhatsApp Comercial.')
      return
    }
    setSalvando(true)
    setMsg(null)
    try {
      const { error } = await supabase
        .from('empresas')
        .update({ whatsapp_comercial: valor })
        .eq('id', empresaId)
      if (error) throw error
      setMsg('WhatsApp Comercial salvo.')
      onSalvo?.()
      window.dispatchEvent(new Event('perfil-atualizado'))
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Não foi possível salvar.')
    } finally {
      setSalvando(false)
    }
  }

  const sincronizarComGeral = () => {
    const g = String(whatsappGeral ?? '').trim()
    if (!g) {
      setMsg('Não há WhatsApp geral cadastrado na página da empresa.')
      return
    }
    setWhatsappComercial(g)
    setMsg(null)
  }

  const inputCls =
    'mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#0097b2]'
  const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-gray-500'

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-[#001f3f]">WhatsApp Comercial *</h2>
        <p className="mt-1 text-xs text-gray-500">
          Número do setor comercial (usado no catálogo e no Compras CDE). Não substitui o WhatsApp geral da
          página.
        </p>
        <label className={`${labelCls} mt-4`}>
          Número
          <input
            type="tel"
            value={whatsappComercial}
            onChange={(e) => setWhatsappComercial(e.target.value)}
            placeholder="55 595 XXX XXX"
            className={inputCls}
          />
        </label>
        <button
          type="button"
          onClick={sincronizarComGeral}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-[#0097b2]/40 bg-[#0097b2]/5 py-2 text-xs font-semibold text-[#0097b2]"
        >
          <Link2 className="h-4 w-4" aria-hidden />
          Usar o mesmo número do WhatsApp geral
        </button>
        <button
          type="button"
          onClick={() => void salvar()}
          disabled={salvando}
          className="mt-3 w-full rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-50"
          style={{ backgroundColor: COR_VERDE_BOTAO }}
        >
          {salvando ? 'Salvando…' : 'Salvar WhatsApp Comercial'}
        </button>
        {msg ? (
          <p
            className={`mt-2 text-sm ${
              msg.includes('salvo') || msg.includes('Salvo') ? 'text-emerald-700' : 'text-rose-600'
            }`}
          >
            {msg}
          </p>
        ) : null}
      </div>

      <div className="rounded-xl border border-gray-200 bg-[#f5f5f5] p-4">
        <div className="flex items-center gap-2 text-[#001f3f]">
          <BarChart3 className="h-5 w-5" style={{ color: COR_AZUL_LOGO }} aria-hidden />
          <h2 className="text-sm font-bold">Desempenho no mês</h2>
        </div>
        <p className="mt-2 text-3xl font-bold" style={{ color: COR_AZUL_LOGO }}>
          {cliquesMes == null ? '—' : cliquesMes}
        </p>
        <p className="mt-1 text-xs text-gray-600">Cliques no botão dinâmico (mês corrente)</p>
      </div>
    </div>
  )
}
