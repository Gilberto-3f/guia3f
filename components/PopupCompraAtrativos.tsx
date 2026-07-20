'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BadgeCheck, Check, ShoppingCart, Ticket, X } from 'lucide-react'
import { useRouter } from '@/i18n/navigation'
import { supabase } from '@/lib/supabase'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import { openWhatsAppChat } from '@/lib/whatsapp-empresa'
import { useGateComprasReservas } from '@/lib/useGateComprasReservas'
import PopupAvisoBloqueioConta from '@/components/PopupAvisoBloqueioConta'
import BotaoEstrelaFavorito from '@/components/favoritos/BotaoEstrelaFavorito'
import { filtrarFavoritoIdsPorUsuario } from '@/lib/favoritosTurista'
import { registrarUsoPreLiberacao } from '@/lib/registrarUsoPreLiberacao'
import { useModalScrollLock } from '@/lib/useModalScrollLock'
import { contaVerificadaDocumentacao } from '@/lib/contaVerificada'
import {
  formatarPrecoTicket,
  mapExperienciaRow,
  parseFormasPagamento,
  type AtrativoExperienciaRow,
  type FormasPagamentoHospedagem,
  type TipoTicketAtrativo,
} from '@/lib/atrativosCatalogo'

function rotuloEntrada(q: number): string {
  return q === 1 ? '1 entrada' : `${q} entradas`
}

