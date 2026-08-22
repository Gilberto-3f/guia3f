'use client'

import { useCallback, useEffect, useState, type SVGProps } from 'react'
import { Briefcase, ChevronDown, ChevronUp, ClipboardList, Navigation, Smile } from 'lucide-react'
import { useTranslations } from 'next-intl'
import ToggleStatusMobilidade from '@/components/mobilidade/ToggleStatusMobilidade'
import DrawerEspacoProfissionalMobilidade from '@/components/mobilidade/DrawerEspacoProfissionalMobilidade'
import DrawerManifestoEspaco from '@/components/mobilidade/DrawerManifestoEspaco'
import CardParteAtendimentoFlutuante from '@/components/mobilidade/CardParteAtendimentoFlutuante'
import type { MobilidadeStatusId } from '@/lib/mobilidadeStatusProfissional'
import {
  ehAtendimentoImediatoAtivo,
  MOBILIDADE_ABRIR_MANIFESTO,
  MOBILIDADE_CORRIDA_PRO,
  MOBILIDADE_LISTA_INICIADA,
  pedirAbrirDrawerAtendimentoAtivo,
  type CorridaProFlutuante,
} from '@/lib/mobilidadeAtendimentoAtivoEventos'

const COR = '#0097b2'
const VERDE = '#00D443'

/** Ícone zZz (sono) — offline profissional. */
function IconZzz(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M4 16h5l-5 5h5" />
      <path d="M10 9h4.5L10 14h4.5" />
      <path d="M16 4h4l-4 4h4" />
    </svg>
  )
}

type TuristaCorrida = {
  nome: string
  username: string | null
  foto_url: string | null
  verificado: boolean
  nota_media: number | null
}

type CorridaAtivaResumo = {
  solicitacao_id: string
  status: string
  data_agendada?: string | null
  turista?: TuristaCorrida | null
  lista_iniciada?: boolean
}

type Props = {
  className?: string
  /** Força o card recolhido (ex.: drawer de atendimento aberto). */
  forcarRecolhido?: boolean
}

/**
 * Card flutuante do profissional na Mobilidade:
 * ONLINE/OFFLINE → em atendimento imediato: header verde + card do turista.
 */
