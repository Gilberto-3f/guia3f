'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronLeft, ChevronRight, Trash2, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useModalScrollLock } from '@/lib/useModalScrollLock'
import {
  COR_AZUL_LOGO,
  COR_VERDE_BOTAO,
  listarDatasDoMes,
} from '@/lib/hospedagemCalendario'

const COR = '#0097b2'
const COR_SEM_SLOT = '#e8e8e8'
const COR_PASSADO = '#c4c4c4'

type Slot = {
  id: string
  data: string
  hora_inicio: string
  hora_fim: string
  vagas_total: number
  vagas_ocupadas: number
  vagas_livres?: number
  ativo: boolean
}

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

function formatarDataBrCompleta(iso: string): string {
  const s = String(iso).slice(0, 10)
  const [y, m, d] = s.split('-')
  if (!y || !m || !d) return s
  return `${d}/${m}/${y}`
}

type StatusDia = 'passado' | 'livre' | 'lotado' | 'vazio'

function statusDia(iso: string, slotsDoDia: Slot[], hoje: string): StatusDia {
  if (iso < hoje) return 'passado'
  const ativos = slotsDoDia.filter((s) => s.ativo)
  if (ativos.length === 0) return 'vazio'
  const livres = ativos.reduce(
    (acc, s) => acc + (s.vagas_livres ?? s.vagas_total - s.vagas_ocupadas),
    0,
  )
  return livres > 0 ? 'livre' : 'lotado'
}

function corStatus(st: StatusDia): string {
  if (st === 'passado') return COR_PASSADO
  if (st === 'livre') return COR_VERDE_BOTAO
  if (st === 'lotado') return COR_AZUL_LOGO
  return COR_SEM_SLOT
}

