'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Ban, CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useModalScrollLock } from '@/lib/useModalScrollLock'
import { listarDatasDoMes } from '@/lib/hospedagemCalendario'
import {
  corStatusDiaMobilidade,
  statusDiaMobilidade,
  type BloqueioMobilidade,
} from '@/lib/mobilidadeBloqueiosCalendario'

const COR = '#0097b2'

type Props = {
  aberto: boolean
  onFechar: () => void
}

function hojeIsoLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Calendário Espaço Profissional — modelo hospedagem:
 * verde = disponível; azul = bloqueado. Seleciona dias e bloqueia/desbloqueia.
 */
export default function DrawerCalendarioEspaco({ aberto, onFechar }: Props) {
  const t = useTranslations('Mobilidade')
  useModalScrollLock(aberto)

  const hoje = hojeIsoLocal()
  const now = new Date()
  const [ano, setAno] = useState(now.getFullYear())
  const [mes, setMes] = useState(now.getMonth())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState('')
  const [msg, setMsg] = useState('')
  const [bloqueios, setBloqueios] = useState<BloqueioMobilidade[]>([])
  const [selecao, setSelecao] = useState<Set<string>>(() => new Set())

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro('')
    try {
      const res = await fetch('/api/profissional/mobilidade-disponibilidade')
      const json = (await res.json()) as {
        bloqueios?: BloqueioMobilidade[]
        error?: string
      }
      if (!res.ok) {
        setErro(String(json.error ?? t('calendarioErro')))
        setBloqueios([])
        return
      }
      setBloqueios(Array.isArray(json.bloqueios) ? json.bloqueios : [])
    } catch {
      setErro(t('calendarioErro'))
      setBloqueios([])
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (!aberto) {
      setSelecao(new Set())
      setMsg('')
      setErro('')
      return
    }
    void carregar()
  }, [aberto, carregar])

  const bloqueadosSet = useMemo(() => {
    const s = new Set<string>()
    for (const b of bloqueios) {
      const d = String(b.data).slice(0, 10)
      if (d) s.add(d)
    }
    return s
  }, [bloqueios])

  const cells = useMemo(() => listarDatasDoMes(ano, mes), [ano, mes])
  const tituloMes = useMemo(
    () =>
      new Date(ano, mes, 1).toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric',
      }),
    [ano, mes],
  )

  const toggleDia = (iso: string) => {
    if (iso < hoje) return
    setSelecao((prev) => {
      const next = new Set(prev)
      if (next.has(iso)) next.delete(iso)
      else next.add(iso)
      return next
    })
    setMsg('')
    setErro('')
  }

  const aplicar = async (acao: 'bloquear' | 'desbloquear') => {
    if (selecao.size === 0 || busy) {
      setErro(t('calendarioSelecioneDatas'))
      return
    }
    setBusy(true)
    setErro('')
    setMsg('')
    try {
      const res = await fetch('/api/profissional/mobilidade-disponibilidade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao, datas: [...selecao] }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        setErro(String(json.error ?? t('calendarioErroSalvar')))
        return
      }
      setMsg(acao === 'bloquear' ? t('calendarioDatasBloqueadas') : t('calendarioDatasDesbloqueadas'))
      setSelecao(new Set())
      await carregar()
    } catch {
      setErro(t('calendarioErroSalvar'))
    } finally {
      setBusy(false)
    }
  }

  if (!aberto) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex flex-col bg-white"
      style={{ height: 'var(--app-height, 100dvh)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-calendario-titulo"
    >
      <div className="shrink-0 pt-safe" style={{ backgroundColor: COR }}>
        <div className="flex h-12 items-center gap-2 px-3">
          <CalendarDays className="h-5 w-5 shrink-0 text-white" aria-hidden />
          <h2
            id="drawer-calendario-titulo"
            className="min-w-0 flex-1 truncate text-base font-bold uppercase tracking-wide text-white"
          >
            {t('espacoAcao.calendario.titulo')}
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
        <p className="mb-3 text-sm text-gray-600">{t('calendarioHintBloqueio')}</p>

        {loading ? (
          <p className="animate-pulse py-8 text-center text-sm text-gray-400">…</p>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    if (mes === 0) {
                      setMes(11)
                      setAno((a) => a - 1)
                    } else setMes((m) => m - 1)
                  }}
                  className="rounded-lg p-1.5 text-[#0097b2] hover:bg-[#0097b2]/10"
                  aria-label={t('calendarioMesAnterior')}
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden />
                </button>
                <p className="text-sm font-bold capitalize text-[#001f3f]">{tituloMes}</p>
                <button
                  type="button"
                  onClick={() => {
                    if (mes === 11) {
                      setMes(0)
                      setAno((a) => a + 1)
                    } else setMes((m) => m + 1)
                  }}
                  className="rounded-lg p-1.5 text-[#0097b2] hover:bg-[#0097b2]/10"
                  aria-label={t('calendarioProximoMes')}
                >
                  <ChevronRight className="h-5 w-5" aria-hidden />
                </button>
              </div>

              <div className="mb-1 grid grid-cols-7 gap-1">
                {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => (
                  <div key={d} className="text-center text-[10px] font-semibold text-gray-500">
                    {d}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {cells.map((iso, idx) => {
                  if (!iso) return <div key={`e-${idx}`} className="aspect-square" />
                  const st = statusDiaMobilidade(iso, bloqueadosSet, hoje)
                  const selecionado = selecao.has(iso)
                  const clicavel = st !== 'passado'
                  const bg = selecionado ? '#001f3f' : corStatusDiaMobilidade(st)
                  const textColor = st === 'passado' && !selecionado ? '#666666' : '#ffffff'
                  return (
                    <button
                      key={iso}
                      type="button"
                      disabled={!clicavel}
                      onClick={() => toggleDia(iso)}
                      className="aspect-square rounded-md text-[11px] font-semibold disabled:cursor-default"
                      style={{
                        backgroundColor: bg,
                        color: textColor,
                        outline: selecionado ? '2px solid #00D443' : undefined,
                        outlineOffset: 1,
                      }}
                    >
                      {Number(iso.slice(8, 10))}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 text-[11px] text-gray-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-[#00D443]" aria-hidden /> {t('calendarioLegendaLivre')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-[#0097b2]" aria-hidden /> {t('calendarioLegendaBloqueado')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-[#001f3f]" aria-hidden /> {t('calendarioLegendaSelecao')}
              </span>
            </div>
            <p className="text-[10px] text-gray-500">{t('calendarioHintLegenda')}</p>

            {erro ? (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-xs text-red-700">{erro}</p>
            ) : null}
            {msg ? (
              <p className="rounded-xl bg-emerald-50 px-3 py-2 text-center text-xs font-semibold text-emerald-800">
                {msg}
              </p>
            ) : null}

            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={busy || selecao.size === 0}
                onClick={() => void aplicar('bloquear')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-50"
                style={{ backgroundColor: COR }}
              >
                <Ban className="h-4 w-4" aria-hidden />
                {t('calendarioBloquearSelecionadas')}
              </button>
              <button
                type="button"
                disabled={busy || selecao.size === 0}
                onClick={() => void aplicar('desbloquear')}
                className="w-full rounded-xl border border-[#0097b2] py-3 text-sm font-bold text-[#0097b2] disabled:opacity-50"
              >
                {t('calendarioDesbloquearSelecionadas')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