function rotuloMeiaEntrada(q: number): string {
  return q === 1 ? '1 meia-entrada' : `${q} meia-entradas`
}

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
  empresaUsername?: string | null
  empresaFotoUrl?: string | null
  notaMedia?: number | null
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
  visitanteId,
  favoritoInicial,
  onFavoritoChange,
  onAdd,
}: {
  item: AtrativoExperienciaRow
  regrasMeia: string
  visitanteId: string | null
  favoritoInicial: boolean
  onFavoritoChange: (salvo: boolean) => void
  onAdd: (tipo: TipoTicketAtrativo, qty: number) => void
}) {
  const tipos = useMemo(() => {
    const t: TipoTicketAtrativo[] = []
    if (item.oferece_inteira) t.push('inteira')
    if (item.oferece_meia) t.push('meia')
    return t
  }, [item.oferece_inteira, item.oferece_meia])
  const [tipo, setTipo] = useState<TipoTicketAtrativo>(tipos[0] ?? 'inteira')
  const [qtyInteira, setQtyInteira] = useState(item.oferece_inteira ? 1 : 0)
  const [qtyMeia, setQtyMeia] = useState(item.oferece_inteira ? 0 : item.oferece_meia ? 1 : 0)
  const [fotoIdx, setFotoIdx] = useState(0)

  useEffect(() => {
    if (!tipos.includes(tipo) && tipos[0]) setTipo(tipos[0])
  }, [item.id, tipos, tipo])

  useEffect(() => {
    setQtyInteira(item.oferece_inteira ? 1 : 0)
    setQtyMeia(item.oferece_inteira ? 0 : item.oferece_meia ? 1 : 0)
    setFotoIdx(0)
  }, [item.id, item.oferece_inteira, item.oferece_meia])

  const qtyAtual = tipo === 'inteira' ? qtyInteira : qtyMeia
  const setQtyAtual = (next: number) => {
    if (tipo === 'inteira') setQtyInteira(next)
    else setQtyMeia(next)
  }

  const valorCompra =
    (Number(item.preco_inteira) || 0) * qtyInteira + (Number(item.preco_meia) || 0) * qtyMeia
  const totalTickets = qtyInteira + qtyMeia
  const fotos = item.fotos.length ? item.fotos : []

  const handleAdd = () => {
    if (qtyInteira > 0) onAdd('inteira', qtyInteira)
    if (qtyMeia > 0) onAdd('meia', qtyMeia)
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 px-3 pt-3">
        <p className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-[#001f3f]">
          {item.titulo}
        </p>
        <BotaoEstrelaFavorito
          usuarioId={visitanteId}
          alvoId={item.id}
          tipo="ticket"
          inicial={favoritoInicial}
          size={18}
          onChange={onFavoritoChange}
        />
      </div>

      {fotos.length > 0 ? (
        <div className="relative mt-2 aspect-[4/3] bg-gray-100">
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
      ) : (
        <div className="mt-2 aspect-[4/3] bg-gray-100" />
      )}

      <div className="space-y-3 p-3">
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
          <span className="text-sm font-semibold text-[#001f3f]">Tickets</span>
          <button
            type="button"
            onClick={() => setQtyAtual(Math.max(0, qtyAtual - 1))}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-lg font-bold text-[#0097b2]"
            aria-label="Diminuir"
          >
            −
          </button>
          <span className="min-w-[2rem] text-center text-lg font-bold text-[#0097b2]">
            {qtyAtual}
          </span>
          <button
            type="button"
            onClick={() => setQtyAtual(qtyAtual + 1)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-lg font-bold text-[#0097b2]"
            aria-label="Aumentar"
          >
            +
          </button>
        </div>

        {totalTickets > 0 ? (
          <div className="text-center text-sm font-medium text-gray-700">
            {qtyInteira > 0 ? <p>{rotuloEntrada(qtyInteira)}</p> : null}
            {qtyMeia > 0 ? <p>{rotuloMeiaEntrada(qtyMeia)}</p> : null}
          </div>
        ) : (
          <p className="text-center text-sm text-gray-400">Nenhum ingresso selecionado</p>
        )}

        <p className="text-center text-sm font-semibold text-[#0097b2]">
          Valor da Compra: {formatarPrecoTicket(valorCompra)}
        </p>

        <button
          type="button"
          disabled={totalTickets === 0}
          onClick={handleAdd}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0097b2] py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-gray-400"
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
  empresaUsername = null,
  empresaFotoUrl = null,
  notaMedia = null,
  whatsappDestino,
}: Props) {
  const router = useRouter()
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
  const [nomeLive, setNomeLive] = useState(empresaNome)
  const [usernameLive, setUsernameLive] = useState(empresaUsername)
  const [fotoLive, setFotoLive] = useState(empresaFotoUrl)
  const [notaLive, setNotaLive] = useState<number | null>(
    typeof notaMedia === 'number' && Number.isFinite(notaMedia) ? notaMedia : null
  )
  const [verificadaLive, setVerificadaLive] = useState(false)
  const [formaPagamento, setFormaPagamento] = useState<string>('')
  const [toast, setToast] = useState<string | null>(null)
  const [visitanteId, setVisitanteId] = useState<string | null>(null)
  const [favTickets, setFavTickets] = useState<Set<string>>(() => new Set())

  useModalScrollLock(isOpen)

  const carregar = useCallback(async () => {
    if (!empresaId) return
    setLoading(true)
    try {
      const [expRes, polRes, empRes] = await Promise.all([
        supabase
          .from('atrativos_experiencias')
          .select('*')
          .eq('empresa_id', empresaId)
          .order('created_at', { ascending: true }),
        supabase.from('atrativos_politicas').select('*').eq('empresa_id', empresaId).maybeSingle(),
        supabase
          .from('empresas')
          .select('nome_fantasia, nome_usuario, foto_url, nota_media, docs_verificado, status')
          .eq('id', empresaId)
          .maybeSingle(),
      ])
      if (expRes.error) throw expRes.error
      const mapped = (expRes.data ?? []).map((r) => mapExperienciaRow(r as Record<string, unknown>))
      setLista(mapped)
      const fp = parseFormasPagamento(polRes.data?.formas_pagamento)
      setFormas(fp)
      setRegrasMeia(String(polRes.data?.regras_meia_entrada ?? ''))
      const disponiveis = formasDisponiveis(fp)
      setFormaPagamento(disponiveis[0]?.key ?? '')

      const emp = empRes.data as Record<string, unknown> | null
      if (emp) {
        const nomeFantasia =
          emp.nome_fantasia != null && String(emp.nome_fantasia).trim() !== ''
            ? String(emp.nome_fantasia).trim()
            : ''
        setNomeLive(nomeFantasia || empresaNome)
        const userEmp =
          emp.nome_usuario != null && String(emp.nome_usuario).trim() !== ''
            ? String(emp.nome_usuario).replace(/^@+/, '').trim()
            : ''
        setUsernameLive(userEmp || empresaUsername || null)
        const fotoEmp =
          emp.foto_url != null && String(emp.foto_url).trim() !== ''
            ? String(emp.foto_url).trim()
            : null
        setFotoLive(fotoEmp || empresaFotoUrl || null)
        const notaRaw = emp.nota_media != null ? Number(emp.nota_media) : NaN
        setNotaLive(
          Number.isFinite(notaRaw) && notaRaw > 0
            ? notaRaw
            : typeof notaMedia === 'number' && Number.isFinite(notaMedia) && notaMedia > 0
              ? notaMedia
              : null,
        )
        setVerificadaLive(contaVerificadaDocumentacao('empresa', emp))
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()
      const uid = session?.user?.id ?? null
      setVisitanteId(uid)
      if (uid && mapped.length > 0) {
        const favs = await filtrarFavoritoIdsPorUsuario(
          supabase,
          uid,
          'ticket',
          mapped.map((a) => a.id),
        )
        setFavTickets(favs)
      } else {
        setFavTickets(new Set())
      }
    } catch {
      setLista([])
      setFavTickets(new Set())
    } finally {
      setLoading(false)
    }
  }, [empresaId, empresaNome, empresaUsername, empresaFotoUrl, notaMedia])

  useEffect(() => {
    if (!isOpen) return
    setEtapa(1)
    setCarrinho([])
    setToast(null)
    setNomeLive(empresaNome)
    setUsernameLive(empresaUsername)
    setFotoLive(empresaFotoUrl)
    setNotaLive(
      typeof notaMedia === 'number' && Number.isFinite(notaMedia) && notaMedia > 0
        ? notaMedia
        : null,
    )
    setVerificadaLive(false)
    void carregar()
  }, [isOpen, carregar, empresaNome, empresaUsername, empresaFotoUrl, notaMedia])

  const totalCarrinho = useMemo(
    () => carrinho.reduce((acc, i) => acc + i.precoUnit * i.quantidade, 0),
    [carrinho],
  )

  const temMeiaNoCarrinho = carrinho.some((i) => i.tipo === 'meia')
  const opcoesPagamento = useMemo(() => formasDisponiveis(formas), [formas])

  const usernameExibir = (() => {
    const raw =
      usernameLive != null && String(usernameLive).trim() !== ''
        ? String(usernameLive).replace(/^@+/, '').trim()
        : ''
    return raw || null
  })()
  const notaTexto =
    notaLive != null && notaLive > 0 ? notaLive.toFixed(1).replace(/\.0$/, '') : null

  const cardEmpresaAzul = (
    <button
      type="button"
      onClick={() => {
        onClose()
        router.push(`/empresa/${empresaId}`)
      }}
      className="flex w-full items-center gap-3 rounded-xl bg-[#0097b2] p-3 text-left shadow-sm transition-opacity hover:opacity-95"
    >
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border-2 border-white/40 bg-white/20">
        {fotoLive ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fotoLive} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1 overflow-hidden pr-1">
        <p className="truncate text-sm font-bold text-white">{nomeLive || empresaNome}</p>
        {usernameExibir ? (
          <p className="mt-0.5 flex max-w-full items-center gap-1 truncate text-xs text-white/90">
            {verificadaLive ? (
              <BadgeCheck
                className="h-3.5 w-3.5 shrink-0 text-white"
                fill="currentColor"
                stroke="#0097b2"
                strokeWidth={2}
                aria-hidden
              />
            ) : null}
            <span className="truncate">@{usernameExibir}</span>
          </p>
        ) : null}
        {notaTexto ? (
          <p className="mt-0.5 flex items-center gap-0.5 text-xs font-bold text-amber-300">
            <span aria-hidden>★</span>
            {notaTexto}
          </p>
        ) : null}
      </div>
    </button>
  )

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
                {cardEmpresaAzul}
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
                          visitanteId={visitanteId}
                          favoritoInicial={favTickets.has(item.id)}
                          onFavoritoChange={(salvo) => {
                            setFavTickets((prev) => {
                              const next = new Set(prev)
                              if (salvo) next.add(item.id)
                              else next.delete(item.id)
                              return next
                            })
                          }}
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
