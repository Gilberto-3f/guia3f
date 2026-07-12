'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BadgeCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Check,
  ArrowLeft,
  ArrowRight,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useRouter } from '@/i18n/navigation'
import CheckVerificado from '@/components/CheckVerificado'
import { contaVerificadaDocumentacao } from '@/lib/contaVerificada'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import { useGateComprasReservas } from '@/lib/useGateComprasReservas'
import PopupAvisoBloqueioConta from '@/components/PopupAvisoBloqueioConta'
import PopupAvisoReservaHospedagemConflito from '@/components/PopupAvisoReservaHospedagemConflito'
import { registrarUsoPreLiberacao } from '@/lib/registrarUsoPreLiberacao'
import { notificarBadgeCanais } from '@/lib/canais-badge-events'
import {
  algumaReservaPendenteConflitaComPeriodo,
  buscarReservaPendenteEmpresa,
  listarReservasPendentesOutrasEmpresas,
} from '@/lib/reservaHospedagem'
import { useModalScrollLock } from '@/lib/useModalScrollLock'
import {
  formatarValorDiaria,
  parseComodidadesExtras,
  parseComodidadesPadrao,
  parseFormasPagamento,
  rotuloAcomodacaoResumo,
  rotuloAcomodacaoResumoCurto,
  rotuloCategoriaImovel,
  rotuloCategoriaImovelCurto,
  rotuloCategoriaParticular,
  rotuloCategoriaParticularCurto,
  tipoCategoriaImovel,
  rotuloOpcaoCompartilhada,
  rotuloOpcaoCompartilhadaCurto,
  COMODIDADES_EXTRAS_LISTA,
  COMODIDADES_PADRAO_CAMPOS,
  ITENS_PARTICULARES,
  REFEICOES_EXTRAS,
  MOEDAS_DINHEIRO,
  type ComodidadesExtras,
  type ComodidadesPadrao,
  type FormasPagamentoHospedagem,
  type HospedagemAcomodacaoRow,
} from '@/lib/hospedagemAcomodacoesCatalogo'
import {
  carregarPeriodosOcupacaoAcomodacao,
  diaOcupado,
  periodoDisponivel,
  statusAcomodacaoHoje,
  type PeriodoOcupacao,
} from '@/lib/hospedagemCalendario'
import CalendarioAcomodacao from '@/components/hospedagem/CalendarioAcomodacao'
import ChevronPasta from '@/app/[locale]/(app-shell)/empresa/components/menu-empresa/hospedagem/ChevronPasta'

const COR = '#0097b2'
const VERDE = '#00D443'

type Props = {
  isOpen: boolean
  onClose: () => void
  empresaId: string
  empresaNome: string
  empresaUsername?: string | null
  empresaFotoUrl?: string | null
  notaMedia?: number | null
}

type AnfitriaoInfo = {
  nome: string
  username: string
  foto: string | null
  usuarioId: string | null
  verificado: boolean
}

type PoliticasInfo = {
  checkin_hora: string
  checkout_hora: string
  caucao_exige: boolean
  caucao_diarias: number | null
  cancelamento_gratuito: boolean
  cancelamento_dias_antes: number | null
  cancelamento_descricao: string
  restricao_idade: boolean
  restricao_idade_obs: string | null
  formas_pagamento: FormasPagamentoHospedagem
}

function mapAcomodacao(raw: Record<string, unknown>): HospedagemAcomodacaoRow {
  return {
    id: String(raw.id),
    empresa_id: String(raw.empresa_id),
    categoria_imovel: String(raw.categoria_imovel),
    categoria_particular: raw.categoria_particular != null ? String(raw.categoria_particular) : null,
    opcao_compartilhada: raw.opcao_compartilhada != null ? String(raw.opcao_compartilhada) : null,
    capacidade_pessoas: Number(raw.capacidade_pessoas) || 1,
    valor_diaria: Number(raw.valor_diaria) || 0,
    fotos: Array.isArray(raw.fotos) ? raw.fotos.map(String) : [],
    comodidades_padrao: parseComodidadesPadrao(raw.comodidades_padrao),
    comodidades_extras: parseComodidadesExtras(raw.comodidades_extras),
  }
}

function formatarHora(h: string): string {
  return String(h ?? '').slice(0, 5)
}

function formatarDataBr(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('pt-BR')
}

function formasDisponiveis(fp: FormasPagamentoHospedagem): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = []
  if (fp.dinheiro) out.push({ value: 'dinheiro', label: 'Dinheiro' })
  if (fp.pix) out.push({ value: 'pix', label: 'PIX' })
  if (fp.cartao_credito) out.push({ value: 'cartao_credito', label: 'Cartão de Crédito' })
  if (fp.cartao_debito) out.push({ value: 'cartao_debito', label: 'Cartão de Débito' })
  return out
}

