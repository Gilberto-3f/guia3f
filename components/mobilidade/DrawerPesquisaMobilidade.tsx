'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import {
  ArrowLeft,
  CalendarDays,
  Car,
  Check,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Info,
  Languages,
  MapPin,
  Minus,
  Plus,
  Search,
  Smartphone,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import { useRouter } from '@/i18n/navigation'
import { supabase } from '@/lib/supabase'
import { useModalScrollLock } from '@/lib/useModalScrollLock'
import {
  buildMobilidadePesquisaHref,
  type MobilidadePesquisaState,
  type MobilidadePonto,
} from '@/lib/mobilidadePesquisaParams'
import {
  carregarRotasTabeladasCidade,
  cidadeTripliceParaTabelado,
  ehCruzamentoFronteira,
  inferirCidadeDePonto,
  modalidadeRecomendada,
  modalidadesDisponiveis,
  ordenarModalidadesPorPreco,
  peekRotasTabeladasCache,
  sugerirRotaParaDestino,
  valorCorridaComLugares,
  type ModalidadeMobilidadeId,
  type MoedaMobilidadeId,
  type PagamentoMobilidadeId,
  MOEDAS_MOBILIDADE,
  PAGAMENTOS_ORDEM,
} from '@/lib/mobilidadePopupPesquisa'
import type { RotaTabelada } from '@/lib/servicosTabeladosCatalogo'
import { labelIdiomaGuia } from '@/lib/idiomasGuia'
import CotacaoValorMobilidade from '@/components/mobilidade/CotacaoValorMobilidade'
import type {
  OfertaResultadoUi,
  ResultadoCorridaMobilidade,
} from '@/components/mobilidade/PopupResultadoCorridaMobilidade'

const COR = '#0097b2'
const VERDE = '#00D443'

type Props = {
  aberto: boolean
  onFechar: () => void
  pesquisa: MobilidadePesquisaState
  destinoCidadeEmpresa?: string | null
  destinoNomeEmpresa?: string | null
  /** Drawer 1: nome fantasia + cidade abreviada (empresa). */
  destinoLabelCurto?: string | null
  /** Drawers 2–3: nome + endereço (empresa). */
  destinoLabelCompleto?: string | null
  /** Após PROCURAR: fecha drawer e entrega resultado à página. */
  onResultado: (r: ResultadoCorridaMobilidade) => void
}

const ICONES: Record<ModalidadeMobilidadeId, typeof Car> = {
  motorista_app: Smartphone,
  van: Users,
  taxista: Car,
  guia: MapPin,
}

const TITULOS_MOD: Record<ModalidadeMobilidadeId, string> = {
  motorista_app: 'MOTORISTA DE APP',
  van: 'MOTORISTA DE VAN',
  taxista: 'TAXISTA',
  guia: 'GUIA DE TURISMO',
}

function formatBrl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function ChevronSecao({
  aberto,
  onToggle,
  icon: Icon,
  titulo,
  children,
}: {
  aberto: boolean
  onToggle: () => void
  icon: typeof Languages
  titulo: string
  children: ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-3 text-left"
      >
        <Icon className="h-5 w-5 shrink-0" style={{ color: COR }} aria-hidden />
        <span className="min-w-0 flex-1 text-sm font-bold" style={{ color: COR }}>
          {titulo}
        </span>
        {aberto ? (
          <ChevronUp className="h-5 w-5 shrink-0" style={{ color: COR }} aria-hidden />
        ) : (
          <ChevronDown className="h-5 w-5 shrink-0" style={{ color: COR }} aria-hidden />
        )}
      </button>
      {aberto ? <div className="border-t border-gray-100 px-3 pb-3 pt-2">{children}</div> : null}
    </div>
  )
}

function ContadorLugares({
  value,
  onChange,
  min = 1,
  max = 20,
}: {
  value: number
  onChange: (n: number) => void
  min?: number
  max?: number
}) {
  return (
    <div className="flex items-center justify-center gap-4 py-2">
      <button
        type="button"
        aria-label="Diminuir"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="flex h-10 w-10 items-center justify-center rounded-full text-white disabled:opacity-40"
        style={{ backgroundColor: COR }}
      >
        <Minus className="h-5 w-5" aria-hidden />
      </button>
      <span className="min-w-[2rem] text-center text-2xl font-bold tabular-nums text-black">
        {value}
      </span>
      <button
        type="button"
        aria-label="Aumentar"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="flex h-10 w-10 items-center justify-center rounded-full text-white disabled:opacity-40"
        style={{ backgroundColor: COR }}
      >
        <Plus className="h-5 w-5" aria-hidden />
      </button>
    </div>
  )
}

const agendaFieldClass =
  'box-border block w-full min-w-0 appearance-none rounded-lg border border-white/25 bg-[#0097b2] px-2.5 py-1.5 text-xs text-white outline-none focus:ring-2 focus:ring-white/40 [color-scheme:dark]'

