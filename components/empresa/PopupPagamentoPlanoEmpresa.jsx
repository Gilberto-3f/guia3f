'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft,
  BadgeCheck,
  Banknote,
  CalendarClock,
  Copy,
  CreditCard,
  QrCode,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { labelModalidadePlano } from '@/lib/contratarPlanoEmpresa'
import {
  cartaoPlanoValido,
  enviarMensagemPagamentoPlanoAdm,
  fetchPixCopiaColaPlano,
  formatarNumeroCartao,
  formatarValidadeCartao,
  montarMensagemPagamentoPlano,
} from '@/lib/pagamentoPlanoEmpresa'
import { useModalScrollLock } from '@/lib/useModalScrollLock'

/** @typedef {'cartao' | 'pix' | 'dinheiro'} FormaPagamentoPlano */
/** @typedef {'mensal' | 'trimestral' | 'anual'} ModalidadePlanoEmpresa */

const FORMAS = /** @type {const} */ ([
  { id: 'cartao', label: 'Cartão', Icon: CreditCard },
  { id: 'pix', label: 'PIX', Icon: QrCode },
  { id: 'dinheiro', label: 'Dinheiro', Icon: Banknote },
])

/**
 * Popup de pagamento ao contratar plano (1ª parte: forma + detalhe por método).
 * @param {{
 *   aberto: boolean
 *   onFechar: () => void
 *   plano: { id: string, titulo: string, nome?: string } | null
 *   modalidade: ModalidadePlanoEmpresa | null
 *   preco: number
 *   empresaId: string | null
 *   onContratado: (msg: string, planoContratado?: boolean) => void
 * }} props
 */
