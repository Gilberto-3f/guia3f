'use client'

import { useEffect, useState } from 'react'
import { Coins, Link2, MessageCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { COR_VERDE_BOTAO } from '@/lib/comprasCdeCatalogo'
import {
  FLAG_MOEDA_PADRAO,
  LABEL_MOEDA_PADRAO,
  MOEDAS_PADRAO_LOJA,
  normalizarMoedaPadrao,
  type MoedaPadraoLoja,
} from '@/lib/comprasCdeMoedaPadrao'
import ChevronPasta from '../hospedagem/ChevronPasta'
import FeedbackCatalogoAjustes from './FeedbackCatalogoAjustes'
import FeedbackCardapioAjustes from '../gastronomia/FeedbackCardapioAjustes'
import FeedbackServicosAjustes from '../servicos-locais/FeedbackServicosAjustes'

const COR = '#0097b2'

type Props = {
  empresaId: string
  whatsappGeral: string | null
  whatsappComercialInicial: string | null
  moedaPadraoInicial?: string | null
  /** Lojas: Feedback do catálogo. */
  mostrarFeedbackCatalogo?: boolean
  /** Gastronomia: Feedback do cardápio. */
  mostrarFeedbackCardapio?: boolean
  /** Serviços Locais: Feedback do catálogo de serviços. */
  mostrarFeedbackServicos?: boolean
  /** Rótulo do botão dinâmico (CATÁLOGO / CARDÁPIO / SERVIÇOS) para a métrica Desempenho. */
  rotuloBotaoDinamico?: string
  onSalvo?: () => void
}

export default function AbaContatos({
  empresaId,
  whatsappGeral,
  whatsappComercialInicial,
  moedaPadraoInicial = 'USD',
  mostrarFeedbackCatalogo = false,
  mostrarFeedbackCardapio = false,
  mostrarFeedbackServicos = false,
  rotuloBotaoDinamico = 'CATÁLOGO',
  onSalvo,
}: Props) {
  const [whatsappComercial, setWhatsappComercial] = useState(whatsappComercialInicial ?? '')
  const [moedaPadrao, setMoedaPadrao] = useState<MoedaPadraoLoja>(() =>
    normalizarMoedaPadrao(moedaPadraoInicial),
  )
  const [salvando, setSalvando] = useState(false)
  const [salvandoMoeda, setSalvandoMoeda] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [msgMoeda, setMsgMoeda] = useState<string | null>(null)
  const [moedaAberta, setMoedaAberta] = useState(false)
  const [whatsappAberto, setWhatsappAberto] = useState(false)

  useEffect(() => {
    setWhatsappComercial(whatsappComercialInicial ?? '')
  }, [whatsappComercialInicial])

  useEffect(() => {
    setMoedaPadrao(normalizarMoedaPadrao(moedaPadraoInicial))
  }, [moedaPadraoInicial])

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
      setMsg('Salvo com sucesso!')
      onSalvo?.()
      window.dispatchEvent(new Event('perfil-atualizado'))
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Não foi possível salvar.')
    } finally {
      setSalvando(false)
    }
  }

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
  const msgOk = (m: string) =>
    m.includes('sucesso') || m.includes('salvo') || m.includes('Salvo') || m.includes('salva')

  return (
    <div className="space-y-4">
      {mostrarFeedbackCardapio ? (
        <FeedbackCardapioAjustes empresaId={empresaId} abertoInicial={false} />
      ) : mostrarFeedbackServicos ? (
        <FeedbackServicosAjustes empresaId={empresaId} abertoInicial={false} />
      ) : mostrarFeedbackCatalogo ? (
        <FeedbackCatalogoAjustes empresaId={empresaId} abertoInicial={false} />
      ) : null}

      <ChevronPasta
        titulo="Moeda padrão"
        aberto={moedaAberta}
        onToggle={() => setMoedaAberta((v) => !v)}
        icone={Coins}
        corTitulo={COR}
      >
        <div className="space-y-3 px-1 pb-1">
          <p className="text-xs text-gray-500">
            Moeda principal dos preços no cadastro e nos mini-cards do catálogo. O conversor do
            visitante mostra apenas as demais moedas.
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
        titulo="WhatsApp Comercial"
        aberto={whatsappAberto}
        onToggle={() => setWhatsappAberto((v) => !v)}
        icone={MessageCircle}
        corTitulo={COR}
      >
        <div className="space-y-3 px-1 pb-1">
          <p className="text-xs text-gray-500">
            Número do setor comercial (usado no catálogo e no Compras CDE). Não substitui o WhatsApp
            geral da página.
          </p>
          <label className={labelCls}>
            Número *
            <input
              type="tel"
              value={whatsappComercial}
              onChange={(e) => {
                setWhatsappComercial(e.target.value)
                setMsg(null)
              }}
              placeholder="55 595 XXX XXX"
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
            onClick={() => void salvar()}
            disabled={salvando}
            className="w-full rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: COR_VERDE_BOTAO }}
          >
            {salvando ? 'Salvando…' : 'SALVAR'}
          </button>
          {msg ? (
            <p className={`text-sm font-medium ${msgOk(msg) ? 'text-emerald-700' : 'text-rose-600'}`}>
              {msg}
            </p>
          ) : null}
        </div>
      </ChevronPasta>
    </div>
  )
}