function CamposAgendamento({
  data,
  hora,
  onData,
  onHora,
  labelData,
  labelHora,
}: {
  data: string
  hora: string
  onData: (v: string) => void
  onHora: (v: string) => void
  labelData: string
  labelHora: string
}) {
  return (
    <div className="mt-2 max-w-full space-y-2">
      <label className="block min-w-0 text-xs font-semibold text-gray-700">
        {labelData}
        <span className="mt-1 block overflow-hidden rounded-lg">
          <input
            type="date"
            value={data}
            onChange={(e) => onData(e.target.value)}
            className={agendaFieldClass}
          />
        </span>
      </label>
      <label className="block min-w-0 text-xs font-semibold text-gray-700">
        {labelHora}
        <span className="mt-1 block overflow-hidden rounded-lg">
          <input
            type="time"
            value={hora}
            onChange={(e) => onHora(e.target.value)}
            className={agendaFieldClass}
          />
        </span>
      </label>
    </div>
  )
}

function ValorComDicaLugares({
  aberto,
  onToggle,
  texto,
  ariaLabel,
  valorNode,
}: {
  aberto: boolean
  onToggle: () => void
  texto: string
  ariaLabel: string
  valorNode: ReactNode
}) {
  return (
    <div className="mt-1">
      <div className="flex items-center justify-center gap-1.5">
        <button
          type="button"
          onClick={onToggle}
          className="shrink-0 rounded-full p-0.5"
          style={{ color: COR }}
          aria-label={ariaLabel}
          aria-expanded={aberto}
        >
          <Info className="h-4 w-4" aria-hidden />
        </button>
        <div className="min-w-0 text-sm font-semibold" style={{ color: COR }}>
          {valorNode}
        </div>
      </div>
      {aberto ? (
        <p className="mt-1 text-center text-[11px] text-gray-500">{texto}</p>
      ) : null}
    </div>
  )
}

