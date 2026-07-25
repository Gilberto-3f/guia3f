'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MessageCircle,
  ShoppingBag,
  Ticket,
  X,
} from 'lucide-react'
import { useRouter } from '@/i18n/navigation'
import { supabase } from '@/lib/supabase'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import { openWhatsAppChat, mensagemWhatsappTicket } from '@/lib/whatsapp-empresa'
import { useGateComprasReservas } from '@/lib/useGateComprasReservas'
import PopupAvisoBloqueioConta from '@/components/PopupAvisoBloqueioConta'
import BotaoEstrelaFavorito from '@/components/favoritos/BotaoEstrelaFavorito'
import BotaoChamarCorrida from '@/components/BotaoChamarCorrida'
import PopupRecomendarTicket from '@/components/atrativos/PopupRecomendarTicket'
import ChevronPasta from '@/app/[locale]/(app-shell)/empresa/components/menu-empresa/hospedagem/ChevronPasta'
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

const COR = '#0097b2'

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
  /** Se já conhecido pelo card/página — evita flash do check no cabeçalho. */
  empresaVerificada?: boolean | null
  whatsappDestino?: string | null
  /** Favoritos / salvos: abre direto no ticket selecionado. */
  ticketIdInicial?: string | null
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

function MiniCardLista({
  item,
  visitanteId,
  favoritoInicial,
  onFavoritoChange,
  onVerTicket,
}: {
  item: AtrativoExperienciaRow
  visitanteId: string | null
  favoritoInicial: boolean
  onFavoritoChange: (salvo: boolean) => void
  onVerTicket: () => void
}) {
  const foto = item.fotos[0] ?? null
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

      {foto ? (
        <div className="relative mt-2 aspect-[4/3] bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={foto} alt="" className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="mt-2 aspect-[4/3] bg-gray-100" />
      )}

      <div className="space-y-2 p-3">
        {item.descricao ? (
          <p className="line-clamp-2 text-sm leading-relaxed text-gray-600">{item.descricao}</p>
        ) : null}
        {item.oferece_inteira ? (
          <p className="text-sm font-bold text-[#0097b2]">
            {formatarPrecoTicket(item.preco_inteira)}
            <span className="font-normal text-gray-500"> / inteira</span>
          </p>
        ) : null}
        {item.oferece_meia ? (
          <p className="text-xs font-semibold text-gray-600">
            Meia: {formatarPrecoTicket(item.preco_meia)}
          </p>
        ) : null}
        <button
          type="button"
          onClick={onVerTicket}
          className="w-full rounded-xl bg-[#0097b2] py-2.5 text-sm font-bold uppercase tracking-wide text-white"
        >
          Ver ticket
        </button>
      </div>
    </article>
  )
}