/**
 * Drawer Calendário no Espaço Profissional: grade mensal + edição de vagas do dia.
 * Reusa `/api/profissional/mobilidade-disponibilidade`.
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
  const [slots, setSlots] = useState<Slot[]>([])
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null)

  const [horaInicio, setHoraInicio] = useState('08:00')
  const [horaFim, setHoraFim] = useState('20:00')
  const [vagas, setVagas] = useState(4)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro('')
    try {
      const res = await fetch('/api/profissional/mobilidade-disponibilidade')
      const json = (await res.json()) as { slots?: Slot[]; error?: string }
      if (!res.ok) {
        setErro(String(json.error ?? t('calendarioErro')))
        setSlots([])
        return
      }
      setSlots(Array.isArray(json.slots) ? json.slots : [])
    } catch {
      setErro(t('calendarioErro'))
      setSlots([])
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (!aberto) {
      setDiaSelecionado(null)
      setMsg('')
      setErro('')
      return
    }
    void carregar()
  }, [aberto, carregar])

  const slotsPorData = useMemo(() => {
    const map = new Map<string, Slot[]>()
    for (const s of slots) {
      const d = String(s.data).slice(0, 10)
      const cur = map.get(d) ?? []
      cur.push(s)
      map.set(d, cur)
    }
    return map
  }, [slots])

  const cells = useMemo(() => listarDatasDoMes(ano, mes), [ano, mes])
  const tituloMes = useMemo(
    () =>
      new Date(ano, mes, 1).toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric',
      }),
    [ano, mes],
  )

  const slotsDoDia = useMemo(() => {
    if (!diaSelecionado) return []
    return slotsPorData.get(diaSelecionado) ?? []
  }, [diaSelecionado, slotsPorData])

  const prevMes = () => {
    if (mes === 0) {
      setMes(11)
      setAno((a) => a - 1)
    } else setMes((m) => m - 1)
  }

  const nextMes = () => {
    if (mes === 11) {
      setMes(0)
      setAno((a) => a + 1)
    } else setMes((m) => m + 1)
  }

  const salvarSlot = async () => {
    if (!diaSelecionado || busy) return
    setBusy(true)
    setErro('')
    setMsg('')
    try {
      const res = await fetch('/api/profissional/mobilidade-disponibilidade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: diaSelecionado,
          hora_inicio: horaInicio,
          hora_fim: horaFim,
          vagas_total: vagas,
        }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        setErro(String(json.error ?? t('calendarioErroSalvar')))
        return
      }
      setMsg(t('calendarioSalvo'))
      await carregar()
    } catch {
      setErro(t('calendarioErroSalvar'))
    } finally {
      setBusy(false)
    }
  }

  const removerSlot = async (id: string) => {
    if (busy) return
    setBusy(true)
    setErro('')
    setMsg('')
    try {
      const res = await fetch(
        `/api/profissional/mobilidade-disponibilidade?id=${encodeURIComponent(id)}`,
        { method: 'DELETE' },
      )
      const json = (await res.json()) as { error?: string; desativado?: boolean }
      if (!res.ok) {
        setErro(String(json.error ?? t('calendarioErroRemover')))
        return
      }
      setMsg(json.desativado ? t('calendarioDesativado') : t('calendarioRemovido'))
      await carregar()
    } catch {
      setErro(t('calendarioErroRemover'))
    } finally {
      setBusy(false)
    }
  }

  /** Remove/desativa todos os slots do dia (bloquear agendamento). */
  const bloquearDia = async () => {
    if (!diaSelecionado || busy || slotsDoDia.length === 0) return
    setBusy(true)
    setErro('')
    setMsg('')
    try {
      for (const s of slotsDoDia) {
        await fetch(
          `/api/profissional/mobilidade-disponibilidade?id=${encodeURIComponent(s.id)}`,
          { method: 'DELETE' },
        )
      }
      setMsg(t('calendarioDiaBloqueado'))
      await carregar()
    } catch {
      setErro(t('calendarioErroRemover'))
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
            {diaSelecionado
              ? formatarDataBrCompleta(diaSelecionado)
              : t('espacoAcao.calendario.titulo')}
          </h2>
          <button
            type="button"
            onClick={() => {
              if (diaSelecionado) {
                setDiaSelecionado(null)
                setMsg('')
                setErro('')
                return
              }
              onFechar()
            }}
            className="rounded-lg p-2 text-white/90 hover:bg-white/15"
            aria-label={diaSelecionado ? t('retornar') : t('fechar')}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4" data-modal-scroll-lock-scrollable>
        {diaSelecionado ? (
          <div className="space-y-4">
            <p className="text-center text-sm text-gray-600">{t('calendarioHintDia')}</p>

            <div className="space-y-2 rounded-xl border border-gray-200 bg-[#f5f5f5] p-3">
              <div className="flex gap-2">
                <label className="flex-1 text-xs text-gray-600">
                  {t('calendarioInicio')}
                  <input
                    type="time"
                    value={horaInicio}
                    onChange={(e) => setHoraInicio(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="flex-1 text-xs text-gray-600">
                  {t('calendarioFim')}
                  <input
                    type="time"
                    value={horaFim}
                    onChange={(e) => setHoraFim(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="w-20 text-xs text-gray-600">
                  {t('calendarioVagas')}
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={vagas}
                    onChange={(e) => setVagas(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm"
                  />
                </label>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void salvarSlot()}
                className="w-full rounded-xl bg-[#00D443] py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {t('calendarioPublicar')}
              </button>
            </div>

            {slotsDoDia.length > 0 ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void bloquearDia()}
                className="w-full rounded-xl border border-rose-200 bg-rose-50 py-2.5 text-sm font-bold text-rose-700 disabled:opacity-50"
              >
                {t('calendarioBloquearDia')}
              </button>
            ) : null}

            {erro ? <p className="text-center text-xs text-rose-600">{erro}</p> : null}
            {msg ? <p className="text-center text-xs text-[#00D443]">{msg}</p> : null}

            <ul className="space-y-2">
              {slotsDoDia.length === 0 ? (
                <li className="rounded-xl border border-dashed border-gray-200 px-3 py-6 text-center text-sm text-gray-400">
                  {t('calendarioSemSlotsDia')}
                </li>
              ) : (
                slotsDoDia.map((s) => {
                  const livres = s.vagas_livres ?? s.vagas_total - s.vagas_ocupadas
                  return (
                    <li
                      key={s.id}
                      className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900">
                          {s.hora_inicio} – {s.hora_fim}
                        </p>
                        <p className="text-xs text-gray-500">
                          {t('calendarioVagasResumo', {
                            livres,
                            total: s.vagas_total,
                          })}
                          {!s.ativo ? ` · ${t('calendarioInativo')}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void removerSlot(s.id)}
                        className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                        aria-label={t('calendarioRemoverSlot')}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          </div>
        ) : (
          <>
            {loading ? (
              <p className="animate-pulse py-8 text-center text-sm text-gray-400">…</p>
            ) : null}
            {erro && !loading ? (
              <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-center text-sm text-rose-700">
                {erro}
              </p>
            ) : null}

            <p className="mb-3 text-center text-sm text-gray-600">{t('calendarioHintGrade')}</p>

            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={prevMes}
                  className="rounded-lg p-1.5 text-[#0097b2] hover:bg-[#0097b2]/10"
                  aria-label={t('calendarioMesAnterior')}
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden />
                </button>
                <p className="text-sm font-bold capitalize text-[#001f3f]">{tituloMes}</p>
                <button
                  type="button"
                  onClick={nextMes}
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
                  const st = statusDia(iso, slotsPorData.get(iso) ?? [], hoje)
                  const clicavel = st !== 'passado'
                  const textColor = st === 'vazio' ? '#666666' : '#ffffff'
                  return (
                    <button
                      key={iso}
                      type="button"
                      disabled={!clicavel}
                      onClick={() => {
                        if (!clicavel) return
                        setDiaSelecionado(iso)
                        setMsg('')
                        setErro('')
                      }}
                      className="aspect-square rounded-md text-[11px] font-semibold disabled:cursor-default"
                      style={{ backgroundColor: corStatus(st), color: textColor }}
                      title={
                        st === 'passado'
                          ? t('calendarioLegendaPassado')
                          : st === 'livre'
                            ? t('calendarioLegendaLivre')
                            : st === 'lotado'
                              ? t('calendarioLegendaLotado')
                              : t('calendarioLegendaVazio')
                      }
                    >
                      {Number(iso.slice(8, 10))}
                    </button>
                  )
                })}
              </div>

              <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-gray-600">
                <span className="inline-flex items-center gap-1">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: COR_VERDE_BOTAO }}
                  />
                  {t('calendarioLegendaLivre')}
                </span>
                <span className="inline-flex items-center gap-1">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: COR_AZUL_LOGO }}
                  />
                  {t('calendarioLegendaLotado')}
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COR_SEM_SLOT }} />
                  {t('calendarioLegendaVazio')}
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#c4c4c4]" />
                  {t('calendarioLegendaPassado')}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
