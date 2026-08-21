'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import {
  Car,
  ChevronDown,
  ClipboardList,
  Clock,
  Info,
  MapPin,
  Navigation,
  UserRound,
  X,
} from 'lucide-react'
import AvatarImage from '@/components/AvatarImage'
import UsuarioHandleVerificado from '@/components/UsuarioHandleVerificado'
import ChatCorridaMobilidade from '@/components/mobilidade/ChatCorridaMobilidade'
import DrawerManifestoEspaco from '@/components/mobilidade/DrawerManifestoEspaco'
import { useModalScrollLock } from '@/lib/useModalScrollLock'
import { modalidadeUsaManifesto, modalidadeUsaDeslocamentoProprio } from '@/lib/mobilidadeOfertaAtendimento'
import { buscarRotaMapboxDriving, formatarDuracaoEta } from '@/lib/mapboxDirections'
import { montarTrajetoEtaCorrida } from '@/lib/mobilidadeTrajetoMapa'
import { supabase } from '@/lib/supabase'
import {
  descricaoPeriodoRota,
  encontrarRotaTabeladaPorDestino,
  mapRotaTabeladaRow,
} from '@/lib/servicosTabeladosCatalogo'

const COR = '#0097b2'
const VERDE = '#00D443'

export type ParteAtendimentoAtivo = {
  nome: string
  username: string | null
  foto_url: string | null
  verificado?: boolean
  nota_media?: number | null
}

export type AtendimentoAtivoUi = {
  solicitacao_id: string
  status: string
  origem_nome: string | null
  destino_nome: string | null
  valor_estimado: number | null
  pagamento: string | null
  lugares: number | null
  data_agendada: string | null
  modalidade: string | null
  conversa_id: string | null
  manifesto_id?: string | null
  lat_origem?: number | null
  lng_origem?: number | null
  lat_destino?: number | null
  lng_destino?: number | null
  prof_lat?: number | null
  prof_lng?: number | null
  /** Outra parte: turista (visão pro) ou profissional (visão turista). */
  parte: ParteAtendimentoAtivo | null
}

type Props = {
  aberto: boolean
  papel: 'profissional' | 'turista'
  atendimento: AtendimentoAtivoUi
  busy?: boolean
  erroConcluir?: string | null
  onFechar: () => void
  onConcluir?: () => void
  /** Conteúdo extra no rodapé (ex.: checkbox dinheiro / bônus). */
  rodapeExtra?: ReactNode
  onConcluirSemManifesto?: () => void
}

function formatBrl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function labelPagamento(pagamento: string, t: (key: string) => string): string {
  const map: Record<string, string> = {
    dinheiro: 'pag.dinheiro',
    pix: 'pag.pix',
    cartao: 'pag.cartao',
    cartao_credito: 'pag.cartao',
    cartao_debito: 'pag.cartao',
  }
  const key = map[pagamento]
  if (!key) return pagamento
  try {
    return t(key)
  } catch {
    return pagamento
  }
}

function tituloPorStatus(
  status: string,
  papel: 'profissional' | 'turista',
  t: ReturnType<typeof useTranslations<'Mobilidade'>>,
): string {
  const st = String(status)
  if (st === 'em_viagem') return t('drawerAtivoInicio')
  if (st === 'no_local') {
    return papel === 'profissional' ? t('chegadaNoLocalTitulo') : t('chegadaProTitulo')
  }
  if (papel === 'turista') return t('drawerAtivoMotoristaACaminho')
  return t('drawerAtivoEmAndamento')
}

/**
 * Drawer full-screen de atendimento ativo (pós-aceite) — profissional e turista.
 * Fases: EM ANDAMENTO (a_caminho) → no_local → INÍCIO (em_viagem).
 */
