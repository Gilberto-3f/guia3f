'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, ShoppingCart, Ticket, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import { openWhatsAppChat } from '@/lib/whatsapp-empresa'
import { useGateComprasReservas } from '@/lib/useGateComprasReservas'
import PopupAvisoBloqueioConta from '@/components/PopupAvisoBloqueioConta'
import { registrarUsoPreLiberacao } from '@/lib/registrarUsoPreLiberacao'
import { useModalScrollLock } from '@/lib/useModalScrollLock'
import {
  formatarPrecoTicket,
  mapExperienciaRow,
  parseFormasPagamento,
  type AtrativoExperienciaRow,
  type FormasPagamentoHospedagem,
  type TipoTicketAtrativo,
} from '@/lib/atrativosCatalogo'

type ItemCarrinho = {
  key: string
  experienciaId: string
  titulo: string
  foto: string | null
  tipo: TipoTicketAtrativo
  precoUnit: number
  quantidade: number
}

type Props = {
  isOpen: boolean
  onClose: () => void
  empresaId: string
  empresaNome: string
  whatsappDestino?: string | null
}

const FORMAS_LABEL: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  cartao_credito: 'Cartão de Crédito',
  cartao_debito: 'Cartão de Débito',
}

function formasDisponiveis(fp: FormasPagamentoHospedagem): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = []
  if (fp.dinheiro) {
    const moedas = fp.moedas.length ? ` (${fp.moedas.join(', ')})` : ''
    out.push({ key: 'dinheiro', label: `${FORMAS_LABEL.dinheiro}${moedas}` })
  }
  if (fp.pix) out.push({ key: 'pix', label: FORMAS_LABEL.pix })
  if (fp.cartao_credito) out.push({ key: 'cartao_credito', label: FORMAS_LABEL.cartao_credito })
  if (fp.cartao_debito) out.push({ key: 'cartao_debito', label: FORMAS_LABEL.cartao_debito })
  return out
}