export default function DrawerPesquisaMobilidade({
  aberto,
  onFechar,
  pesquisa,
  destinoCidadeEmpresa = null,
  destinoNomeEmpresa = null,
  destinoLabelCurto = null,
  destinoLabelCompleto = null,
  onResultado,
}: Props) {
  const t = useTranslations('Mobilidade')
  const router = useRouter()
  useModalScrollLock(aberto)

  const cidadeOrigemBoot = inferirCidadeDePonto(pesquisa.origem)
  const cidadeDestinoBoot =
    inferirCidadeDePonto(pesquisa.destino, destinoCidadeEmpresa) ??
    inferirCidadeDePonto(
      {
        nome: destinoLabelCurto || pesquisa.destino.nome || destinoNomeEmpresa || '',
        lat: null,
        lng: null,
      },
      destinoCidadeEmpresa,
    )
  const cruzamentoBoot = ehCruzamentoFronteira(cidadeOrigemBoot, cidadeDestinoBoot)
  const disponiveisBoot = modalidadesDisponiveis(cruzamentoBoot)
  const tabBoot = cidadeTripliceParaTabelado(cidadeOrigemBoot)
  const rotasBoot = tabBoot ? peekRotasTabeladasCache(tabBoot) : null

  const [etapa, setEtapa] = useState<1 | 2 | 3>(1)
  /** Já nasce com a modalidade correta (evita flash do motorista de app na fronteira). */
  const [modalidade, setModalidade] = useState<ModalidadeMobilidadeId | null>(
    () =>
      disponiveisBoot.includes('motorista_app')
        ? 'motorista_app'
        : (disponiveisBoot[0] ?? null),
  )
  const [rotas, setRotas] = useState<RotaTabelada[]>(() => rotasBoot ?? [])
  const [carregandoValores, setCarregandoValores] = useState(() => Boolean(tabBoot) && !rotasBoot)
  const [pagamento, setPagamento] = useState<PagamentoMobilidadeId>(PAGAMENTOS_ORDEM[0])
  const [moedaDinheiro, setMoedaDinheiro] = useState<MoedaMobilidadeId>('real')
  const [lugares, setLugares] = useState(1)
  const [dataAgenda, setDataAgenda] = useState('')
  const [horaAgenda, setHoraAgenda] = useState('')
  const [agendarOutraData, setAgendarOutraData] = useState(false)
  const [idiomaPreferido, setIdiomaPreferido] = useState('')
  const [idiomasFiltro, setIdiomasFiltro] = useState<
    { codigo: string; label: string; bandeira: string }[]
  >([])
  const [idiomasFiltroLoading, setIdiomasFiltroLoading] = useState(false)
  const [editandoEndereco, setEditandoEndereco] = useState(false)
  const [origemDraft, setOrigemDraft] = useState<MobilidadePonto>({ nome: '', lat: null, lng: null })
  const [destinoDraft, setDestinoDraft] = useState<MobilidadePonto>({ nome: '', lat: null, lng: null })
  const [chevIdioma, setChevIdioma] = useState(false)
  const [chevLugares, setChevLugares] = useState(false)
  const [chevAgendar, setChevAgendar] = useState(false)
  const [chevBeneficios, setChevBeneficios] = useState(false)
  const [dicaLugaresAberta, setDicaLugaresAberta] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const destinoLabelBase =
    destinoLabelCurto ||
    pesquisa.destino.nome ||
    destinoNomeEmpresa ||
    (pesquisa.destinoEmpresaId ? t('destinoEmpresa') : '—')

  // Snapshot do pai tem prioridade — texto completo no 1º paint.
  const destinoLabelEtapa1 = destinoLabelCurto || destinoLabelBase
  const destinoLabelEtapa23 = destinoLabelCompleto || destinoLabelCurto || destinoLabelBase
  const destinoLabel = etapa === 1 ? destinoLabelEtapa1 : destinoLabelEtapa23

  const origemLabel =
    pesquisa.origem.nome ||
    (pesquisa.origem.lat != null
      ? `${pesquisa.origem.lat.toFixed(4)}, ${pesquisa.origem.lng?.toFixed(4)}`
      : '—')

  const cidadeOrigem = useMemo(() => inferirCidadeDePonto(pesquisa.origem), [pesquisa.origem])
  const cidadeDestino = useMemo(
    () =>
      inferirCidadeDePonto(pesquisa.destino, destinoCidadeEmpresa) ??
      inferirCidadeDePonto({ nome: destinoLabelBase, lat: null, lng: null }, destinoCidadeEmpresa),
    [pesquisa.destino, destinoCidadeEmpresa, destinoLabelBase],
  )
  const cruzamento = ehCruzamentoFronteira(cidadeOrigem, cidadeDestino)

  const disponiveisBase = useMemo(() => modalidadesDisponiveis(cruzamento), [cruzamento])

  // Montagem fresca a cada abertura (pai usa key + render condicional) — etapa 1 sem herança.
  useEffect(() => {
    if (!aberto) return
    setEtapa(1)
    setEditandoEndereco(false)
    setAgendarOutraData(false)
    setDataAgenda('')
    setHoraAgenda('')
    setLugares(1)
    setPagamento(PAGAMENTOS_ORDEM[0])
    setMoedaDinheiro('real')
    setIdiomaPreferido('')
    setIdiomasFiltro([])
    setChevIdioma(false)
    setChevLugares(false)
    setChevAgendar(false)
    setChevBeneficios(false)
    setDicaLugaresAberta(false)
    setEnviando(false)
    setOrigemDraft({ ...pesquisa.origem })
    setDestinoDraft({
      nome: destinoLabelCurto || pesquisa.destino.nome || destinoNomeEmpresa || '',
      lat: pesquisa.destino.lat,
      lng: pesquisa.destino.lng,
    })
    // Só no open / troca de pesquisa relevante — não a cada keystroke de draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, pesquisa.destinoEmpresaId, pesquisa.destino.lat, pesquisa.destino.lng])

  useEffect(() => {
    if (!aberto) return
    const tab = cidadeTripliceParaTabelado(cidadeOrigem)
    if (!tab) {
      setRotas([])
      setCarregandoValores(false)
      return
    }
    const cached = peekRotasTabeladasCache(tab)
    if (cached) {
      setRotas(cached)
      setCarregandoValores(false)
      return
    }
    let ativo = true
    setCarregandoValores(true)
    void (async () => {
      const lista = await carregarRotasTabeladasCidade(supabase, tab)
      if (ativo) {
        setRotas(lista)
        setCarregandoValores(false)
      }
    })()
    return () => {
      ativo = false
    }
  }, [aberto, cidadeOrigem])

  useEffect(() => {
    if (!aberto || modalidade !== 'guia') return
    let ativo = true
    setIdiomasFiltroLoading(true)
    void (async () => {
      try {
        const res = await fetch('/api/mobilidade/idiomas-guia')
        const json = (await res.json()) as {
          idiomas?: { codigo: string; label: string; bandeira: string }[]
        }
        if (!ativo) return
        const lista = Array.isArray(json.idiomas) ? json.idiomas : []
        setIdiomasFiltro(lista)
        setIdiomaPreferido((prev) => {
          if (prev && lista.some((i) => i.codigo === prev)) return prev
          return lista[0]?.codigo ?? ''
        })
      } catch {
        if (ativo) setIdiomasFiltro([])
      } finally {
        if (ativo) setIdiomasFiltroLoading(false)
      }
    })()
    return () => {
      ativo = false
    }
  }, [aberto, modalidade])

  const valoresPorMod = useMemo(() => {
    const destTxt = destinoLabelBase
    const out: Partial<
      Record<
        ModalidadeMobilidadeId,
        { valor: number | null; rota: RotaTabelada | null; parceiro?: boolean }
      >
    > = {}
    for (const id of disponiveisBase) {
      if (id === 'motorista_app') {
        out[id] = { valor: null, rota: null, parceiro: true }
        continue
      }
      const rota = sugerirRotaParaDestino(rotas, id, destTxt)
      out[id] = { valor: rota ? rota.valorRota : null, rota }
    }
    return out
  }, [disponiveisBase, rotas, destinoLabelBase])

  const disponiveis = useMemo(() => {
    // Enquanto preços carregam: ordem fixa (sem reordenar) — evita flash na lista.
    if (carregandoValores) return disponiveisBase
    return ordenarModalidadesPorPreco(
      disponiveisBase,
      Object.fromEntries(
        Object.entries(valoresPorMod).map(([k, v]) => [k, v?.valor ?? null]),
      ) as Partial<Record<ModalidadeMobilidadeId, number | null>>,
    )
  }, [carregandoValores, disponiveisBase, valoresPorMod])

  const recomendada = useMemo(
    () =>
      modalidadeRecomendada(
        cruzamento,
        Object.fromEntries(
          Object.entries(valoresPorMod).map(([k, v]) => [k, v?.valor ?? null]),
        ) as Partial<Record<ModalidadeMobilidadeId, number | null>>,
      ),
    [cruzamento, valoresPorMod],
  )

  useEffect(() => {
    if (!aberto) return
    if (modalidade && disponiveis.includes(modalidade)) return
    if (disponiveis.includes(recomendada)) setModalidade(recomendada)
    else if (disponiveis[0]) setModalidade(disponiveis[0])
    else setModalidade(null)
  }, [aberto, recomendada, disponiveis, modalidade])

  if (!aberto) return null

  const labelMod = (id: ModalidadeMobilidadeId) => t(`mod.${id}.label`)
  const beneficiosKeys = (id: ModalidadeMobilidadeId): string[] => {
    const n = Number(t(`mod.${id}.beneficiosCount`))
    return Array.from({ length: Number.isFinite(n) ? n : 0 }, (_, i) => `mod.${id}.b${i + 1}`)
  }
  const extrasKeys = (id: ModalidadeMobilidadeId): string[] => {
    const n = Number(t(`mod.${id}.extrasCount`))
    return Array.from({ length: Number.isFinite(n) ? n : 0 }, (_, i) => `mod.${id}.e${i + 1}`)
  }

  const IconHeader =
    etapa === 1 ? Car : etapa === 3 ? DollarSign : modalidade ? ICONES[modalidade] : Car

  const tituloHeader =
    etapa === 1
      ? t('drawerModalidades')
      : etapa === 3
        ? t('drawerFormaPagamento')
        : modalidade
          ? TITULOS_MOD[modalidade]
          : '—'

  const dataHoraCombinada =
    dataAgenda && horaAgenda ? `${dataAgenda}T${horaAgenda}` : dataAgenda || ''

  const valorUnitarioAtual =
    modalidade && modalidade !== 'motorista_app'
      ? (valoresPorMod[modalidade]?.valor ?? null)
      : null
  const valorTotalAtual =
    modalidade != null
      ? valorCorridaComLugares(modalidade, valorUnitarioAtual, lugares)
      : null

  const aplicarEnderecoEditado = () => {
    router.replace(
      buildMobilidadePesquisaHref({
        origem: {
          nome: origemDraft.nome.trim(),
          lat: origemDraft.lat,
          lng: origemDraft.lng,
        },
        destino: {
          nome: destinoDraft.nome.trim(),
          lat: destinoDraft.lat,
          lng: destinoDraft.lng,
        },
        destinoEmpresaId: pesquisa.destinoEmpresaId,
        recomendacaoId: pesquisa.recomendacaoId,
        profissionalUsuarioId: pesquisa.profissionalUsuarioId,
        abrirPesquisa: true,
      }),
    )
    setEditandoEndereco(false)
  }

  const procurar = async () => {
    if (!modalidade || enviando) return
    setEnviando(true)

    const valor = valorCorridaComLugares(
      modalidade,
      modalidade !== 'motorista_app' ? valoresPorMod[modalidade]?.valor ?? null : null,
      lugares,
    )

    const dataAgendada =
      agendarOutraData && dataHoraCombinada ? dataHoraCombinada : null

    try {
      const res = await fetch('/api/mobilidade/solicitar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modalidade,
          origem_nome: origemLabel,
          destino_nome: destinoLabelBase,
          origem_lat: pesquisa.origem.lat,
          origem_lng: pesquisa.origem.lng,
          destino_lat: pesquisa.destino.lat,
          destino_lng: pesquisa.destino.lng,
          destino_empresa_id: pesquisa.destinoEmpresaId,
          destino_cidade: destinoCidadeEmpresa,
          cruzamento_fronteira: cruzamento,
          valor_estimado: valor,
          pagamento,
          moedas_dinheiro: pagamento === 'dinheiro' ? [moedaDinheiro] : [],
          lugares,
          acompanhamento_guia: modalidade === 'guia',
          data_agendada: dataAgendada,
          idioma_preferido:
            modalidade === 'guia' && idiomaPreferido ? idiomaPreferido : null,
          recomendacao_id: pesquisa.recomendacaoId,
          profissional_usuario_id: pesquisa.profissionalUsuarioId,
        }),
      })
      const json = (await res.json()) as Record<string, unknown>

      const redirect = json.redirectParceiro != null ? String(json.redirectParceiro).trim() : ''
      if (redirect) {
        window.location.href = redirect
        return
      }

      if (!res.ok) {
        onResultado({
          solicitacaoId: '',
          status: 'sem_profissional',
          oferta: null,
          backupsOcultos: 0,
          matchErro: String(json.error ?? t('matchErro')),
          dataHoraAgendada: dataAgendada || undefined,
        })
        onFechar()
        return
      }

      const sid = String(json.solicitacaoId ?? '')
      const st = String(json.status ?? '')
      const of = json.oferta as OfertaResultadoUi | null

      onResultado({
        solicitacaoId: sid,
        status: st || (of?.profissionalId ? 'oferecida' : 'sem_profissional'),
        oferta: of?.profissionalId ? of : null,
        backupsOcultos: Number(json.backupsOcultos ?? 0),
        dataHoraAgendada: dataAgendada || undefined,
      })
      onFechar()
    } catch {
      onResultado({
        solicitacaoId: '',
        status: 'sem_profissional',
        oferta: null,
        backupsOcultos: 0,
        matchErro: t('matchErro'),
      })
      onFechar()
    } finally {
      setEnviando(false)
    }
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[75] flex flex-col bg-white"
      role="dialog"
      aria-modal="true"
    >
      {/* Faixa azul + safe area (padrão menu/canais) */}
      <div className="shrink-0 pt-safe" style={{ backgroundColor: COR }}>
        <div className="flex h-12 items-center gap-2 px-3">
          <IconHeader className="h-5 w-5 shrink-0 text-white" aria-hidden />
          <h2 className="min-w-0 flex-1 truncate text-base font-bold uppercase tracking-wide text-white">
            {tituloHeader}
          </h2>
          {etapa === 1 ? (
            <button
              type="button"
              onClick={onFechar}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/90 hover:bg-white/15"
              aria-label={t('fechar')}
            >
              <X className="h-5 w-5" />
            </button>
          ) : etapa === 3 ? (
            <button
              type="button"
              onClick={() => setEtapa(2)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/90 hover:bg-white/15"
              aria-label={t('retornar')}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <span className="inline-flex h-8 w-8 shrink-0" aria-hidden />
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3" data-modal-scroll-lock-scrollable>
        {/* Card rota */}
        <div className="rounded-xl px-3 py-2.5 text-sm text-white" style={{ backgroundColor: COR }}>
          {etapa === 1 && editandoEndereco ? (
            <div className="space-y-2">
              <div className="space-y-2 text-center">
                <label className="block text-[11px] font-bold uppercase tracking-wide text-white">
                  {t('origemLabel')}
                  <input
                    type="text"
                    value={origemDraft.nome}
                    onChange={(e) => setOrigemDraft((p) => ({ ...p, nome: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-[#0097b2]/20 bg-white px-3 py-2 text-center text-sm font-medium outline-none placeholder:text-[#0097b2]/50"
                    style={{ color: COR }}
                    placeholder={t('origemManualPlaceholder')}
                  />
                </label>
                <label className="block text-[11px] font-bold uppercase tracking-wide text-white">
                  {t('destinoLabel')}
                  <input
                    type="text"
                    value={destinoDraft.nome}
                    onChange={(e) => setDestinoDraft((p) => ({ ...p, nome: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-[#0097b2]/20 bg-white px-3 py-2 text-center text-sm font-medium outline-none placeholder:text-[#0097b2]/50"
                    style={{ color: COR }}
                    placeholder={t('destinoPlaceholder')}
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={aplicarEnderecoEditado}
                className="mx-auto block w-[55%] max-w-[12rem] rounded-lg py-2 text-xs font-bold uppercase text-white"
                style={{ backgroundColor: VERDE }}
              >
                {t('aplicarEndereco')}
              </button>
              <button
                type="button"
                onClick={() => setEditandoEndereco(false)}
                className="mx-auto flex items-center justify-center rounded-lg p-1 text-white hover:bg-white/15"
                aria-label={t('editarEndereco')}
                aria-expanded
              >
                <ChevronUp className="h-5 w-5 text-white" aria-hidden />
              </button>
            </div>
          ) : etapa === 1 ? (
            <div className="text-center text-white">
              <p className="text-[11px] font-bold uppercase tracking-wide text-white">
                {t('destinoLabel')}
              </p>
              <p className="mt-0.5 text-sm font-medium text-white">{destinoLabel}</p>
              <button
                type="button"
                onClick={() => setEditandoEndereco(true)}
                className="mx-auto mt-2 flex items-center justify-center rounded-lg p-1 text-white hover:bg-white/15"
                aria-label={t('editarEndereco')}
                aria-expanded={false}
              >
                <ChevronDown className="h-5 w-5 text-white" aria-hidden />
              </button>
            </div>
          ) : (
            <div className="text-white">
              <p>
                <span className="font-semibold text-white">{t('origemLabel')}: </span>
                {origemLabel}
              </p>
              <p className="mt-1">
                <span className="font-semibold text-white">{t('destinoLabel')}: </span>
                {destinoLabel}
              </p>
            </div>
          )}
        </div>

        {etapa === 1 ? (
          <div className="mt-2 space-y-2">
            <p className="text-center text-sm text-black">{t('escolhaModalidade')}</p>
            <ul className="space-y-2">
              {disponiveis.map((id) => {
                const Icon = ICONES[id]
                const info = valoresPorMod[id]
                const precoTxt = info?.parceiro
                  ? t('valorParceiro')
                  : info?.valor != null
                    ? formatBrl(info.valor)
                    : carregandoValores
                      ? '…'
                      : t('valorIndisponivel')
                return (
                  <li key={id}>
                    <div
                      className={`rounded-xl border-2 px-3 py-2.5 transition-colors ${
                        modalidade === id
                          ? 'border-[#00D443] bg-green-50/40'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => setModalidade(id)}
                          className="flex min-w-0 flex-1 items-start gap-3 text-left"
                        >
                          <Icon className="mt-0.5 h-5 w-5 shrink-0" style={{ color: COR }} aria-hidden />
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-gray-900">{labelMod(id)}</span>
                            <p className="mt-0.5 text-sm font-semibold" style={{ color: COR }}>
                              {precoTxt}
                            </p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setModalidade(id)}
                          className="shrink-0 p-0.5"
                          aria-label={labelMod(id)}
                        >
                          <span
                            className={`block h-4 w-4 rounded-full border-2 ${
                              modalidade === id
                                ? 'border-[#00D443] bg-[#00D443]'
                                : 'border-gray-300'
                            }`}
                            aria-hidden
                          />
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : (
          <div className="h-2" />
        )}

        {etapa === 2 && modalidade === 'motorista_app' ? (
          <div className="space-y-2">
            <ChevronSecao
              aberto={chevBeneficios}
              onToggle={() => setChevBeneficios((v) => !v)}
              icon={Sparkles}
              titulo={t('beneficiosTitulo')}
            >
              <div className="space-y-2 text-xs text-gray-600">
                <ul className="list-disc space-y-1 pl-4">
                  {beneficiosKeys('motorista_app').map((k) => (
                    <li key={k}>{t(k)}</li>
                  ))}
                </ul>
                {extrasKeys('motorista_app').length > 0 ? (
                  <>
                    <p className="font-semibold text-gray-800">{t('extrasTitulo')}</p>
                    <ul className="list-disc space-y-1 pl-4">
                      {extrasKeys('motorista_app').map((k) => (
                        <li key={k}>{t(k)}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </div>
            </ChevronSecao>
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center">
              <Smartphone className="mx-auto h-10 w-10 text-gray-400" aria-hidden />
              <p className="mt-3 text-sm text-gray-600">{t('appPlaceholder')}</p>
            </div>
          </div>
        ) : null}

        {etapa === 2 && modalidade === 'guia' ? (
          <div className="space-y-2">
            <ChevronSecao
              aberto={chevBeneficios}
              onToggle={() => setChevBeneficios((v) => !v)}
              icon={Sparkles}
              titulo={t('beneficiosTitulo')}
            >
              <div className="space-y-2 text-xs text-gray-600">
                <ul className="list-disc space-y-1 pl-4">
                  {beneficiosKeys('guia').map((k) => (
                    <li key={k}>{t(k)}</li>
                  ))}
                </ul>
                {extrasKeys('guia').length > 0 ? (
                  <>
                    <p className="font-semibold text-gray-800">{t('extrasTitulo')}</p>
                    <ul className="list-disc space-y-1 pl-4">
                      {extrasKeys('guia').map((k) => (
                        <li key={k}>{t(k)}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </div>
            </ChevronSecao>
            <ChevronSecao
              aberto={chevIdioma}
              onToggle={() => setChevIdioma((v) => !v)}
              icon={Languages}
              titulo={t('idiomaChevron')}
            >
              {idiomasFiltroLoading ? (
                <p className="text-xs text-gray-500">{t('idiomasFiltroCarregando')}</p>
              ) : idiomasFiltro.length === 0 ? (
                <p className="text-xs text-gray-500">{t('idiomasFiltroVazio')}</p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {idiomasFiltro.map((idi) => (
                      <button
                        key={idi.codigo}
                        type="button"
                        onClick={() => setIdiomaPreferido(idi.codigo)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                          idiomaPreferido === idi.codigo
                            ? 'bg-[#0097b2] text-white'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {idi.bandeira} {idi.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-gray-400">{t('idiomaHint')}</p>
                </>
              )}
            </ChevronSecao>
            <ChevronSecao
              aberto={chevLugares}
              onToggle={() => setChevLugares((v) => !v)}
              icon={Users}
              titulo={t('passageirosChevron')}
            >
              <ContadorLugares value={lugares} onChange={setLugares} />
              {valorUnitarioAtual != null ? (
                <ValorComDicaLugares
                  aberto={dicaLugaresAberta}
                  onToggle={() => setDicaLugaresAberta((v) => !v)}
                  texto={t('lugaresHint')}
                  ariaLabel={t('lugaresHint')}
                  valorNode={
                    lugares > 1
                      ? t('valorPorLugares', {
                          unitario: formatBrl(valorUnitarioAtual),
                          n: lugares,
                          total: formatBrl(valorUnitarioAtual * lugares),
                        })
                      : formatBrl(valorUnitarioAtual)
                  }
                />
              ) : (
                <ValorComDicaLugares
                  aberto={dicaLugaresAberta}
                  onToggle={() => setDicaLugaresAberta((v) => !v)}
                  texto={t('lugaresHint')}
                  ariaLabel={t('lugaresHint')}
                  valorNode={<span className="text-gray-400">—</span>}
                />
              )}
            </ChevronSecao>
            <ChevronSecao
              aberto={chevAgendar}
              onToggle={() => setChevAgendar((v) => !v)}
              icon={CalendarDays}
              titulo={t('agendarChevron')}
            >
              <label className="flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="checkbox"
                  checked={agendarOutraData}
                  onChange={(e) => {
                    setAgendarOutraData(e.target.checked)
                    if (!e.target.checked) {
                      setDataAgenda('')
                      setHoraAgenda('')
                    }
                  }}
                />
                {t('paraOutraData')}
              </label>
              {agendarOutraData ? (
                <CamposAgendamento
                  data={dataAgenda}
                  hora={horaAgenda}
                  onData={setDataAgenda}
                  onHora={setHoraAgenda}
                  labelData={t('dataAgendaLabel')}
                  labelHora={t('horaAgendaLabel')}
                />
              ) : null}
            </ChevronSecao>
          </div>
        ) : null}

        {etapa === 2 && modalidade === 'van' ? (
          <div className="space-y-2">
            <ChevronSecao
              aberto={chevBeneficios}
              onToggle={() => setChevBeneficios((v) => !v)}
              icon={Sparkles}
              titulo={t('beneficiosTitulo')}
            >
              <div className="space-y-2 text-xs text-gray-600">
                <ul className="list-disc space-y-1 pl-4">
                  {beneficiosKeys('van').map((k) => (
                    <li key={k}>{t(k)}</li>
                  ))}
                </ul>
                {extrasKeys('van').length > 0 ? (
                  <>
                    <p className="font-semibold text-gray-800">{t('extrasTitulo')}</p>
                    <ul className="list-disc space-y-1 pl-4">
                      {extrasKeys('van').map((k) => (
                        <li key={k}>{t(k)}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </div>
            </ChevronSecao>
            <ChevronSecao
              aberto={chevLugares}
              onToggle={() => setChevLugares((v) => !v)}
              icon={Users}
              titulo={t('passageirosChevron')}
            >
              <ContadorLugares value={lugares} onChange={setLugares} max={15} />
              {valorUnitarioAtual != null ? (
                <ValorComDicaLugares
                  aberto={dicaLugaresAberta}
                  onToggle={() => setDicaLugaresAberta((v) => !v)}
                  texto={t('lugaresHint')}
                  ariaLabel={t('lugaresHint')}
                  valorNode={
                    lugares > 1
                      ? t('valorPorLugares', {
                          unitario: formatBrl(valorUnitarioAtual),
                          n: lugares,
                          total: formatBrl(valorUnitarioAtual * lugares),
                        })
                      : formatBrl(valorUnitarioAtual)
                  }
                />
              ) : (
                <ValorComDicaLugares
                  aberto={dicaLugaresAberta}
                  onToggle={() => setDicaLugaresAberta((v) => !v)}
                  texto={t('lugaresHint')}
                  ariaLabel={t('lugaresHint')}
                  valorNode={<span className="text-gray-400">—</span>}
                />
              )}
            </ChevronSecao>
            <ChevronSecao
              aberto={chevAgendar}
              onToggle={() => setChevAgendar((v) => !v)}
              icon={CalendarDays}
              titulo={t('agendarChevron')}
            >
              <label className="flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="checkbox"
                  checked={agendarOutraData}
                  onChange={(e) => {
                    setAgendarOutraData(e.target.checked)
                    if (!e.target.checked) {
                      setDataAgenda('')
                      setHoraAgenda('')
                    }
                  }}
                />
                {t('paraOutraData')}
              </label>
              {agendarOutraData ? (
                <CamposAgendamento
                  data={dataAgenda}
                  hora={horaAgenda}
                  onData={setDataAgenda}
                  onHora={setHoraAgenda}
                  labelData={t('dataAgendaLabel')}
                  labelHora={t('horaAgendaLabel')}
                />
              ) : null}
            </ChevronSecao>
          </div>
        ) : null}

        {etapa === 2 && modalidade === 'taxista' ? (
          <div className="space-y-2">
            <ChevronSecao
              aberto={chevBeneficios}
              onToggle={() => setChevBeneficios((v) => !v)}
              icon={Sparkles}
              titulo={t('beneficiosTitulo')}
            >
              <div className="space-y-2 text-xs text-gray-600">
                <ul className="list-disc space-y-1 pl-4">
                  {beneficiosKeys('taxista').map((k) => (
                    <li key={k}>{t(k)}</li>
                  ))}
                </ul>
                {extrasKeys('taxista').length > 0 ? (
                  <>
                    <p className="font-semibold text-gray-800">{t('extrasTitulo')}</p>
                    <ul className="list-disc space-y-1 pl-4">
                      {extrasKeys('taxista').map((k) => (
                        <li key={k}>{t(k)}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </div>
            </ChevronSecao>
            <ChevronSecao
              aberto={chevAgendar}
              onToggle={() => setChevAgendar((v) => !v)}
              icon={CalendarDays}
              titulo={t('agendarChevron')}
            >
              <label className="flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="checkbox"
                  checked={agendarOutraData}
                  onChange={(e) => {
                    setAgendarOutraData(e.target.checked)
                    if (!e.target.checked) {
                      setDataAgenda('')
                      setHoraAgenda('')
                    }
                  }}
                />
                {t('paraOutraData')}
              </label>
              {agendarOutraData ? (
                <CamposAgendamento
                  data={dataAgenda}
                  hora={horaAgenda}
                  onData={setDataAgenda}
                  onHora={setHoraAgenda}
                  labelData={t('dataAgendaLabel')}
                  labelHora={t('horaAgendaLabel')}
                />
              ) : null}
            </ChevronSecao>
          </div>
        ) : null}

        {etapa === 3 ? (
          <div className="space-y-4">
            {modalidade === 'motorista_app' ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-600">
                {t('appPlaceholder')}
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: COR }}>
                  {t('valorCorrida')}
                </p>
                <div className="mt-1">
                  {valorTotalAtual != null ? (
                    <CotacaoValorMobilidade valorBrl={valorTotalAtual} />
                  ) : (
                    <p className="text-lg font-bold" style={{ color: COR }}>
                      {t('valorIndisponivel')}
                    </p>
                  )}
                  {valorUnitarioAtual != null &&
                  (modalidade === 'guia' || modalidade === 'van') &&
                  lugares > 1 ? (
                    <p className="mt-1 text-xs text-gray-500">
                      {t('valorPorLugares', {
                        unitario: formatBrl(valorUnitarioAtual),
                        n: lugares,
                        total: formatBrl(valorUnitarioAtual * lugares),
                      })}
                    </p>
                  ) : null}
                </div>
                <div className="mt-3 border-t border-gray-200 pt-2">
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: COR }}>
                    {t('resumoCorrida')}
                  </p>
                  <ul className="mt-1 space-y-0.5 text-sm text-gray-700">
                    {modalidade === 'guia' && idiomaPreferido ? (
                      <li>
                        {t('resumoIdioma')}:{' '}
                        {idiomasFiltro.find((i) => i.codigo === idiomaPreferido)?.label ??
                          labelIdiomaGuia(idiomaPreferido)}
                      </li>
                    ) : null}
                    {modalidade === 'guia' || modalidade === 'van' ? (
                      <li>
                        {t('resumoPassageiros')}: {lugares}
                      </li>
                    ) : null}
                    {modalidade === 'taxista' ? (
                      <li>{t('taxistaInfoLugares')}</li>
                    ) : null}
                    {agendarOutraData && dataHoraCombinada ? (
                      <li>
                        {t('resumoAgendamento')}:{' '}
                        {new Date(
                          dataHoraCombinada.length === 16
                            ? `${dataHoraCombinada}:00`
                            : dataHoraCombinada,
                        ).toLocaleString()}
                      </li>
                    ) : null}
                  </ul>
                </div>
              </div>
            )}

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: COR }}>
                {t('formaPagamento')}
              </p>
              <ul className="space-y-2">
                {PAGAMENTOS_ORDEM.map((id) => (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => setPagamento(id)}
                      className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm ${
                        pagamento === id
                          ? 'border-[#0097b2] bg-[#0097b2]/10 font-semibold text-gray-900'
                          : 'border-gray-200 bg-white text-gray-800'
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                          pagamento === id ? 'border-[#0097b2] bg-[#0097b2]' : 'border-gray-300'
                        }`}
                      >
                        {pagamento === id ? (
                          <Check className="h-2.5 w-2.5 text-white" aria-hidden />
                        ) : null}
                      </span>
                      {t(`pag.${id}`)}
                    </button>
                    {id === 'dinheiro' && pagamento === 'dinheiro' ? (
                      <div className="mt-2 space-y-1.5 rounded-lg border border-[#0097b2]/30 bg-[#0097b2]/5 px-3 py-2">
                        <p className="text-xs font-semibold text-gray-600">{t('moedasDinheiroTitulo')}</p>
                        <ul className="space-y-1.5">
                          {MOEDAS_MOBILIDADE.map((m) => {
                            const selected = moedaDinheiro === m.value
                            return (
                              <li key={m.value}>
                                <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-800">
                                  <input
                                    type="radio"
                                    name="moeda-dinheiro-mobilidade"
                                    checked={selected}
                                    onChange={() => setMoedaDinheiro(m.value)}
                                    className="h-4 w-4 accent-[#0097b2]"
                                  />
                                  {m.label}
                                </label>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-gray-100 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {etapa === 1 ? (
          <button
            type="button"
            disabled={!modalidade}
            onClick={() => setEtapa(2)}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold uppercase text-white disabled:opacity-50"
            style={{ backgroundColor: VERDE }}
          >
            {t('avancar')}
          </button>
        ) : null}
        {etapa === 2 ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setEtapa(1)}
              className="flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-bold uppercase text-white"
              style={{ backgroundColor: COR }}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              {t('retornar')}
            </button>
            <button
              type="button"
              onClick={() => setEtapa(3)}
              className="flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-bold uppercase text-white"
              style={{ backgroundColor: VERDE }}
            >
              {t('avancar')}
            </button>
          </div>
        ) : null}
        {etapa === 3 ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onFechar}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 py-3 text-sm font-bold uppercase text-white"
            >
              <X className="h-4 w-4" aria-hidden />
              {t('cancelar')}
            </button>
            <button
              type="button"
              disabled={enviando}
              onClick={() => void procurar()}
              className="flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-bold uppercase text-white disabled:opacity-60"
              style={{ backgroundColor: VERDE }}
            >
              <Search className="h-4 w-4" aria-hidden />
              {enviando ? '…' : t('procurar')}
            </button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