export default function CardStatusProfissionalMobilidade({
  className = '',
  forcarRecolhido = false,
}: Props) {
  const t = useTranslations('Mobilidade')
  const [aberto, setAberto] = useState(false)
  const [status, setStatus] = useState<MobilidadeStatusId>('offline')
  const [toastOffline, setToastOffline] = useState(false)
  const [espacoAberto, setEspacoAberto] = useState(false)
  const [corrida, setCorrida] = useState<CorridaAtivaResumo | null>(null)
  const [manifestoAberto, setManifestoAberto] = useState(false)
  const [listaIniciadaLocal, setListaIniciadaLocal] = useState(false)

  useEffect(() => {
    const onPoll = (ev: Event) => {
      const detail = (ev as CustomEvent<CorridaProFlutuante | null>).detail
      setCorrida(detail ?? null)
      if (detail?.lista_iniciada) setListaIniciadaLocal(true)
      if (!detail) setListaIniciadaLocal(false)
    }
    const onLista = () => {
      setListaIniciadaLocal(true)
      setEspacoAberto(false)
      setAberto(true)
    }
    const onAbrirManifesto = () => {
      setManifestoAberto(true)
      setEspacoAberto(false)
    }
    window.addEventListener(MOBILIDADE_CORRIDA_PRO, onPoll)
    window.addEventListener(MOBILIDADE_LISTA_INICIADA, onLista)
    window.addEventListener(MOBILIDADE_ABRIR_MANIFESTO, onAbrirManifesto)
    return () => {
      window.removeEventListener(MOBILIDADE_CORRIDA_PRO, onPoll)
      window.removeEventListener(MOBILIDADE_LISTA_INICIADA, onLista)
      window.removeEventListener(MOBILIDADE_ABRIR_MANIFESTO, onAbrirManifesto)
    }
  }, [])

  useEffect(() => {
    if (forcarRecolhido) setAberto(false)
  }, [forcarRecolhido])

  useEffect(() => {
    if (!toastOffline) return
    const id = window.setTimeout(() => setToastOffline(false), 5000)
    return () => window.clearTimeout(id)
  }, [toastOffline])

  const onStatusChange = useCallback((prev: MobilidadeStatusId, next: MobilidadeStatusId) => {
    setStatus(next)
    if (next === 'offline' && prev !== 'offline') setToastOffline(true)
    if (next === 'online' || next === 'em_atendimento') setToastOffline(false)
  }, [])

  const listaIniciada = Boolean(corrida?.lista_iniciada || listaIniciadaLocal)
  const emAtendimento = Boolean(
    (corrida &&
      ehAtendimentoImediatoAtivo({
        status: corrida.status,
        data_agendada: corrida.data_agendada,
      })) ||
      listaIniciada,
  )

  useEffect(() => {
    if (emAtendimento && !forcarRecolhido) setAberto(true)
  }, [emAtendimento, corrida?.solicitacao_id, forcarRecolhido])

  const painelAberto = aberto && !forcarRecolhido
  const online = status === 'online' || status === 'em_atendimento' || emAtendimento

  const st = String(corrida?.status ?? '')
  const tituloAtendimento =
    st === 'em_viagem'
      ? t('drawerAtivoInicio')
      : st === 'no_local'
        ? t('chegadaNoLocalTitulo')
        : t('drawerAtivoEmAndamento')

  const titulo = emAtendimento ? tituloAtendimento : online ? t('statusOnline') : t('statusOffline')
  const headerCor = emAtendimento ? VERDE : COR

  return (
    <>
      <div className={`w-full max-w-lg ${className}`}>
        <div
          className={`bg-white shadow-lg ring-1 ring-black/10 ${
            painelAberto ? 'rounded-2xl' : 'overflow-hidden rounded-2xl'
          }`}
        >
          <button
            type="button"
            onClick={() => {
              if (forcarRecolhido) return
              setAberto((v) => !v)
            }}
            className={`flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-white ${
              painelAberto ? 'rounded-t-2xl' : 'rounded-2xl'
            }`}
            style={{ backgroundColor: headerCor }}
            aria-expanded={painelAberto}
            aria-label={titulo}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              {emAtendimento ? (
                <Navigation className="h-5 w-5 shrink-0 text-white" aria-hidden strokeWidth={2} />
              ) : online ? (
                <Smile className="h-5 w-5 shrink-0 text-white" aria-hidden strokeWidth={2} />
              ) : (
                <IconZzz className="h-5 w-5 shrink-0 text-white" />
              )}
              <p className="text-base font-extrabold uppercase tracking-wide text-white">{titulo}</p>
            </div>
            {painelAberto ? (
              <ChevronUp className="h-5 w-5 shrink-0 text-white" aria-hidden />
            ) : (
              <ChevronDown className="h-5 w-5 shrink-0 text-white" aria-hidden />
            )}
          </button>

          <div
            className={painelAberto ? 'space-y-3 px-4 py-4' : 'hidden'}
            aria-hidden={!painelAberto}
          >
            {emAtendimento ? (
              <>
                {listaIniciada ? (
                  <button
                    type="button"
                    onClick={() => setManifestoAberto(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold uppercase tracking-wide text-white shadow-sm"
                    style={{ backgroundColor: COR }}
                  >
                    <ClipboardList className="h-4 w-4 shrink-0" aria-hidden strokeWidth={2.25} />
                    {t('manifestoAtalhoLista')}
                  </button>
                ) : null}
                {listaIniciada ? (
                  <ToggleStatusMobilidade
                    variant="card"
                    corOffline={COR}
                    onStatusChange={onStatusChange}
                  />
                ) : null}
                {corrida?.solicitacao_id ? (
                <CardParteAtendimentoFlutuante
                  parte={
                    corrida?.turista
                      ? {
                          nome: corrida.turista.nome,
                          username: corrida.turista.username,
                          foto_url: corrida.turista.foto_url,
                          verificado: corrida.turista.verificado,
                          nota_media: corrida.turista.nota_media,
                        }
                      : null
                  }
                  fallbackNome={t('atendimentoTuristaFallback')}
                  onAbrir={pedirAbrirDrawerAtendimentoAtivo}
                  ariaLabel={t('drawerAtivoAbrirDetalhe')}
                />
                ) : null}
              </>
            ) : (
              <>
                <ToggleStatusMobilidade
                  variant="card"
                  corOffline={COR}
                  onStatusChange={onStatusChange}
                />

                <button
                  type="button"
                  onClick={() => setEspacoAberto(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-sm transition-opacity hover:opacity-95"
                  style={{ backgroundColor: COR }}
                >
                  <Briefcase className="h-4 w-4 shrink-0" aria-hidden strokeWidth={2.5} />
                  {t('espacoProfissionalBotao')}
                </button>

                {toastOffline ? (
                  <div
                    className="rounded-xl px-3 py-3 text-center text-sm font-semibold text-white shadow"
                    style={{ backgroundColor: COR }}
                  >
                    {t('toastOffline')}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>

      <DrawerEspacoProfissionalMobilidade
        aberto={espacoAberto}
        onFechar={() => setEspacoAberto(false)}
      />
      <DrawerManifestoEspaco
        aberto={manifestoAberto}
        onFechar={() => setManifestoAberto(false)}
        abrirListaDoDia
      />
    </>
  )
}