export default function PopupPagamentoPlanoEmpresa({
  aberto,
  onFechar,
  plano,
  modalidade,
  preco,
  empresaId,
  onContratado,
}) {
  /** @type {'forma' | FormaPagamentoPlano} */
  const [etapa, setEtapa] = useState('forma')
  /** @type {FormaPagamentoPlano | ''} */
  const [forma, setForma] = useState('')
  const [pixCopiaCola, setPixCopiaCola] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState(/** @type {string | null} */ (null))

  const [nomeCartao, setNomeCartao] = useState('')
  const [numeroCartao, setNumeroCartao] = useState('')
  const [validadeCartao, setValidadeCartao] = useState('')
  const [cvvCartao, setCvvCartao] = useState('')

  useModalScrollLock(aberto)

  const reset = useCallback(() => {
    setEtapa('forma')
    setForma('')
    setCopiado(false)
    setErro(null)
    setNomeCartao('')
    setNumeroCartao('')
    setValidadeCartao('')
    setCvvCartao('')
  }, [])

  useEffect(() => {
    if (!aberto) {
      reset()
      return
    }
    void fetchPixCopiaColaPlano(supabase).then(setPixCopiaCola)
  }, [aberto, reset])

  if (!aberto || !plano || !modalidade) return null

  const valorFmt = preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
  const modLabel = labelModalidadePlano(modalidade)

  const fechar = () => {
    reset()
    onFechar()
  }

  const avancarForma = () => {
    if (!forma) {
      setErro('Selecione uma forma de pagamento para avançar.')
      return
    }
    setErro(null)
    setEtapa(forma)
  }

  const contratarPlano = async (formaPagamento, extraMsg) => {
    const res = await fetch('/api/empresa/contratar-plano', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plano_id: plano.id, modalidade, forma_pagamento: formaPagamento }),
    })
    const json = await res.json()
    if (!res.ok || !json.ok) {
      throw new Error(json.error ?? 'Não foi possível contratar o plano.')
    }
    if (empresaId && extraMsg) {
      await enviarMensagemPagamentoPlanoAdm(
        supabase,
        empresaId,
        montarMensagemPagamentoPlano({
          planoTitulo: json.plano_titulo ?? plano.titulo,
          modalidade,
          preco,
          forma: formaPagamento,
          extra: extraMsg,
        }),
      )
    }
    return { titulo: json.plano_titulo ?? plano.titulo, planoContratado: Boolean(json.plano_contratado) }
  }

  const copiarPix = async () => {
    if (!pixCopiaCola) return
    try {
      await navigator.clipboard.writeText(pixCopiaCola)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 2500)
    } catch {
      setErro('Não foi possível copiar o código PIX.')
    }
  }

  const confirmarPix = async () => {
    setLoading(true)
    setErro(null)
    try {
      const { titulo, planoContratado } = await contratarPlano('pix', 'Aguardando confirmação do pagamento PIX pelo ADM.')
      onContratado(
        `Plano ${titulo} (${modLabel}) contratado. Envie o comprovante PIX pelo chat com o ADM, se necessário.`,
        planoContratado,
      )
      fechar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao confirmar pagamento.')
    } finally {
      setLoading(false)
    }
  }

  const pagarCartao = async () => {
    const msgVal = cartaoPlanoValido({
      nome: nomeCartao,
      numero: numeroCartao,
      validade: validadeCartao,
      cvv: cvvCartao,
    })
    if (msgVal) {
      setErro(msgVal)
      return
    }
    setLoading(true)
    setErro(null)
    try {
      const ultimos = numeroCartao.replace(/\D/g, '').slice(-4)
      const { titulo, planoContratado } = await contratarPlano(
        'cartao',
        `Cartão final ${ultimos} — aguardando processamento/liberação ADM.`,
      )
      onContratado(`Plano ${titulo} (${modLabel}) contratado. Pagamento com cartão registrado.`, planoContratado)
      fechar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao processar cartão.')
    } finally {
      setLoading(false)
    }
  }

  const agendarVisita = async () => {
    if (!empresaId) {
      setErro('Empresa não identificada.')
      return
    }
    setLoading(true)
    setErro(null)
    try {
      const { titulo } = await contratarPlano(
        'dinheiro',
        'Solicitação de visita para pagamento em dinheiro e liberação manual do plano.',
      )
      onContratado(
        `Solicitação enviada para pagamento em dinheiro do plano ${titulo} (${modLabel}). O ADM entrará em contato para agendar a visita.`,
        false,
      )
      fechar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao agendar visita.')
    } finally {
      setLoading(false)
    }
  }

  const formaBtnCls = (ativo) =>
    [
      'flex min-w-0 flex-1 flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-sm font-bold transition',
      ativo
        ? 'border-[#0097b2] bg-[#0097b2]/10 text-[#0097b2] ring-2 ring-[#0097b2]/20'
        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300',
    ].join(' ')

  return (
    <div
      className="fixed inset-0 z-[280] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={fechar}
    >
      <div
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="popup-pagamento-plano-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-gray-100 bg-white px-4 py-4">
          <div className="min-w-0">
            <h2 id="popup-pagamento-plano-titulo" className="text-lg font-bold text-[#001f3f]">
              Pagamento do plano
            </h2>
            <p className="mt-0.5 text-sm text-gray-600">
              {plano.titulo} · {modLabel} · R$ {valorFmt}
            </p>
          </div>
          <button
            type="button"
            onClick={fechar}
            className="shrink-0 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Fechar"
          >
            <X size={22} aria-hidden />
          </button>
        </div>

        <div className="space-y-4 p-4">
          {erro ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{erro}</p> : null}

          {etapa === 'forma' ? (
            <>
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Forma de pagamento</p>
              <div className="grid grid-cols-3 gap-2">
                {FORMAS.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setForma(id)
                      setErro(null)
                    }}
                    className={formaBtnCls(forma === id)}
                  >
                    <Icon className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={!forma}
                onClick={avancarForma}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00D443] py-3.5 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#00b83b] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <BadgeCheck className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
                Avançar
              </button>
            </>
          ) : null}

          {etapa === 'pix' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setEtapa('forma')
                  setErro(null)
                }}
                className="inline-flex items-center gap-1 text-sm font-semibold text-[#0097b2]"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Voltar
              </button>
              <p className="text-sm text-gray-600">
                Copie o código abaixo e pague <strong>R$ {valorFmt}</strong> via PIX.
              </p>
              {pixCopiaCola ? (
                <>
                  <label className="block text-xs font-bold uppercase tracking-wide text-gray-500">
                    Código copia e cola
                  </label>
                  <textarea
                    readOnly
                    value={pixCopiaCola}
                    rows={4}
                    className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs leading-relaxed text-gray-800"
                  />
                  <button
                    type="button"
                    onClick={() => void copiarPix()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#0097b2] bg-[#0097b2]/5 py-2.5 text-sm font-bold text-[#0097b2]"
                  >
                    <Copy className="h-4 w-4" aria-hidden />
                    {copiado ? 'Código copiado!' : 'Copiar código'}
                  </button>
                </>
              ) : (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Código PIX ainda não configurado pelo ADM. Entre em contato pelo chat após confirmar.
                </p>
              )}
              <button
                type="button"
                disabled={loading}
                onClick={() => void confirmarPix()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00D443] py-3.5 text-sm font-bold uppercase tracking-wide text-white hover:bg-[#00b83b] disabled:opacity-50"
              >
                <BadgeCheck className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
                {loading ? 'Confirmando…' : 'Confirmar pagamento'}
              </button>
            </>
          ) : null}

          {etapa === 'dinheiro' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setEtapa('forma')
                  setErro(null)
                }}
                className="inline-flex items-center gap-1 text-sm font-semibold text-[#0097b2]"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Voltar
              </button>
              <p className="text-sm leading-relaxed text-gray-600">
                Para pagamento em dinheiro, agende uma visita com nossa equipe. O ADM fará a liberação manual do plano
                após o recebimento.
              </p>
              <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm font-semibold text-[#001f3f]">
                Valor: R$ {valorFmt} ({modLabel})
              </p>
              <button
                type="button"
                disabled={loading}
                onClick={() => void agendarVisita()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00D443] py-3.5 text-sm font-bold uppercase tracking-wide text-white hover:bg-[#00b83b] disabled:opacity-50"
              >
                <CalendarClock className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
                {loading ? 'Enviando…' : 'Agendar visita'}
              </button>
            </>
          ) : null}

          {etapa === 'cartao' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setEtapa('forma')
                  setErro(null)
                }}
                className="inline-flex items-center gap-1 text-sm font-semibold text-[#0097b2]"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Voltar
              </button>
              <p className="text-sm text-gray-600">Cadastre os dados do cartão para pagamento de R$ {valorFmt}.</p>
              <label className="block text-xs font-semibold text-gray-700">
                Nome no cartão
                <input
                  type="text"
                  value={nomeCartao}
                  onChange={(e) => setNomeCartao(e.target.value)}
                  autoComplete="cc-name"
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                  placeholder="Como impresso no cartão"
                />
              </label>
              <label className="block text-xs font-semibold text-gray-700">
                Número do cartão
                <input
                  type="text"
                  inputMode="numeric"
                  value={numeroCartao}
                  onChange={(e) => setNumeroCartao(formatarNumeroCartao(e.target.value))}
                  autoComplete="cc-number"
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                  placeholder="0000 0000 0000 0000"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-gray-700">
                  Validade
                  <input
                    type="text"
                    inputMode="numeric"
                    value={validadeCartao}
                    onChange={(e) => setValidadeCartao(formatarValidadeCartao(e.target.value))}
                    autoComplete="cc-exp"
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                    placeholder="MM/AA"
                  />
                </label>
                <label className="block text-xs font-semibold text-gray-700">
                  CVV
                  <input
                    type="password"
                    inputMode="numeric"
                    value={cvvCartao}
                    onChange={(e) => setCvvCartao(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    autoComplete="cc-csc"
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                    placeholder="•••"
                  />
                </label>
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={() => void pagarCartao()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00D443] py-3.5 text-sm font-bold uppercase tracking-wide text-white hover:bg-[#00b83b] disabled:opacity-50"
              >
                <BadgeCheck className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
                {loading ? 'Processando…' : 'Pagar'}
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