function MiniCardCompra({
  item,
  regrasMeia,
  onAdd,
}: {
  item: AtrativoExperienciaRow
  regrasMeia: string
  onAdd: (tipo: TipoTicketAtrativo, qty: number) => void
}) {
  const tipos = useMemo(() => {
    const t: TipoTicketAtrativo[] = []
    if (item.oferece_inteira) t.push('inteira')
    if (item.oferece_meia) t.push('meia')
    return t
  }, [item.oferece_inteira, item.oferece_meia])
  const [tipo, setTipo] = useState<TipoTicketAtrativo>(tipos[0] ?? 'inteira')
  const [qty, setQty] = useState(1)
  const [fotoIdx, setFotoIdx] = useState(0)

  useEffect(() => {
    if (!tipos.includes(tipo) && tipos[0]) setTipo(tipos[0])
  }, [item.id, tipos, tipo])

  const preco =
    tipo === 'inteira' ? Number(item.preco_inteira) || 0 : Number(item.preco_meia) || 0
  const fotos = item.fotos.length ? item.fotos : []

  return (
    <article className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {fotos.length > 0 ? (
        <div className="relative aspect-[16/10] bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fotos[fotoIdx] ?? fotos[0]}
            alt=""
            className="h-full w-full object-cover"
          />
          {fotos.length > 1 ? (
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
              {fotos.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setFotoIdx(i)}
                  className={`h-2 w-2 rounded-full ${i === fotoIdx ? 'bg-white' : 'bg-white/50'}`}
                  aria-label={`Foto ${i + 1}`}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3 p-4">
        <h3 className="text-base font-bold text-[#001f3f]">{item.titulo}</h3>

        {tipos.length > 0 ? (
          <div className="flex gap-2">
            {tipos.map((t) => {
              const p = t === 'inteira' ? item.preco_inteira : item.preco_meia
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className={`flex-1 rounded-lg border py-2 text-xs font-semibold sm:text-sm ${
                    tipo === t
                      ? 'border-[#0097b2] bg-[#0097b2]/10 text-[#0097b2]'
                      : 'border-gray-200 text-gray-700'
                  }`}
                >
                  {t === 'inteira' ? 'Inteira' : 'Meia'} — {formatarPrecoTicket(p)}
                </button>
              )
            })}
          </div>
        ) : null}

        {tipo === 'meia' && regrasMeia.trim() ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
            <span className="font-semibold">Regras meia-entrada: </span>
            {regrasMeia}
          </p>
        ) : null}

        {item.descricao ? (
          <p className="text-sm leading-relaxed text-gray-600">{item.descricao}</p>
        ) : null}

        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-lg font-bold text-[#0097b2]"
            aria-label="Diminuir"
          >
            −
          </button>
          <span className="min-w-[2rem] text-center text-lg font-bold text-[#0097b2]">{qty}</span>
          <button
            type="button"
            onClick={() => setQty((q) => q + 1)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-lg font-bold text-[#0097b2]"
            aria-label="Aumentar"
          >
            +
          </button>
        </div>

        <p className="text-center text-sm font-semibold text-[#0097b2]">
          Subtotal: {formatarPrecoTicket(preco * qty)}
        </p>

        <button
          type="button"
          onClick={() => onAdd(tipo, qty)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0097b2] py-3 text-sm font-bold text-white"
        >
          <ShoppingCart className="h-4 w-4" aria-hidden />
          ADICIONAR NO CARRINHO
        </button>
      </div>
    </article>
  )
}

export default function PopupCompraAtrativos({
  isOpen,
  onClose,
  empresaId,
  empresaNome,
  whatsappDestino,
}: Props) {
  const { podeInteragir, notificarSomenteLeitura } = useModoApresentacao()
  const {
    podeComprarReservar,
    avisarBloqueio,
    avisoAberto,
    fecharAvisoBloqueio,
    mensagemBloqueio,
    tituloBloqueio,
  } = useGateComprasReservas()

  const [etapa, setEtapa] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(true)
  const [confirmando, setConfirmando] = useState(false)
  const [lista, setLista] = useState<AtrativoExperienciaRow[]>([])
  const [regrasMeia, setRegrasMeia] = useState('')
  const [formas, setFormas] = useState<FormasPagamentoHospedagem>(parseFormasPagamento(null))
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([])
  const [formaPagamento, setFormaPagamento] = useState<string>('')
  const [toast, setToast] = useState<string | null>(null)

  useModalScrollLock(isOpen)

  const carregar = useCallback(async () => {
    if (!empresaId) return
    setLoading(true)
    try {
      const [expRes, polRes] = await Promise.all([
        supabase
          .from('atrativos_experiencias')
          .select('*')
          .eq('empresa_id', empresaId)
          .order('created_at', { ascending: true }),
        supabase.from('atrativos_politicas').select('*').eq('empresa_id', empresaId).maybeSingle(),
      ])
      if (expRes.error) throw expRes.error
      setLista((expRes.data ?? []).map((r) => mapExperienciaRow(r as Record<string, unknown>)))
      const fp = parseFormasPagamento(polRes.data?.formas_pagamento)
      setFormas(fp)
      setRegrasMeia(String(polRes.data?.regras_meia_entrada ?? ''))
      const disponiveis = formasDisponiveis(fp)
      setFormaPagamento(disponiveis[0]?.key ?? '')
    } catch {
      setLista([])
    } finally {
      setLoading(false)
    }
  }, [empresaId])

  useEffect(() => {
    if (!isOpen) return
    setEtapa(1)
    setCarrinho([])
    setToast(null)
    void carregar()
  }, [isOpen, carregar])

  const totalCarrinho = useMemo(
    () => carrinho.reduce((acc, i) => acc + i.precoUnit * i.quantidade, 0),
    [carrinho],
  )

  const temMeiaNoCarrinho = carrinho.some((i) => i.tipo === 'meia')
  const opcoesPagamento = useMemo(() => formasDisponiveis(formas), [formas])

  const addAoCarrinho = (exp: AtrativoExperienciaRow, tipo: TipoTicketAtrativo, qty: number) => {
    const precoUnit =
      tipo === 'inteira' ? Number(exp.preco_inteira) || 0 : Number(exp.preco_meia) || 0
    const key = `${exp.id}:${tipo}`
    setCarrinho((prev) => {
      const existing = prev.find((i) => i.key === key)
      if (existing) {
        return prev.map((i) =>
          i.key === key ? { ...i, quantidade: i.quantidade + qty } : i,
        )
      }
      return [
        ...prev,
        {
          key,
          experienciaId: exp.id,
          titulo: exp.titulo,
          foto: exp.fotos[0] ?? null,
          tipo,
          precoUnit,
          quantidade: qty,
        },
      ]
    })
    setToast('Adicionado ao carrinho')
    window.setTimeout(() => setToast(null), 1800)
  }

  const handleConfirmar = async () => {
    if (!podeInteragir) {
      notificarSomenteLeitura()
      return
    }
    if (!podeComprarReservar) {
      avisarBloqueio()
      return
    }
    if (carrinho.length === 0) {
      alert('Adicione ao menos um ticket ao carrinho.')
      return
    }
    if (!formaPagamento && opcoesPagamento.length > 0) {
      alert('Selecione a forma de pagamento.')
      return
    }

    setConfirmando(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        alert('Faça login para continuar')
        return
      }

      const linhas = carrinho
        .map(
          (i) =>
            `• ${i.titulo} (${i.tipo}) x${i.quantidade} = R$ ${(i.precoUnit * i.quantidade).toFixed(2)}`,
        )
        .join('\n')
      const formaLabel =
        (FORMAS_LABEL[formaPagamento] ?? formaPagamento) || 'a combinar'
      const texto = `Olá! Gostaria de confirmar a compra de tickets em ${empresaNome}.\n\n${linhas}\n\nTotal: R$ ${totalCarrinho.toFixed(2)}\nForma de pagamento: ${formaLabel}\n(empresa: ${empresaId})\n\nPor favor, encaminhe o comprovante/orientação via WhatsApp.`

      if (!openWhatsAppChat(whatsappDestino, texto)) {
        alert('WhatsApp da empresa não configurado.')
        return
      }
      void registrarUsoPreLiberacao({
        tipo: 'compra_ticket',
        descricao: `Carrinho ${carrinho.length} item(ns) — ${empresaNome}`,
        empresaId,
      })
      onClose()
    } finally {
      setConfirmando(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div
        className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
        role="presentation"
      >
        <div
          className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white text-gray-900 sm:rounded-xl"
          data-modal-scroll-lock-scrollable
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              {etapa === 2 ? (
                <button
                  type="button"
                  onClick={() => setEtapa(1)}
                  className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
                  aria-label="Voltar"
                >
                  <ArrowLeft className="h-5 w-5" aria-hidden />
                </button>
              ) : (
                <Ticket size={20} className="shrink-0 text-[#0097b2]" aria-hidden />
              )}
              <h2 className="truncate text-lg font-semibold text-[#0097b2]">
                {etapa === 1 ? 'Comprar Ticket' : 'Carrinho'}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
              aria-label="Fechar"
            >
              <X size={20} aria-hidden />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <p className="p-6 text-center text-sm text-gray-400">Carregando…</p>
            ) : etapa === 1 ? (
              <div className="space-y-4 p-4">
                <p className="text-center text-sm font-semibold text-[#001f3f]">{empresaNome}</p>
                {lista.length === 0 ? (
                  <p className="text-center text-sm text-gray-500">
                    Nenhum atrativo disponível no momento.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-4">
                    {lista.map((item) => (
                      <li key={item.id}>
                        <MiniCardCompra
                          item={item}
                          regrasMeia={regrasMeia}
                          onAdd={(tipo, qty) => addAoCarrinho(item, tipo, qty)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="space-y-4 p-4">
                {carrinho.length === 0 ? (
                  <p className="text-center text-sm text-gray-500">Carrinho vazio.</p>
                ) : (
                  <ul className="space-y-3">
                    {carrinho.map((i) => (
                      <li
                        key={i.key}
                        className="flex items-center gap-3 rounded-xl border border-gray-100 bg-[#f5f5f5] p-3"
                      >
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-gray-200">
                          {i.foto ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={i.foto} alt="" className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[#001f3f]">{i.titulo}</p>
                          <p className="text-xs text-gray-500">
                            {i.tipo === 'inteira' ? 'Inteira' : 'Meia'} · {i.quantidade} ticket(s)
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-bold text-[#0097b2]">
                          {formatarPrecoTicket(i.precoUnit * i.quantidade)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}

                {temMeiaNoCarrinho && regrasMeia.trim() ? (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
                    <span className="font-semibold">Regras meia-entrada: </span>
                    {regrasMeia}
                  </p>
                ) : null}

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Forma de pagamento
                  </p>
                  {opcoesPagamento.length === 0 ? (
                    <p className="text-sm text-gray-500">Formas a combinar com a empresa.</p>
                  ) : (
                    <ul className="space-y-2">
                      {opcoesPagamento.map((op) => {
                        const ativo = formaPagamento === op.key
                        return (
                          <li key={op.key}>
                            <button
                              type="button"
                              onClick={() => setFormaPagamento(op.key)}
                              className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm ${
                                ativo ? 'border-[#0097b2] bg-[#0097b2]/10' : 'border-gray-200'
                              }`}
                            >
                              <span
                                className={`flex h-4 w-4 items-center justify-center rounded border ${
                                  ativo ? 'border-[#0097b2] bg-[#0097b2]' : 'border-gray-300'
                                }`}
                              >
                                {ativo ? (
                                  <Check className="h-2.5 w-2.5 text-white" aria-hidden />
                                ) : null}
                              </span>
                              {op.label}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-gray-100 pt-3 text-base font-bold text-[#0097b2]">
                  <span>Total</span>
                  <span>{formatarPrecoTicket(totalCarrinho)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="shrink-0 space-y-2 border-t border-gray-100 p-4">
            {toast ? <p className="text-center text-xs font-medium text-emerald-700">{toast}</p> : null}
            {etapa === 1 ? (
              <button
                type="button"
                disabled={carrinho.length === 0}
                onClick={() => setEtapa(2)}
                className="w-full rounded-xl bg-[#00D443] py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                Finalizar compra
                {carrinho.length > 0 ? ` (${carrinho.reduce((a, i) => a + i.quantidade, 0)})` : ''}
              </button>
            ) : (
              <button
                type="button"
                disabled={confirmando || carrinho.length === 0}
                onClick={() => void handleConfirmar()}
                className="w-full rounded-xl bg-[#00D443] py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {confirmando ? 'Abrindo WhatsApp…' : 'Confirmar compra'}
              </button>
            )}
          </div>
        </div>
      </div>

      <PopupAvisoBloqueioConta
        aberto={avisoAberto}
        onFechar={fecharAvisoBloqueio}
        titulo={tituloBloqueio}
        mensagem={mensagemBloqueio}
      />
    </>
  )
}