function textoSimNao(v: boolean | null | undefined): string {
  if (v === true) return 'Sim'
  if (v === false) return 'Não'
  return '—'
}

export default function DrawerReservaHospedagem({
  isOpen,
  onClose,
  empresaId,
  empresaNome,
  empresaUsername = null,
  empresaFotoUrl = null,
  notaMedia = null,
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

  const [passo, setPasso] = useState(1)
  const [carregando, setCarregando] = useState(false)
  const [acomodacoes, setAcomodacoes] = useState<HospedagemAcomodacaoRow[]>([])
  const [statusMap, setStatusMap] = useState<
    Record<string, 'disponivel' | 'ocupado' | 'indisponivel_em_breve'>
  >({})
  const [periodosMap, setPeriodosMap] = useState<Record<string, PeriodoOcupacao[]>>({})
  const [politicas, setPoliticas] = useState<PoliticasInfo | null>(null)
  const [anfitriao, setAnfitriao] = useState<AnfitriaoInfo | null>(null)
  const [anfitriaoAberto, setAnfitriaoAberto] = useState(false)
  const [empresaVerificada, setEmpresaVerificada] = useState(false)
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null)
  const [fotoIdx, setFotoIdx] = useState(0)
  const [checkin, setCheckin] = useState('')
  const [checkout, setCheckout] = useState('')
  const [calAberto, setCalAberto] = useState<'checkin' | 'checkout' | null>(null)
  const [numHospedes, setNumHospedes] = useState(1)
  const [formaPagamento, setFormaPagamento] = useState('')
  const [loading, setLoading] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [reservaPendente, setReservaPendente] = useState(false)
  const [mostrarAvisoConflito, setMostrarAvisoConflito] = useState(false)
  const [conflitoReconhecido, setConflitoReconhecido] = useState(false)
  const [chevronPadrao, setChevronPadrao] = useState(false)
  const [chevronExtra, setChevronExtra] = useState(false)
  const [chevronPoliticas, setChevronPoliticas] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [painelVisivel, setPainelVisivel] = useState(false)
  const [painelAberto, setPainelAberto] = useState(false)
  const touchFotoX = useRef<number | null>(null)

  useModalScrollLock(isOpen || painelVisivel)

  useEffect(() => {
    if (isOpen) {
      setPainelVisivel(true)
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setPainelAberto(true))
      })
      return () => cancelAnimationFrame(id)
    }
    setPainelAberto(false)
    const t = window.setTimeout(() => setPainelVisivel(false), 300)
    return () => window.clearTimeout(t)
  }, [isOpen])

  const selecionada = useMemo(
    () => acomodacoes.find((a) => a.id === selecionadaId) ?? null,
    [acomodacoes, selecionadaId],
  )

  const periodosSel = selecionadaId ? periodosMap[selecionadaId] ?? [] : []

  const carregar = useCallback(async () => {
    if (!isOpen || !empresaId) return
    setCarregando(true)
    setErro(null)
    try {
      const { data: emp } = await supabase
        .from('empresas')
        .select(
          'foto_url, nome_fantasia, nome_usuario, profissional_vinculado_id, nota_media, docs_verificado, status',
        )
        .eq('id', empresaId)
        .maybeSingle()

      setEmpresaVerificada(contaVerificadaDocumentacao('empresa', emp))

      if (emp?.profissional_vinculado_id) {
        const { data: prof } = await supabase
          .from('profissionais')
          .select('nome_completo, nome_usuario, foto_perfil_url, foto_url, usuario_id, docs_verificado, status')
          .eq('id', emp.profissional_vinculado_id)
          .maybeSingle()
        if (prof) {
          setAnfitriao({
            nome: String(prof.nome_completo || 'Anfitrião'),
            username: String(prof.nome_usuario || ''),
            foto:
              prof.foto_perfil_url != null
                ? String(prof.foto_perfil_url)
                : prof.foto_url != null
                  ? String(prof.foto_url)
                  : null,
            usuarioId: prof.usuario_id != null ? String(prof.usuario_id) : null,
            verificado: contaVerificadaDocumentacao('profissional', prof),
          })
        }
      } else {
        setAnfitriao(null)
      }

      const { data: acoms } = await supabase
        .from('hospedagem_acomodacoes')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: true })

      const lista = (acoms ?? []).map((r) => mapAcomodacao(r as Record<string, unknown>))
      setAcomodacoes(lista)

      const st: Record<string, 'disponivel' | 'ocupado'> = {}
      const pm: Record<string, PeriodoOcupacao[]> = {}
      await Promise.all(
        lista.map(async (a) => {
          const periodos = await carregarPeriodosOcupacaoAcomodacao(supabase, a.id)
          pm[a.id] = periodos
          st[a.id] = statusAcomodacaoHoje(periodos)
        }),
      )
      setPeriodosMap(pm)
      setStatusMap(st)

      const { data: pol } = await supabase
        .from('hospedagem_politicas')
        .select('*')
        .eq('empresa_id', empresaId)
        .maybeSingle()

      if (pol) {
        setPoliticas({
          checkin_hora: formatarHora(String(pol.checkin_hora ?? '')),
          checkout_hora: formatarHora(String(pol.checkout_hora ?? '')),
          caucao_exige: Boolean(pol.caucao_exige),
          caucao_diarias: pol.caucao_diarias != null ? Number(pol.caucao_diarias) : null,
          cancelamento_gratuito: Boolean(pol.cancelamento_gratuito),
          cancelamento_dias_antes:
            pol.cancelamento_dias_antes != null ? Number(pol.cancelamento_dias_antes) : null,
          cancelamento_descricao: String(pol.cancelamento_descricao ?? ''),
          restricao_idade: Boolean(pol.restricao_idade),
          restricao_idade_obs:
            pol.restricao_idade_obs != null ? String(pol.restricao_idade_obs) : null,
          formas_pagamento: parseFormasPagamento(pol.formas_pagamento),
        })
      } else {
        setPoliticas(null)
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session?.user?.id) {
        const pendente = await buscarReservaPendenteEmpresa(supabase, session.user.id, empresaId)
        setReservaPendente(Boolean(pendente))
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar.')
    } finally {
      setCarregando(false)
    }
  }, [isOpen, empresaId])

  useEffect(() => {
    if (!isOpen) {
      setPasso(1)
      setSelecionadaId(null)
      setFotoIdx(0)
      setCheckin('')
      setCheckout('')
      setCalAberto(null)
      setNumHospedes(1)
      setFormaPagamento('')
      setSucesso(false)
      setMostrarAvisoConflito(false)
      setConflitoReconhecido(false)
      setChevronPadrao(false)
      setChevronExtra(false)
      setChevronPoliticas(false)
      setAnfitriaoAberto(false)
      return
    }
    void carregar()
  }, [isOpen, carregar])

  const noites = useMemo(() => {
    if (!checkin || !checkout) return 0
    const inicio = new Date(`${checkin}T12:00:00`)
    const fim = new Date(`${checkout}T12:00:00`)
    return Math.max(0, Math.ceil((fim.getTime() - inicio.getTime()) / 86400000))
  }, [checkin, checkout])

  const total = (selecionada ? Number(selecionada.valor_diaria) : 0) * noites
  const formas = politicas ? formasDisponiveis(politicas.formas_pagamento) : []

  const handleFechar = () => onClose()

  const enviarSolicitacao = async () => {
    if (!selecionada) return
    setLoading(true)
    setErro(null)
    try {
      const res = await fetch('/api/reservas-hospedagem/solicitar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          empresa_id: empresaId,
          acomodacao_id: selecionada.id,
          data_checkin: checkin,
          data_checkout: checkout,
          noites,
          valor_estimado: total,
          forma_pagamento: formaPagamento,
          numero_hospedes: numHospedes,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        setErro(json.error ?? 'Não foi possível enviar a solicitação.')
        return
      }
      void registrarUsoPreLiberacao({
        tipo: 'reserva_hospedagem',
        descricao: `Solicitação hospedagem ${noites} noite(s) — ${empresaNome}`,
        empresaId,
      })
      notificarBadgeCanais()
      setSucesso(true)
      setReservaPendente(true)
    } finally {
      setLoading(false)
    }
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
    if (reservaPendente || !selecionada) return
    if (!checkin || !checkout || noites <= 0) {
      setErro('Selecione check-in e check-out válidos.')
      return
    }
    if (!periodoDisponivel(periodosSel, checkin, checkout)) {
      setErro('As datas escolhidas não estão disponíveis para esta acomodação.')
      return
    }
    if (numHospedes < 1 || numHospedes > selecionada.capacidade_pessoas) {
      setErro(`Número de hóspedes deve ser entre 1 e ${selecionada.capacidade_pessoas}.`)
      return
    }
    if (!formaPagamento) {
      setErro('Selecione a forma de pagamento.')
      return
    }

    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.user?.id) {
      setErro('Faça login para continuar.')
      return
    }

    const outras = await listarReservasPendentesOutrasEmpresas(supabase, session.user.id, empresaId)
    if (algumaReservaPendenteConflitaComPeriodo(outras, checkin, checkout) && !conflitoReconhecido) {
      setMostrarAvisoConflito(true)
      return
    }

    await enviarSolicitacao()
  }

  if (!painelVisivel) return null

  const avatarEmpresa = empresaFotoUrl
  const nota = notaMedia != null && Number(notaMedia) > 0 ? Number(notaMedia).toFixed(1) : null
  const mostrarRodapePassos = !carregando && !sucesso && !reservaPendente && (passo === 2 || passo === 3)

  const Cabecalho = (
    <header
      className="shrink-0 border-b border-white/15 bg-[#0097b2]"
      style={{ paddingTop: 'max(0.15rem, env(safe-area-inset-top, 0px))' }}
    >
      <div className="relative px-5 pb-3 pt-1.5 pr-3">
        <div className="flex items-start gap-3.5">
          <div className="h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-md border-2 border-white bg-white/20">
            {avatarEmpresa ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarEmpresa} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="min-w-0 flex-1 pr-8">
            <p className="truncate text-base font-bold leading-tight text-white">{empresaNome}</p>
            {empresaUsername ? (
              <p className="inline-flex max-w-full items-center gap-1 truncate text-sm leading-tight text-white/80">
                {empresaVerificada ? (
                  <BadgeCheck
                    className="h-3.5 w-3.5 shrink-0 text-white"
                    fill="currentColor"
                    stroke="#0097b2"
                    strokeWidth={2}
                    aria-hidden
                  />
                ) : null}
                <span className="truncate">@{empresaUsername}</span>
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => setAnfitriaoAberto((v) => !v)}
              className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-white"
            >
              Anfitrião
              <ChevronDown
                className={`h-4 w-4 transition-transform ${anfitriaoAberto ? 'rotate-180' : ''}`}
                aria-hidden
              />
            </button>
          </div>
          <button
            type="button"
            onClick={handleFechar}
            className="absolute right-1 top-0.5 shrink-0 rounded-lg p-1.5 text-white hover:bg-white/15"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        {anfitriaoAberto && anfitriao ? (
          <button
            type="button"
            onClick={() => {
              if (!anfitriao.usuarioId) return
              handleFechar()
              router.push(`/perfil/${anfitriao.usuarioId}`)
            }}
            className="mt-2.5 flex w-full items-center gap-3 rounded-xl bg-white px-3 py-2.5 text-left shadow-sm transition-opacity hover:opacity-95"
          >
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 border-[#0097b2] bg-[#0097b2]/10">
              {anfitriao.foto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={anfitriao.foto} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="break-words text-base font-bold leading-snug text-[#0097b2]">
                {anfitriao.nome}
              </p>
              {anfitriao.username ? (
                <p className="mt-0.5 inline-flex max-w-full items-center gap-1 break-words text-sm leading-snug text-[#0097b2]/80">
                  {anfitriao.verificado ? <CheckVerificado variant="profissional" /> : null}
                  <span>@{anfitriao.username}</span>
                </p>
              ) : null}
            </div>
          </button>
        ) : null}
      </div>
    </header>
  )

  const renderComodidadePadrao = (padrao: ComodidadesPadrao) => (
    <ul className="space-y-1.5 text-sm text-gray-700">
      {COMODIDADES_PADRAO_CAMPOS.map((c) => {
        if (c.tipo === 'texto') {
          return (
            <li key={c.key}>
              {c.label}: <strong>{padrao.capacidade_maxima_hospedes || '—'}</strong>
            </li>
          )
        }
        if (c.tipo === 'banheiro') {
          return (
            <li key={c.key}>
              Banheiro:{' '}
              <strong>
                {padrao.banheiro === 'particular'
                  ? 'Particular'
                  : padrao.banheiro === 'compartilhado'
                    ? 'Compartilhado'
                    : '—'}
              </strong>
            </li>
          )
        }
        if (c.tipo === 'fumantes') {
          return (
            <li key={c.key}>
              Fumantes:{' '}
              <strong>
                {padrao.fumantes === 'livre'
                  ? 'Livre'
                  : padrao.fumantes === 'proibido'
                    ? 'Proibido fumar'
                    : '—'}
              </strong>
            </li>
          )
        }
        if (c.tipo === 'pet') {
          return (
            <li key={c.key}>
              Pet Friendly: <strong>{textoSimNao(padrao.pet_friendly)}</strong>
              {padrao.pet_friendly && padrao.pet_friendly_obs
                ? ` — ${padrao.pet_friendly_obs}`
                : ''}
            </li>
          )
        }
        return (
          <li key={c.key}>
            {c.label}: <strong>{textoSimNao(padrao[c.key] as boolean | null)}</strong>
          </li>
        )
      })}
    </ul>
  )

  const renderExtras = (extras: ComodidadesExtras) => {
    const labels = [
      ...extras.selecionados.map(
        (v) => COMODIDADES_EXTRAS_LISTA.find((x) => x.value === v)?.label ?? v,
      ),
      ...extras.itens_particulares.map(
        (v) => ITENS_PARTICULARES.find((x) => x.value === v)?.label ?? v,
      ),
      ...extras.refeicoes_extras.map(
        (v) => REFEICOES_EXTRAS.find((x) => x.value === v)?.label ?? v,
      ),
    ]
    if (extras.outros.trim()) labels.push(extras.outros.trim())
    if (labels.length === 0) return <p className="text-sm text-gray-500">Nenhuma comodidade extra.</p>
    return (
      <ul className="list-disc space-y-1 pl-4 text-sm text-gray-700">
        {labels.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    )
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-[70] flex flex-col bg-white transition-transform duration-300 ease-out ${
          painelAberto ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
      >
        {Cabecalho}

        <div
          className="min-h-0 flex-1 overflow-y-auto pb-4"
          data-modal-scroll-lock-scrollable
        >
          {carregando ? (
            <p className="p-6 text-center text-sm text-gray-500">Carregando…</p>
          ) : reservaPendente && !sucesso ? (
            <div className="space-y-3 p-6 text-center">
              <p className="text-lg font-bold" style={{ color: COR }}>
                Reserva Enviada
              </p>
              <p className="text-sm text-gray-700">
                Você já possui uma solicitação pendente nesta hospedagem. Aguarde a confirmação do
                anfitrião.
              </p>
            </div>
          ) : sucesso ? (
            <div className="space-y-3 p-6 text-center">
              <p className="text-lg font-bold" style={{ color: COR }}>
                Solicitação enviada!
              </p>
              <p className="text-sm text-gray-700">
                Sua reserva foi enviada para <strong>{empresaNome}</strong>. As datas ficam
                bloqueadas até a confirmação do anfitrião.
              </p>
            </div>
          ) : passo === 1 ? (
            <div className="space-y-2 p-4 pt-2">
              <h2 className="text-center text-lg font-bold uppercase tracking-wide" style={{ color: COR }}>
                ESCOLHA SUA ACOMODAÇÃO
              </h2>
              {acomodacoes.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Nenhuma acomodação cadastrada ainda. Não é possível avançar.
                </p>
              ) : (
                <>
                <div className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory">
                  {acomodacoes.map((a, idx) => {
                    const st = statusMap[a.id] ?? 'disponivel'
                    const capa = a.fotos[0]
                    const catAcomodacao =
                      tipoCategoriaImovel(a.categoria_imovel) === 'particular'
                        ? rotuloCategoriaParticularCurto(a.categoria_particular)
                        : rotuloOpcaoCompartilhadaCurto(a.opcao_compartilhada)
                    const qtdPessoas = Number(a.capacidade_pessoas) || 0
                    const rotuloAcomodacaoComCapacidade = catAcomodacao
                      ? qtdPessoas > 0
                        ? `${catAcomodacao} · ${qtdPessoas} ${qtdPessoas === 1 ? 'pessoa' : 'pessoas'}`
                        : catAcomodacao
                      : qtdPessoas > 0
                        ? `${qtdPessoas} ${qtdPessoas === 1 ? 'pessoa' : 'pessoas'}`
                        : null
                    const disponivel = st === 'disponivel'
                    const indisponivelEmBreve = st === 'indisponivel_em_breve'
                    return (
                      <article
                        key={a.id}
                        className={`w-[78%] max-w-[280px] shrink-0 snap-start overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm ${
                          idx === 0 ? 'ml-1' : ''
                        }`}
                      >
                        <p className="px-3 pt-3 text-center text-sm font-semibold text-[#001f3f]">
                          {rotuloCategoriaImovelCurto(a.categoria_imovel)}
                        </p>
                        <div className="mt-2 aspect-[4/3] bg-gray-100">
                          {capa ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={capa} alt="" className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <div className="space-y-2 p-3">
                          {rotuloAcomodacaoComCapacidade ? (
                            <p className="line-clamp-2 text-sm font-semibold text-[#001f3f]">
                              {rotuloAcomodacaoComCapacidade}
                            </p>
                          ) : null}
                          <p className="text-sm font-bold" style={{ color: COR }}>
                            {formatarValorDiaria(a.valor_diaria)}
                            <span className="font-normal text-gray-500"> / diária</span>
                          </p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <p
                              className={`inline-flex max-w-full items-center gap-1 text-xs font-bold ${
                                indisponivelEmBreve ? 'whitespace-nowrap' : ''
                              } ${
                                disponivel
                                  ? 'text-[#00D443]'
                                  : indisponivelEmBreve
                                    ? 'text-[#0097b2]'
                                    : 'text-red-600'
                              }`}
                            >
                              {disponivel ? (
                                <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={3} aria-hidden />
                              ) : indisponivelEmBreve ? null : (
                                <X className="h-3.5 w-3.5 shrink-0" strokeWidth={3} aria-hidden />
                              )}
                              {disponivel
                                ? 'Disponível'
                                : indisponivelEmBreve
                                  ? 'Indisponível em breve'
                                  : 'Ocupado'}
                            </p>
                            {nota && !indisponivelEmBreve ? (
                              <p className="inline-flex items-center gap-1 text-xs font-bold text-amber-500">
                                ★ {nota}
                              </p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelecionadaId(a.id)
                              setFotoIdx(0)
                              setPasso(2)
                              setChevronPadrao(false)
                              setChevronExtra(false)
                              setChevronPoliticas(false)
                            }}
                            className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white"
                            style={{ backgroundColor: COR }}
                          >
                            <Eye className="h-4 w-4" aria-hidden />
                            VER ACOMODAÇÃO
                          </button>
                        </div>
                      </article>
                    )
                  })}
                </div>
                <div className="pt-1 text-center">
                  <p className="text-sm font-bold text-gray-500">ATENÇÃO</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-gray-500">
                    Ao reservar uma acomodação aqui você concorda automaticamente com as regras e
                    políticas desse anfitrião.
                  </p>
                </div>
                </>
              )}
            </div>
          ) : passo === 2 && selecionada ? (
            <div className="space-y-2 pb-2">
              <p className="px-4 pt-3 text-center text-sm font-semibold text-[#001f3f]">
                {rotuloCategoriaImovel(selecionada.categoria_imovel)}
              </p>
              <div className="relative px-6">
                <div
                  className="aspect-[16/10] w-full touch-pan-y overflow-hidden rounded-xl bg-gray-100"
                  onTouchStart={(e) => {
                    touchFotoX.current = e.touches[0]?.clientX ?? null
                  }}
                  onTouchEnd={(e) => {
                    const start = touchFotoX.current
                    touchFotoX.current = null
                    if (start == null || selecionada.fotos.length <= 1) return
                    const end = e.changedTouches[0]?.clientX
                    if (end == null) return
                    const dx = end - start
                    if (Math.abs(dx) < 40) return
                    if (dx < 0) {
                      setFotoIdx((i) => (i + 1) % selecionada.fotos.length)
                    } else {
                      setFotoIdx((i) => (i - 1 + selecionada.fotos.length) % selecionada.fotos.length)
                    }
                  }}
                >
                  {selecionada.fotos[fotoIdx] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selecionada.fotos[fotoIdx]}
                      alt=""
                      className="pointer-events-none h-full w-full object-cover"
                      draggable={false}
                    />
                  ) : null}
                </div>
                {selecionada.fotos.length > 1 ? (
                  <>
                    <button
                      type="button"
                      className="absolute left-0 top-1/2 z-10 flex w-6 -translate-y-1/2 items-center justify-center"
                      style={{ color: COR }}
                      onClick={() =>
                        setFotoIdx((i) => (i - 1 + selecionada.fotos.length) % selecionada.fotos.length)
                      }
                      aria-label="Foto anterior"
                    >
                      <ChevronLeft className="h-6 w-6" strokeWidth={2.5} aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="absolute right-0 top-1/2 z-10 flex w-6 -translate-y-1/2 items-center justify-center"
                      style={{ color: COR }}
                      onClick={() => setFotoIdx((i) => (i + 1) % selecionada.fotos.length)}
                      aria-label="Próxima foto"
                    >
                      <ChevronRight className="h-6 w-6" strokeWidth={2.5} aria-hidden />
                    </button>
                  </>
                ) : null}
              </div>

              <div className="space-y-4 px-4">
              <div className="text-center">
                <p className="text-sm text-gray-800">
                  {tipoCategoriaImovel(selecionada.categoria_imovel) === 'particular'
                    ? rotuloCategoriaParticular(selecionada.categoria_particular)
                    : rotuloOpcaoCompartilhada(selecionada.opcao_compartilhada)}
                </p>
                <p className="mt-1 flex flex-wrap items-center justify-center gap-x-3 text-lg font-bold" style={{ color: COR }}>
                  <span>{formatarValorDiaria(selecionada.valor_diaria)}</span>
                  {nota ? <span className="text-lg font-bold text-amber-500">★ {nota}</span> : null}
                </p>
              </div>

              <div className="space-y-2 pb-0">
                <ChevronPasta
                  titulo="Comodidades Padrão"
                  aberto={chevronPadrao}
                  onToggle={() => setChevronPadrao((v) => !v)}
                >
                  {renderComodidadePadrao(selecionada.comodidades_padrao)}
                </ChevronPasta>
                <ChevronPasta
                  titulo="Comodidades Extra"
                  aberto={chevronExtra}
                  onToggle={() => setChevronExtra((v) => !v)}
                >
                  {renderExtras(selecionada.comodidades_extras)}
                </ChevronPasta>
                <ChevronPasta
                  titulo="Políticas da casa"
                  aberto={chevronPoliticas}
                  onToggle={() => setChevronPoliticas((v) => !v)}
                >
                  {politicas ? (
                    <ul className="space-y-1.5 text-sm text-gray-700">
                      <li>
                        Check-in: <strong>{politicas.checkin_hora || '—'}</strong> · Check-out:{' '}
                        <strong>{politicas.checkout_hora || '—'}</strong>
                      </li>
                      <li>
                        Caução:{' '}
                        <strong>
                          {politicas.caucao_exige
                            ? `Sim (${politicas.caucao_diarias ?? '—'} diária(s))`
                            : 'Não'}
                        </strong>
                      </li>
                      <li>
                        Cancelamento:{' '}
                        <strong>
                          {politicas.cancelamento_gratuito
                            ? `Gratuito (${politicas.cancelamento_dias_antes ?? '—'} dias antes)`
                            : 'Não gratuito'}
                        </strong>
                      </li>
                      <li>{politicas.cancelamento_descricao}</li>
                      <li>
                        Restrição de idade:{' '}
                        <strong>{politicas.restricao_idade ? 'Sim' : 'Não'}</strong>
                        {politicas.restricao_idade_obs
                          ? ` — ${politicas.restricao_idade_obs}`
                          : ''}
                      </li>
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500">Políticas ainda não cadastradas.</p>
                  )}
                </ChevronPasta>
              </div>
              </div>
            </div>
          ) : passo === 3 && selecionada ? (
            <div className="space-y-3 p-4 pb-2">
              <div className="flex gap-3 rounded-xl border border-gray-200 p-3">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                  {selecionada.fotos[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selecionada.fotos[0]} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-[#001f3f]">
                    <span>{rotuloCategoriaImovelCurto(selecionada.categoria_imovel)}</span>
                    {nota ? <span className="font-bold text-amber-500">★ {nota}</span> : null}
                  </p>
                  <p className="text-sm font-semibold text-[#001f3f]">
                    {(() => {
                      const catAcomodacao =
                        tipoCategoriaImovel(selecionada.categoria_imovel) === 'particular'
                          ? rotuloCategoriaParticularCurto(selecionada.categoria_particular)
                          : rotuloOpcaoCompartilhadaCurto(selecionada.opcao_compartilhada)
                      const qtd = Number(selecionada.capacidade_pessoas) || 0
                      if (catAcomodacao && qtd > 0) {
                        return `${catAcomodacao} · ${qtd} ${qtd === 1 ? 'pessoa' : 'pessoas'}`
                      }
                      return catAcomodacao || (qtd > 0 ? `${qtd} ${qtd === 1 ? 'pessoa' : 'pessoas'}` : '—')
                    })()}
                  </p>
                  <p className="text-sm font-bold" style={{ color: COR }}>
                    {formatarValorDiaria(selecionada.valor_diaria)} / diária
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-bold text-[#001f3f]">Pré-cadastro do Hóspede</p>
                <div className="space-y-3">
                  <div>
                    <p className="mb-1 text-xs font-semibold text-gray-500">Check-in</p>
                    <button
                      type="button"
                      onClick={() => setCalAberto(calAberto === 'checkin' ? null : 'checkin')}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left text-sm text-[#001f3f]"
                    >
                      {checkin ? formatarDataBr(checkin) : 'Selecionar data'}
                    </button>
                    {calAberto === 'checkin' ? (
                      <div className="mt-2">
                        <CalendarioAcomodacao
                          periodos={periodosSel}
                          modoSelecao
                          selecao={checkin ? new Set([checkin]) : new Set()}
                          onToggleDia={(iso) => {
                            const d = new Date()
                            const hojeIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                            if (iso < hojeIso) return
                            if (diaOcupado(periodosSel, iso)) return
                            setCheckin(iso)
                            setCheckout('')
                            setCalAberto(null)
                            setConflitoReconhecido(false)
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold text-gray-500">Check-out</p>
                    <button
                      type="button"
                      onClick={() => setCalAberto(calAberto === 'checkout' ? null : 'checkout')}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left text-sm text-[#001f3f] disabled:opacity-50"
                      disabled={!checkin}
                    >
                      {checkout ? formatarDataBr(checkout) : 'Selecionar data'}
                    </button>
                    {calAberto === 'checkout' && checkin ? (
                      <div className="mt-2">
                        <CalendarioAcomodacao
                          periodos={periodosSel}
                          modoSelecao
                          selecao={checkout ? new Set([checkout]) : new Set()}
                          onToggleDia={(iso) => {
                            if (iso <= checkin) return
                            if (!periodoDisponivel(periodosSel, checkin, iso)) return
                            setCheckout(iso)
                            setCalAberto(null)
                            setConflitoReconhecido(false)
                          }}
                        />
                      </div>
                    ) : null}
                  </div>

                  <label className="block text-xs font-semibold text-gray-500">
                    Número de hóspedes
                    <select
                      value={numHospedes}
                      onChange={(e) => setNumHospedes(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-[#001f3f]"
                    >
                      {Array.from({ length: selecionada.capacidade_pessoas }, (_, i) => i + 1).map(
                        (n) => (
                          <option key={n} value={n}>
                            {n} {n === 1 ? 'pessoa' : 'pessoas'}
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  <div>
                    <p className="mb-1.5 text-xs font-semibold text-gray-500">Forma de pagamento</p>
                    {formas.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        O anfitrião ainda não configurou formas de pagamento.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {formas.map((f) => (
                          <li key={f.value}>
                            <button
                              type="button"
                              onClick={() => setFormaPagamento(f.value)}
                              className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm text-[#001f3f] ${
                                formaPagamento === f.value
                                  ? 'border-[#0097b2] bg-[#0097b2]/10 font-semibold'
                                  : 'border-gray-200 bg-white'
                              }`}
                            >
                              <span
                                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                                  formaPagamento === f.value
                                    ? 'border-[#0097b2] bg-[#0097b2]'
                                    : 'border-gray-300'
                                }`}
                              >
                                {formaPagamento === f.value ? (
                                  <Check className="h-2.5 w-2.5 text-white" aria-hidden />
                                ) : null}
                              </span>
                              {f.label}
                            </button>
                            {f.value === 'dinheiro' &&
                            formaPagamento === 'dinheiro' &&
                            politicas?.formas_pagamento.moedas?.length ? (
                              <div className="mt-1.5 flex flex-wrap justify-center gap-1.5">
                                {politicas.formas_pagamento.moedas.map((m) => {
                                  const rotulo =
                                    MOEDAS_DINHEIRO.find((x) => x.value === m)?.label ?? m
                                  return (
                                    <span
                                      key={m}
                                      className="rounded-full bg-[#0097b2]/15 px-2.5 py-1 text-xs font-semibold text-[#001f3f]"
                                    >
                                      {rotulo}
                                    </span>
                                  )
                                })}
                              </div>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              {noites > 0 ? (
                <div className="rounded-xl p-4" style={{ backgroundColor: COR }}>
                  <h3 className="text-center text-sm font-bold text-white">RESUMO DA RESERVA</h3>
                  <p className="mt-2 text-center text-sm leading-relaxed text-white">
                    Você reservou {noites} {noites === 1 ? 'diária' : 'diárias'} (check-in dia{' '}
                    <strong>{formatarDataBr(checkin)}</strong> e check-out dia{' '}
                    <strong>{formatarDataBr(checkout)}</strong>) da acomodação &quot;
                    {rotuloAcomodacaoResumoCurto(selecionada)}
                    &quot;, o valor total das reservas é de{' '}
                    <strong>{formatarValorDiaria(total)}</strong> a ser pago direto para o anfitrião
                    no dia do check-in. Deseja confirmar a reserva?
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {erro ? <p className="px-4 pb-2 text-sm text-rose-600">{erro}</p> : null}
        </div>

        {mostrarRodapePassos ? (
          <div
            className="shrink-0 border-t border-gray-200 bg-white px-3 pt-3"
            style={{ paddingBottom: '0.75rem' }}
          >
            {passo === 2 ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPasso(1)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white"
                  style={{ backgroundColor: COR }}
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                  RETORNAR
                </button>
                <button
                  type="button"
                  onClick={() => setPasso(3)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white"
                  style={{ backgroundColor: VERDE }}
                >
                  AVANÇAR
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ) : null}
            {passo === 3 ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPasso(2)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white"
                  style={{ backgroundColor: COR }}
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                  RETORNAR
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirmar()}
                  disabled={loading || noites <= 0 || !formaPagamento}
                  className="flex flex-[1.4] items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-50"
                  style={{ backgroundColor: VERDE }}
                >
                  <Check className="h-4 w-4" aria-hidden />
                  {loading ? 'Enviando…' : 'CONFIRMAR'}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <PopupAvisoReservaHospedagemConflito
        isOpen={mostrarAvisoConflito}
        onOk={() => {
          setMostrarAvisoConflito(false)
          setConflitoReconhecido(true)
        }}
      />
      <PopupAvisoBloqueioConta
        aberto={avisoAberto}
        onFechar={fecharAvisoBloqueio}
        titulo={tituloBloqueio}
        mensagem={mensagemBloqueio}
      />
    </>
  )
}
