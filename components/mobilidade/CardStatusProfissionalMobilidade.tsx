'use client'

import { useCallback, useEffect, useState } from 'react'
import { Briefcase, ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import ToggleStatusMobilidade from '@/components/mobilidade/ToggleStatusMobilidade'
import DrawerEspacoProfissionalMobilidade from '@/components/mobilidade/DrawerEspacoProfissionalMobilidade'
import type { MobilidadeStatusId } from '@/lib/mobilidadeStatusProfissional'

const COR = '#0097b2'

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
              <Briefcase className="h-5 w-5 shrink-0 text-white" aria-hidden strokeWidth={2} />
              <p className="text-base font-extrabold uppercase tracking-wide text-white">{titulo}</p>
            </div>
            {painelAberto ? (
              <ChevronUp className="h-5 w-5 shrink-0 text-white" aria-hidden />
            ) : (
              <ChevronDown className="h-5 w-5 shrink-0 text-white" aria-hidden />
            )}
          </button>

          {painelAberto ? (
            <div className="space-y-3 px-4 py-4">
              <ToggleStatusMobilidade
                variant="card"
                corOffline={COR}
                onStatusChange={onStatusChange}
              />

              {toastOffline ? (
                <div
                  className="rounded-xl px-3 py-3 text-center text-sm font-semibold text-white shadow"
                  style={{ backgroundColor: COR }}
                >
                  {t('toastOffline')}
                </div>
              ) : null}

              {online ? (
                <button
                  type="button"
                  onClick={() => setEspacoAberto(true)}
                  className="w-full rounded-xl py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-sm transition-opacity hover:opacity-95"
                  style={{ backgroundColor: COR }}
                >
                  {t('espacoProfissionalBotao')}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <DrawerEspacoProfissionalMobilidade
        aberto={espacoAberto}
        onFechar={() => setEspacoAberto(false)}
      />
    </>
  )
}
