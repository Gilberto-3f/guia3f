'use client'

import { useCallback, useEffect, useState, type SVGProps } from 'react'
import { Briefcase, ChevronDown, ChevronUp, Smile } from 'lucide-react'
import { useTranslations } from 'next-intl'
import ToggleStatusMobilidade from '@/components/mobilidade/ToggleStatusMobilidade'
import DrawerEspacoProfissionalMobilidade from '@/components/mobilidade/DrawerEspacoProfissionalMobilidade'
import type { MobilidadeStatusId } from '@/lib/mobilidadeStatusProfissional'

const COR = '#0097b2'

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

type Props = {
  className?: string
  /** Força o card recolhido (ex.: drawer de atendimento aberto). */
  forcarRecolhido?: boolean
}

/**
 * Card flutuante do profissional na Mobilidade:
 * título ONLINE/OFFLINE, toggle no chevron, Espaço Profissional.
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

  useEffect(() => {
    if (forcarRecolhido) setAberto(false)
  }, [forcarRecolhido])

  useEffect(() => {
    let ativo = true
    void (async () => {
      try {
        const res = await fetch('/api/profissional/mobilidade-status')
        const json = (await res.json()) as { status?: string }
        if (!ativo || !res.ok) return
        const s = String(json.status ?? '').toLowerCase()
        if (s === 'online' || s === 'em_atendimento' || s === 'offline') {
          setStatus(s as MobilidadeStatusId)
        }
      } catch {
        /* ignore */
      }
    })()
    return () => {
      ativo = false
    }
  }, [])

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

  const painelAberto = aberto && !forcarRecolhido
  const online = status === 'online' || status === 'em_atendimento'
  const titulo = online ? t('statusOnline') : t('statusOffline')

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
            style={{ backgroundColor: COR }}
            aria-expanded={painelAberto}
            aria-label={titulo}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              {online ? (
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

          {/* Toggle sempre montado (evita flash de loading ao abrir o chevron). */}
          <div
            className={painelAberto ? 'space-y-3 px-4 py-4' : 'hidden'}
            aria-hidden={!painelAberto}
          >
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
          </div>
        </div>
      </div>

      <DrawerEspacoProfissionalMobilidade
        aberto={espacoAberto}
        onFechar={() => setEspacoAberto(false)}
      />
    </>
  )
}
