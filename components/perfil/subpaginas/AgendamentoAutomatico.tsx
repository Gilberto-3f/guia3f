'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Ban, ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { listarDatasDoMes } from '@/lib/hospedagemCalendario'
import {
  corStatusDiaMobilidade,
  statusDiaMobilidade,
  type BloqueioMobilidade,
} from '@/lib/mobilidadeBloqueiosCalendario'

const COR = '#0097b2'

type Agendamento = {
  solicitacao_id: string
  status: string
  origem_nome: string | null
  destino_nome: string | null
  data_agendada: string | null
  confirmacao_expira_em: string | null
  lugares: number
}

function hojeIsoLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Agenda: bloqueios (modelo hospedagem) + confirmações de corridas agendadas. */
export default function AgendamentoAutomatico() {
  const t = useTranslations('Mobilidade')
  const hoje = hojeIsoLocal()
  const now = new Date()
  const [ano, setAno] = useState(now.getFullYear())
  const [mes, setMes] = useState(now.getMonth())
  const [bloqueios, setBloqueios] = useState<BloqueioMobilidade[]>([])
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [selecao, setSelecao] = useState<Set<string>>(() => new Set())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState('')
  const [msg, setMsg] = useState('')

  const carregar = useCallback(async () => {
    setErro('')
    try {
      const [r1, r2] = await Promise.all([
        fetch('/api/profissional/mobilidade-disponibilidade'),
        fetch('/api/mobilidade/agendamentos-pendentes'),
      ])
      const j1 = (await r1.json()) as { bloqueios?: BloqueioMobilidade[]; error?: string }
      const j2 = (await r2.json()) as { agendamentos?: Agendamento[]; error?: string }
      if (!r1.ok) {
        setErro(String(j1.error ?? t('calendarioErro')))
        setBloqueios([])
        return
      }
      setBloqueios(Array.isArray(j1.bloqueios) ? j1.bloqueios : [])
      if (r2.ok) setAgendamentos(Array.isArray(j2.agendamentos) ? j2.agendamentos : [])
    } catch {
      setErro(t('calendarioErro'))
      setBloqueios([])
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void carregar()
  }, [carregar])

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

  const acaoAgendamento = async (id: string, acao: 'confirmar' | 'cancelar') => {
    setBusy(true)
    setErro('')
    try {
      const res = await fetch(`/api/mobilidade/agendamento/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        setErro(String(json.error ?? 'Falha na ação.'))
        return
      }
      await carregar()
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <p className="px-1 py-6 text-center text-sm text-gray-500">Carregando agenda…</p>
  }

  return (
    <div className="space-y-5 px-1 pb-2">
      <div>
        <h3 className="text-sm font-bold text-[#0097b2]">{t('espacoAcao.calendario.titulo')}</h3>
        <p className="mt-1 text-xs text-gray-500">{t('calendarioHintBloqueio')}</p>
      </div>

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

      {erro ? <p className="text-xs text-rose-600">{erro}</p> : null}
      {msg ? <p className="text-xs font-semibold text-[#00D443]">{msg}</p> : null}

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

      {agendamentos.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-[#0097b2]">Corridas agendadas</h3>
          {agendamentos.map((a) => (
            <div key={a.solicitacao_id} className="rounded-xl border border-gray-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase text-[#0097b2]">
                {a.status === 'aguardando_confirmacao' ? 'Confirmar agora' : 'Agendada'}
              </p>
              <p className="mt-1 text-sm text-gray-800">
                {a.origem_nome || '—'} → {a.destino_nome || '—'}
              </p>
              <p className="text-xs text-gray-500">
                {a.data_agendada ? new Date(a.data_agendada).toLocaleString('pt-BR') : '—'} ·{' '}
                {a.lugares} pax
              </p>
              <div className="mt-2 flex gap-2">
                {a.status === 'aguardando_confirmacao' || a.status === 'agendada' ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void acaoAgendamento(a.solicitacao_id, 'confirmar')}
                    className="flex-1 rounded-lg bg-[#00D443] py-2 text-xs font-bold text-white"
                  >
                    Confirmar
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void acaoAgendamento(a.solicitacao_id, 'cancelar')}
                  className="flex-1 rounded-lg border border-gray-200 py-2 text-xs font-semibold text-gray-700"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