function DetalheTicket({
  item,
  regrasMeia,
  visitanteId,
  favoritoInicial,
  onFavoritoChange,
  onComprar,
  whatsappComercial,
  usernameExibir,
  empresaId,
  empresaNome,
  perfilEhEmpresa,
  perfilEhProfissional,
}: {
  item: AtrativoExperienciaRow
  regrasMeia: string
  visitanteId: string | null
  favoritoInicial: boolean
  onFavoritoChange: (salvo: boolean) => void
  onComprar: (qtyInteira: number, qtyMeia: number) => void
  whatsappComercial: string | null
  usernameExibir: string | null
  empresaId: string
  empresaNome: string
  perfilEhEmpresa: boolean
  perfilEhProfissional: boolean
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
  const [verMaisAberto, setVerMaisAberto] = useState(false)
  const [recomendarAberto, setRecomendarAberto] = useState(false)
  const touchFotoX = useRef<number | null>(null)

  useEffect(() => {
    if (!tipos.includes(tipo) && tipos[0]) setTipo(tipos[0])
  }, [item.id, tipos, tipo])

  useEffect(() => {
    setQtyInteira(item.oferece_inteira ? 1 : 0)
    setQtyMeia(item.oferece_inteira ? 0 : item.oferece_meia ? 1 : 0)
    setFotoIdx(0)
    setVerMaisAberto(false)
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

  const abrirSite = () => {
    const url = item.site_url?.trim()
    if (!url) {
      window.alert('Link do site não cadastrado para este atrativo.')
      return
    }
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`
    window.open(href, '_blank', 'noopener,noreferrer')
  }

  const abrirWhatsapp = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const ticketUrl = origin
      ? `${origin}/tickets/${item.id}?ref=whatsapp`
      : `/tickets/${item.id}?ref=whatsapp`
    const ok = openWhatsAppChat(
      whatsappComercial,
      mensagemWhatsappTicket({
        nomeTicket: item.titulo,
        username: usernameExibir,
        ticketUrl,
      }),
    )
    if (!ok) window.alert('WhatsApp comercial da empresa não configurado.')
  }

  return (
    <div className="space-y-4 pb-6">
      <p className="px-1 text-left text-base font-semibold text-[#001f3f]">{item.titulo}</p>

      {fotos.length > 0 ? (
        <div className="relative">
          <div
            className="aspect-[4/3] w-full touch-pan-y overflow-hidden rounded-xl bg-gray-100"
            onTouchStart={(e) => {
              touchFotoX.current = e.touches[0]?.clientX ?? null
            }}
            onTouchEnd={(e) => {
              const start = touchFotoX.current
              touchFotoX.current = null
              if (start == null || fotos.length <= 1) return
              const end = e.changedTouches[0]?.clientX
              if (end == null) return
              const dx = end - start
              if (Math.abs(dx) < 40) return
              if (dx < 0) {
                setFotoIdx((i) => (i + 1) % fotos.length)
              } else {
                setFotoIdx((i) => (i - 1 + fotos.length) % fotos.length)
              }
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fotos[fotoIdx] ?? fotos[0]}
              alt=""
              className="pointer-events-none h-full w-full object-cover"
              draggable={false}
            />
          </div>
          {fotos.length > 1 ? (
            <>
              <button
                type="button"
                onClick={() => setFotoIdx((i) => (i - 1 + fotos.length) % fotos.length)}
                className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/45 p-2 text-white"
                aria-label="Foto anterior"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setFotoIdx((i) => (i + 1) % fotos.length)}
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/45 p-2 text-white"
                aria-label="Próxima foto"
              >
                <ChevronRight className="h-5 w-5" aria-hidden />
              </button>
              <div className="pointer-events-none absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
                {fotos.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 w-1.5 rounded-full ${i === fotoIdx ? 'bg-white' : 'bg-white/50'}`}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>
      ) : (
        <div className="aspect-[4/3] rounded-xl bg-gray-100" />
      )}

      {tipos.length > 0 ? (
        <div className="flex gap-2">
          {tipos.map((t) => {
            const p = t === 'inteira' ? item.preco_inteira : item.preco_meia
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(t)}
                className={`flex-1 rounded-lg border py-2.5 text-xs font-semibold sm:text-sm ${
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
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{item.descricao}</p>
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
        <span className="min-w-[2rem] text-center text-lg font-bold text-[#0097b2]">{qtyAtual}</span>
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

      <p className="text-center text-base font-semibold text-[#0097b2]">
        Valor total: {formatarPrecoTicket(valorCompra)}
      </p>

      <button
        type="button"
        disabled={totalTickets === 0}
        onClick={() => onComprar(qtyInteira, qtyMeia)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0097b2] py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-gray-400"
      >
        <ShoppingBag className="h-4 w-4 shrink-0 text-white" aria-hidden />
        COMPRAR
      </button>

      <ChevronPasta
        titulo="VER MAIS"
        aberto={verMaisAberto}
        onToggle={() => setVerMaisAberto((v) => !v)}
        corTitulo={COR}
      >
        <div className="flex items-center justify-around gap-2 py-1">
          <button
            type="button"
            onClick={abrirWhatsapp}
            className="flex flex-col items-center gap-1 text-[#25D366]"
            aria-label="WhatsApp"
          >
            <MessageCircle className="h-7 w-7" aria-hidden />
            <span className="text-[10px] font-semibold text-gray-600">WhatsApp</span>
          </button>
          {item.site_url?.trim() ? (
            <button
              type="button"
              onClick={abrirSite}
              className="flex flex-col items-center gap-1 text-[#0097b2]"
              aria-label="Ver no site"
            >
              <ExternalLink className="h-7 w-7" aria-hidden />
              <span className="text-[10px] font-semibold text-gray-600">Site</span>
            </button>
          ) : null}
          {!perfilEhEmpresa ? (
            <div className="flex flex-col items-center gap-1">
              <BotaoEstrelaFavorito
                usuarioId={visitanteId}
                alvoId={item.id}
                tipo="ticket"
                inicial={favoritoInicial}
                size={28}
                className="!opacity-100"
                onChange={onFavoritoChange}
              />
              <span className="text-[10px] font-semibold text-gray-600">Favorito</span>
            </div>
          ) : null}
        </div>
      </ChevronPasta>

      {!perfilEhEmpresa && perfilEhProfissional ? (
        <button
          type="button"
          onClick={() => setRecomendarAberto(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#00D443] py-3 text-base font-bold text-white shadow-sm transition-opacity hover:opacity-95"
        >
          <MessageCircle size={20} className="text-white" aria-hidden />
          RECOMENDAR
        </button>
      ) : null}

      {!perfilEhEmpresa && !perfilEhProfissional ? (
        <BotaoChamarCorrida variant="empresa" empresaId={empresaId} />
      ) : null}

      <PopupRecomendarTicket
        aberto={recomendarAberto}
        onFechar={() => setRecomendarAberto(false)}
        ticket={{
          id: item.id,
          nome: item.titulo,
          precoInteira: item.preco_inteira,
          precoMeia: item.preco_meia,
          empresaId,
          empresaNome,
          empresaUsername: usernameExibir,
          categoriaId: item.categoria_id,
        }}
      />
    </div>
  )
}

export default function DrawerTicketsAtrativos({
  isOpen,
  onClose,
  empresaId,
  empresaNome,
  empresaUsername = null,
  empresaFotoUrl = null,
  notaMedia = null,
  empresaVerificada: empresaVerificadaProp = null,
  whatsappDestino,
  ticketIdInicial = null,
}: Props) {
  const router = useRouter()
  const { podeInteragir, notificarSomenteLeitura } = useModoApresentacao()
  const { perfilEhProfissional, perfilEhEmpresa } = useProfissionalGate()
  const {
    podeComprarReservar,
    avisarBloqueio,
    avisoAberto,
    fecharAvisoBloqueio,
    mensagemBloqueio,
    tituloBloqueio,
  } = useGateComprasReservas()

  const abrirDiretoNoDetalhe = Boolean(ticketIdInicial)
  const [passo, setPasso] = useState<1 | 2 | 3>(() => (ticketIdInicial ? 2 : 1))
  const [loading, setLoading] = useState(true)
  const [confirmando, setConfirmando] = useState(false)
  const [lista, setLista] = useState<AtrativoExperienciaRow[]>([])
  const [selecionado, setSelecionado] = useState<AtrativoExperienciaRow | null>(null)
  const [regrasMeia, setRegrasMeia] = useState('')
  const [formas, setFormas] = useState<FormasPagamentoHospedagem>(parseFormasPagamento(null))
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([])
  const [nomeLive, setNomeLive] = useState(empresaNome)
  const [usernameLive, setUsernameLive] = useState(empresaUsername)
  const [fotoLive, setFotoLive] = useState(empresaFotoUrl)
  const [notaLive, setNotaLive] = useState<number | null>(
    typeof notaMedia === 'number' && Number.isFinite(notaMedia) ? notaMedia : null,
  )
  const [verificadaLive, setVerificadaLive] = useState(() =>
    empresaVerificadaProp != null ? Boolean(empresaVerificadaProp) : false,
  )
  const [formaPagamento, setFormaPagamento] = useState<string>('')
  const [visitanteId, setVisitanteId] = useState<string | null>(null)
  const [favTickets, setFavTickets] = useState<Set<string>>(() => new Set())
  const [whatsappLive, setWhatsappLive] = useState<string | null>(
    whatsappDestino != null && String(whatsappDestino).trim() !== ''
      ? String(whatsappDestino).trim()
      : null,
  )

  useModalScrollLock(isOpen)

  const reset = useCallback(() => {
    setPasso(abrirDiretoNoDetalhe ? 2 : 1)
    setSelecionado(null)
    setCarrinho([])
    setNomeLive(empresaNome)
    setUsernameLive(empresaUsername)
    setFotoLive(empresaFotoUrl)
    setNotaLive(
      typeof notaMedia === 'number' && Number.isFinite(notaMedia) && notaMedia > 0
        ? notaMedia
        : null,
    )
    setVerificadaLive(
      empresaVerificadaProp != null ? Boolean(empresaVerificadaProp) : false,
    )
  }, [abrirDiretoNoDetalhe, empresaNome, empresaUsername, empresaFotoUrl, notaMedia, empresaVerificadaProp])

  const handleFechar = useCallback(() => {
    reset()
    onClose()
  }, [onClose, reset])

  const carregar = useCallback(async () => {
    if (!empresaId) return
    setLoading(true)
    try {
      const [expRes, polRes, empRes] = await Promise.all([
        supabase
          .from('atrativos_experiencias')
          .select('*')
          .eq('empresa_id', empresaId)
          .eq('ativo', true)
          .order('created_at', { ascending: true }),
        supabase.from('atrativos_politicas').select('*').eq('empresa_id', empresaId).maybeSingle(),
        supabase
          .from('empresas')
          .select(
            'nome_fantasia, nome_usuario, foto_url, nota_media, docs_verificado, status, whatsapp_comercial, whatsapp',
          )
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
        setVerificadaLive(() => {
          if (empresaVerificadaProp != null) return Boolean(empresaVerificadaProp)
          return contaVerificadaDocumentacao('empresa', emp)
        })
        const waComercial =
          emp.whatsapp_comercial != null && String(emp.whatsapp_comercial).trim() !== ''
            ? String(emp.whatsapp_comercial).trim()
            : emp.whatsapp != null && String(emp.whatsapp).trim() !== ''
              ? String(emp.whatsapp).trim()
              : null
        setWhatsappLive(
          whatsappDestino != null && String(whatsappDestino).trim() !== ''
            ? String(whatsappDestino).trim()
            : waComercial,
        )
      } else if (whatsappDestino != null && String(whatsappDestino).trim() !== '') {
        setWhatsappLive(String(whatsappDestino).trim())
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

      if (ticketIdInicial) {
        const found = mapped.find((a) => a.id === ticketIdInicial)
        if (found) {
          setSelecionado(found)
          setPasso(2)
        } else {
          setPasso(1)
        }
      }
    } catch {
      setLista([])
      setFavTickets(new Set())
    } finally {
      setLoading(false)
    }
  }, [empresaId, empresaNome, empresaUsername, empresaFotoUrl, notaMedia, ticketIdInicial, empresaVerificadaProp, whatsappDestino])

  useEffect(() => {
    if (!isOpen) return
    if (empresaVerificadaProp != null) setVerificadaLive(Boolean(empresaVerificadaProp))
    reset()
    void carregar()
  }, [isOpen, carregar, reset, empresaVerificadaProp])

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

  const montarCarrinhoDoTicket = (exp: AtrativoExperienciaRow, qtyInteira: number, qtyMeia: number) => {
    const itens: ItemCarrinho[] = []
    if (qtyInteira > 0) {
      itens.push({
        key: `${exp.id}:inteira`,
        experienciaId: exp.id,
        titulo: exp.titulo,
        foto: exp.fotos[0] ?? null,
        tipo: 'inteira',
        precoUnit: Number(exp.preco_inteira) || 0,
        quantidade: qtyInteira,
      })
    }
    if (qtyMeia > 0) {
      itens.push({
        key: `${exp.id}:meia`,
        experienciaId: exp.id,
        titulo: exp.titulo,
        foto: exp.fotos[0] ?? null,
        tipo: 'meia',
        precoUnit: Number(exp.preco_meia) || 0,
        quantidade: qtyMeia,
      })
    }
    setCarrinho(itens)
    setPasso(3)
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
      alert('Selecione ao menos um ticket.')
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
      const formaLabel = (FORMAS_LABEL[formaPagamento] ?? formaPagamento) || 'a combinar'
      const texto = `Olá! Gostaria de confirmar a compra de tickets em ${empresaNome}.\n\n${linhas}\n\nTotal: R$ ${totalCarrinho.toFixed(2)}\nForma de pagamento: ${formaLabel}\n(empresa: ${empresaId})\n\nPor favor, encaminhe o comprovante/orientação via WhatsApp.`

      if (!openWhatsAppChat(whatsappLive ?? whatsappDestino, texto)) {
        alert('WhatsApp da empresa não configurado.')
        return
      }
      void registrarUsoPreLiberacao({
        tipo: 'compra_ticket',
        descricao: `Carrinho ${carrinho.length} item(ns) — ${empresaNome}`,
        empresaId,
      })
      handleFechar()
    } finally {
      setConfirmando(false)
    }
  }

  const voltarDoDetalhe = () => {
    if (abrirDiretoNoDetalhe) {
      handleFechar()
      return
    }
    setPasso(1)
    setSelecionado(null)
  }

  const voltarDoPagamento = () => {
    setPasso(2)
  }

  const onFavoritoChange = (id: string, salvo: boolean) => {
    setFavTickets((prev) => {
      const next = new Set(prev)
      if (salvo) next.add(id)
      else next.delete(id)
      return next
    })
  }

  if (!isOpen) return null

  const cabecalhoEmpresa = ({
    acaoDireita,
  }: {
    acaoDireita: 'fechar' | 'voltar'
  }) => (
    <header
      className="shrink-0 border-b border-white/15 bg-[#0097b2]"
      style={{ paddingTop: 'max(0.1rem, env(safe-area-inset-top, 0px))' }}
    >
      <div className="relative px-4 pb-2 pt-1 pr-2">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              handleFechar()
              router.push(`/empresa/${empresaId}`)
            }}
            className="h-11 w-11 shrink-0 overflow-hidden rounded-md border border-white/80 bg-white/20"
            aria-label={`Ver página de ${nomeLive || empresaNome}`}
          >
            {fotoLive ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fotoLive} alt="" className="h-full w-full object-cover" />
            ) : null}
          </button>
          <div className="min-w-0 flex-1 pr-9">
            <p className="truncate text-sm font-bold leading-tight text-white">
              {nomeLive || empresaNome}
            </p>
            {usernameExibir ? (
              <p className="mt-0.5 flex max-w-full items-center gap-1 truncate text-xs leading-tight text-white/85">
                <span className="inline-flex h-3 w-3 shrink-0 items-center justify-center" aria-hidden>
                  <BadgeCheck
                    className={`h-3 w-3 text-white ${verificadaLive ? 'visible' : 'invisible'}`}
                    fill="currentColor"
                    stroke="#0097b2"
                    strokeWidth={2}
                  />
                </span>
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
          {acaoDireita === 'fechar' ? (
            <button
              type="button"
              onClick={handleFechar}
              className="absolute right-0.5 top-0 shrink-0 rounded-lg p-1.5 text-white hover:bg-white/15"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              onClick={voltarDoDetalhe}
              className="absolute right-0.5 top-0 shrink-0 rounded-lg p-1.5 text-white hover:bg-white/15"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </button>
          )}
        </div>
      </div>
    </header>
  )

  const cabecalhoSecundario = (titulo: string, onVoltar: () => void) => (
    <header
      className="flex shrink-0 items-center gap-2 border-b border-gray-100 bg-white px-3 pb-2"
      style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top, 0px))' }}
    >
      <button
        type="button"
        onClick={onVoltar}
        className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
        aria-label="Voltar"
      >
        <ArrowLeft className="h-5 w-5" aria-hidden />
      </button>
      <p className="min-w-0 flex-1 truncate pr-10 text-center text-sm font-bold text-[#001f3f]">
        {titulo}
      </p>
    </header>
  )

  return (
    <>
      <div
        className="fixed inset-0 z-[140] flex flex-col bg-white"
        role="dialog"
        aria-modal="true"
        aria-label="Tickets"
        data-modal-scroll-lock-scrollable
      >
        {passo === 1 && !abrirDiretoNoDetalhe
          ? cabecalhoEmpresa({ acaoDireita: 'fechar' })
          : passo === 2
            ? cabecalhoEmpresa({ acaoDireita: 'voltar' })
            : cabecalhoSecundario('Pagamento', voltarDoPagamento)}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <p className="p-6 text-center text-sm text-gray-400">Carregando…</p>
          ) : passo === 1 ? (
            <div className="space-y-4 p-4">
              {lista.length === 0 ? (
                <p className="text-center text-sm text-gray-500">
                  Nenhum atrativo disponível no momento.
                </p>
              ) : (
                <ul className="flex flex-col gap-4">
                  {lista.map((item) => (
                    <li key={item.id}>
                      <MiniCardLista
                        item={item}
                        visitanteId={visitanteId}
                        favoritoInicial={favTickets.has(item.id)}
                        onFavoritoChange={(salvo) => onFavoritoChange(item.id, salvo)}
                        onVerTicket={() => {
                          setSelecionado(item)
                          setPasso(2)
                        }}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : passo === 2 && selecionado ? (
            <div className="p-4">
              <DetalheTicket
                item={selecionado}
                regrasMeia={regrasMeia}
                visitanteId={visitanteId}
                favoritoInicial={favTickets.has(selecionado.id)}
                onFavoritoChange={(salvo) => onFavoritoChange(selecionado.id, salvo)}
                onComprar={(qi, qm) => montarCarrinhoDoTicket(selecionado, qi, qm)}
                whatsappComercial={whatsappLive}
                usernameExibir={usernameExibir}
                empresaId={empresaId}
                empresaNome={nomeLive}
                perfilEhEmpresa={perfilEhEmpresa}
                perfilEhProfissional={perfilEhProfissional}
              />
            </div>
          ) : passo === 2 && !selecionado && !loading ? (
            <div className="space-y-3 p-6 text-center">
              <Ticket className="mx-auto h-8 w-8 text-gray-300" aria-hidden />
              <p className="text-sm text-gray-500">Ticket não encontrado.</p>
              {!abrirDiretoNoDetalhe ? (
                <button
                  type="button"
                  onClick={() => setPasso(1)}
                  className="text-sm font-semibold text-[#0097b2]"
                >
                  Ver todos os tickets
                </button>
              ) : null}
            </div>
          ) : (
            <div className="flex min-h-full flex-col">
              <div className="flex-1 space-y-4 p-4">
                {carrinho.length === 0 ? (
                  <p className="text-center text-sm text-gray-500">Nenhum item selecionado.</p>
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
                              className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm text-gray-900 ${
                                ativo ? 'border-[#0097b2] bg-[#0097b2]/10' : 'border-gray-200 bg-white'
                              }`}
                            >
                              <span
                                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                  ativo ? 'border-[#0097b2] bg-[#0097b2]' : 'border-gray-300'
                                }`}
                              >
                                {ativo ? (
                                  <Check className="h-2.5 w-2.5 text-white" aria-hidden />
                                ) : null}
                              </span>
                              <span className="text-gray-900">{op.label}</span>
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

              <div className="shrink-0 border-t border-gray-100 p-4">
                <button
                  type="button"
                  disabled={confirmando || carrinho.length === 0}
                  onClick={() => void handleConfirmar()}
                  className="w-full rounded-xl bg-[#00D443] py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  {confirmando ? 'Abrindo WhatsApp…' : 'Confirmar compra'}
                </button>
              </div>
            </div>
          )}
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