export default function DrawerAtendimentoAtivoMobilidade({
  aberto,
  papel,
  atendimento,
  busy = false,
  erroConcluir = null,
  onFechar,
  onConcluir,
  rodapeExtra = null,
  onConcluirSemManifesto,
}: Props) {
  const t = useTranslations('Mobilidade')
  useModalScrollLock(aberto)

  const [resumoAberto, setResumoAberto] = useState(false)
  const [chatAberto, setChatAberto] = useState(false)
  const [chatUnread, setChatUnread] = useState(0)
  const [chatLastReadIso, setChatLastReadIso] = useState<string | null>(null)
  const [manifestoAberto, setManifestoAberto] = useState(false)
  const [etaSec, setEtaSec] = useState<number | null>(null)
  const [etaFase, setEtaFase] = useState<'partida' | 'destino' | null>(null)
  const [periodoRota, setPeriodoRota] = useState<string | null>(null)

  const st = String(atendimento.status ?? 'a_caminho')
  const headerVerde = st === 'em_viagem' || st === 'no_local'
  const headerCor = headerVerde ? VERDE : COR
  const titulo = tituloPorStatus(st, papel, t)
  const HeaderIcon = papel === 'profissional' ? Navigation : Car

  const podeConcluir =
    papel === 'profissional' &&
    st === 'em_viagem' &&
    Boolean(onConcluir) &&
    modalidadeUsaDeslocamentoProprio(atendimento.modalidade)
  /** INÍCIO (guia/van): botão MANIFESTO no lugar do card do turista. */
  const faseInicioManifesto =
    papel === 'profissional' && st === 'em_viagem' && modalidadeUsaManifesto(atendimento.modalidade)

  useEffect(() => {
    if (!aberto) {
      setResumoAberto(false)
      setChatAberto(false)
      setChatUnread(0)
      setChatLastReadIso(null)
      setManifestoAberto(false)
      return
    }
    // Só conta como não lida mensagem chegada depois de abrir o drawer.
    setChatLastReadIso(new Date().toISOString())
  }, [aberto, atendimento.solicitacao_id])

  const parte = atendimento.parte
  const username = String(parte?.username ?? '').replace(/^@+/, '') || 'usuario'

  const agendado = Boolean(atendimento.data_agendada)

  const onMensagensChange = useMemo(
    () => (msgs: { remetente_id: string; created_at: string }[], meuId: string | null) => {
      if (chatAberto || !meuId) {
        if (chatAberto) setChatUnread(0)
        return
      }
      const corte = chatLastReadIso ? new Date(chatLastReadIso).getTime() : 0
      const n = msgs.filter((m) => {
        if (m.remetente_id === meuId) return false
        return new Date(m.created_at).getTime() > corte
      }).length
      setChatUnread(n)
    },
    [chatAberto, chatLastReadIso],
  )

  const trajetoEta = useMemo(
    () =>
      montarTrajetoEtaCorrida({
        status: atendimento.status,
        data_agendada: atendimento.data_agendada,
        origem_nome: atendimento.origem_nome,
        destino_nome: atendimento.destino_nome,
        lat_origem: atendimento.lat_origem,
        lng_origem: atendimento.lng_origem,
        lat_destino: atendimento.lat_destino,
        lng_destino: atendimento.lng_destino,
        prof_lat: atendimento.prof_lat,
        prof_lng: atendimento.prof_lng,
        modalidade: atendimento.modalidade,
      }),
    [
      atendimento.status,
      atendimento.data_agendada,
      atendimento.origem_nome,
      atendimento.destino_nome,
      atendimento.lat_origem,
      atendimento.lng_origem,
      atendimento.lat_destino,
      atendimento.lng_destino,
      atendimento.prof_lat,
      atendimento.prof_lng,
      atendimento.modalidade,
    ],
  )

  useEffect(() => {
    if (!aberto || !trajetoEta) {
      setEtaSec(null)
      setEtaFase(null)
      return
    }
    let cancelled = false
    setEtaFase(trajetoEta.fase)
    void buscarRotaMapboxDriving(trajetoEta.de, trajetoEta.ate).then((rota) => {
      if (cancelled) return
      setEtaSec(rota?.durationSec != null && rota.durationSec > 0 ? rota.durationSec : null)
    })
    return () => {
      cancelled = true
    }
  }, [
    aberto,
    trajetoEta,
  ])

  useEffect(() => {
    if (!aberto) {
      setPeriodoRota(null)
      return
    }
    const cat = String(atendimento.modalidade ?? '').trim()
    const dest = String(atendimento.destino_nome ?? '').trim()
    if (!cat || !dest || cat === 'motorista_app') {
      setPeriodoRota(null)
      return
    }
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('servicos_tabelados_rotas')
        .select('*')
        .eq('ativo', true)
        .eq('categoria', cat)
      if (cancelled) return
      const rotas = (data ?? []).map((r) => mapRotaTabeladaRow(r as Record<string, unknown>))
      const match = encontrarRotaTabeladaPorDestino(rotas, cat, dest)
      setPeriodoRota(match ? descricaoPeriodoRota(match) : null)
    })()
    return () => {
      cancelled = true
    }
  }, [aberto, atendimento.modalidade, atendimento.destino_nome])

  if (!aberto) return null

  return (
    <>
      {createPortal(
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-white"
      style={{ height: 'var(--app-height, 100dvh)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-atendimento-ativo-titulo"
    >
      <div className="shrink-0 pt-safe" style={{ backgroundColor: headerCor }}>
        <div className="flex h-12 items-center gap-2 px-3">
          <HeaderIcon className="h-5 w-5 shrink-0 text-white" aria-hidden />
          <h2
            id="drawer-atendimento-ativo-titulo"
            className="min-w-0 flex-1 truncate text-base font-bold uppercase tracking-wide text-white"
          >
            {titulo}
          </h2>
          <button
            type="button"
            onClick={onFechar}
            className="rounded-lg p-2 text-white/90 hover:bg-white/15"
            aria-label={t('fechar')}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4" data-modal-scroll-lock-scrollable>
        {faseInicioManifesto ? (
          <div className="mb-5 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => setManifestoAberto(true)}
              className="flex w-full max-w-sm items-center justify-center gap-2 rounded-xl py-4 text-sm font-bold uppercase tracking-wide text-white shadow-sm"
              style={{ backgroundColor: COR }}
            >
              <ClipboardList className="h-5 w-5 shrink-0" aria-hidden strokeWidth={2.25} />
              {t('drawerAtivoManifesto')}
            </button>
            {atendimento.manifesto_id ? (
              <p className="text-center text-xs font-medium text-[#0097b2]">
                {t('manifestoRegistrado')}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-0.5 text-center">
            <div
              className="relative mb-1.5 h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100"
              style={{ boxShadow: `0 0 0 4px ${headerCor}` }}
            >
              {parte?.foto_url ? (
                <AvatarImage
                  src={parte.foto_url}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-[#0097b2]">
                  <UserRound className="h-10 w-10" aria-hidden />
                </span>
              )}
            </div>
            <p className="max-w-md text-lg font-bold leading-tight text-gray-900">
              {parte?.nome ||
                (papel === 'profissional'
                  ? t('atendimentoTuristaFallback')
                  : t('atendimentoProfissionalFallback'))}
            </p>
            <UsuarioHandleVerificado
              username={username}
              verificado={Boolean(parte?.verificado)}
              verificadoTipo="profissional"
              notaMedia={parte?.nota_media ?? null}
              asButton={false}
              className="justify-center text-sm font-normal leading-tight text-gray-600"
            />
          </div>
        )}

        {/* Rota */}
        <div className="mt-5 rounded-xl border border-gray-200 bg-[#f5f5f5] px-4 py-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#0097b2]">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            {t('drawerAtivoRota')}
          </div>
          <p className="text-sm text-gray-800">
            <span className="font-semibold text-gray-600">{t('origemLabel')}: </span>
            {atendimento.origem_nome || '—'}
          </p>
          <p className="mt-1 text-sm text-gray-800">
            <span className="font-semibold text-gray-600">{t('destinoLabel')}: </span>
            {atendimento.destino_nome || '—'}
          </p>
          {etaSec != null && etaFase ? (
            <p className="mt-2.5 flex items-center gap-1.5 text-sm font-semibold text-[#0097b2]">
              <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {etaFase === 'destino'
                ? t('etaChegadaDestino', { eta: formatarDuracaoEta(etaSec) })
                : t('etaChegadaPartida', { eta: formatarDuracaoEta(etaSec) })}
            </p>
          ) : null}
        </div>

        {/* Resumo (chevron) */}
        <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white">
          <button
            type="button"
            onClick={() => setResumoAberto((v) => !v)}
            className="flex w-full items-center gap-2 px-3 py-3 text-left"
          >
            <span className="min-w-0 flex-1 text-sm font-bold uppercase tracking-wide text-[#0097b2]">
              {t('resumoCorrida')}
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${
                resumoAberto ? 'rotate-180' : ''
              }`}
              aria-hidden
            />
          </button>
          {resumoAberto ? (
            <ul className="space-y-1.5 border-t border-gray-100 px-4 pb-3 pt-2 text-sm text-gray-800">
              <li>
                <span className="font-semibold text-gray-600">{t('valorCorrida')}: </span>
                {atendimento.valor_estimado != null
                  ? formatBrl(atendimento.valor_estimado)
                  : t('valorIndisponivel')}
              </li>
              {atendimento.pagamento ? (
                <li>
                  <span className="font-semibold text-gray-600">{t('formaPagamento')}: </span>
                  {labelPagamento(atendimento.pagamento, t)}
                </li>
              ) : null}
              <li>
                <span className="font-semibold text-gray-600">{t('resumoPassageiros')}: </span>
                {atendimento.lugares ?? 1}
              </li>
              <li>
                <span className="font-semibold text-gray-600">{t('resumoAgendamento')}: </span>
                {agendado ? t('ecossistemaAtendimentoPre') : t('atendimentoImediato')}
              </li>
              {periodoRota ? (
                <li>
                  <span className="font-semibold text-gray-600">{t('resumoPeriodoRota')}: </span>
                  {periodoRota}
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>

        {papel === 'turista' && atendimento.modalidade !== 'motorista_app' ? (
          <div className="mt-3 flex gap-2 rounded-xl border border-[#0097b2]/30 bg-[#0097b2]/5 px-3 py-2.5 text-sm text-gray-700">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#0097b2]" aria-hidden />
            <p>{t('pagamentoInicioHint')}</p>
          </div>
        ) : null}

        {/* Chat (chevron + badge) */}
        {atendimento.conversa_id ? (
          <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white">
            <button
              type="button"
              onClick={() => {
                setChatAberto((v) => {
                  const next = !v
                  if (next) {
                    setChatUnread(0)
                    setChatLastReadIso(new Date().toISOString())
                  } else {
                    setChatLastReadIso(new Date().toISOString())
                  }
                  return next
                })
              }}
              className="flex w-full items-center gap-2 px-3 py-3 text-left"
            >
              <span className="min-w-0 flex-1 text-sm font-bold uppercase tracking-wide text-[#0097b2]">
                {t('chatTitulo')}
              </span>
              {!chatAberto && chatUnread > 0 ? (
                <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white">
                  {chatUnread > 99 ? '99+' : chatUnread}
                </span>
              ) : null}
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${
                  chatAberto ? 'rotate-180' : ''
                }`}
                aria-hidden
              />
            </button>
            {/* Sempre montado para poll + badge; conteúdo só se aberto */}
            <div className={chatAberto ? 'border-t border-gray-100 px-2 pb-2 pt-1' : ''}>
              <ChatCorridaMobilidade
                conversaId={atendimento.conversa_id}
                visivel={chatAberto}
                onMensagensChange={onMensagensChange}
              />
            </div>
          </div>
        ) : null}
      </div>

      {papel === 'profissional' && modalidadeUsaDeslocamentoProprio(atendimento.modalidade) ? (
        <div className="shrink-0 border-t border-gray-100 p-3 pb-safe">
          {rodapeExtra}
          {erroConcluir ? (
            <div className="mb-2 space-y-1">
              <p className="text-xs text-rose-600">{erroConcluir}</p>
              {erroConcluir.toLowerCase().includes('check-in') && onConcluirSemManifesto ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={onConcluirSemManifesto}
                  className="text-xs font-semibold text-[#0097b2] underline"
                >
                  {t('concluirSemManifesto')}
                </button>
              ) : null}
            </div>
          ) : null}
          <button
            type="button"
            disabled={busy || !podeConcluir}
            onClick={onConcluir}
            className="w-full rounded-xl bg-[#0097b2] py-3 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-50"
          >
            {t('concluirAtendimento')}
          </button>
        </div>
      ) : null}
    </div>,
    document.body,
      )}
      {faseInicioManifesto ? (
        <DrawerManifestoEspaco
          aberto={manifestoAberto}
          onFechar={() => setManifestoAberto(false)}
        />
      ) : null}
    </>
  )
}
