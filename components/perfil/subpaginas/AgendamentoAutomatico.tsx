'use client'

import { useCallback, useEffect, useState } from 'react'

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

type Agendamento = {
  solicitacao_id: string
  status: string
  origem_nome: string | null
  destino_nome: string | null
  data_agendada: string | null
  confirmacao_expira_em: string | null
  lugares: number
}

/** Agenda de disponibilidade + confirmações (placa vermelha). */
export default function AgendamentoAutomatico() {
  const [slots, setSlots] = useState<Slot[]>([])
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState('')
  const [msg, setMsg] = useState('')
  const [data, setData] = useState('')
  const [horaInicio, setHoraInicio] = useState('08:00')
  const [horaFim, setHoraFim] = useState('20:00')
  const [vagas, setVagas] = useState(4)

  const carregar = useCallback(async () => {
    setErro('')
    try {
      const [r1, r2] = await Promise.all([
        fetch('/api/profissional/mobilidade-disponibilidade'),
        fetch('/api/mobilidade/agendamentos-pendentes'),
      ])
      const j1 = (await r1.json()) as { slots?: Slot[]; error?: string }
      const j2 = (await r2.json()) as { agendamentos?: Agendamento[]; error?: string }
      if (!r1.ok) {
        setErro(String(j1.error ?? 'Não foi possível carregar a agenda.'))
        return
      }
      setSlots(Array.isArray(j1.slots) ? j1.slots : [])
      if (r2.ok) setAgendamentos(Array.isArray(j2.agendamentos) ? j2.agendamentos : [])
    } catch {
      setErro('Falha de rede ao carregar agenda.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const salvar = async () => {
    if (!data) {
      setErro('Informe a data.')
      return
    }
    setBusy(true)
    setErro('')
    setMsg('')
    try {
      const res = await fetch('/api/profissional/mobilidade-disponibilidade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data,
          hora_inicio: horaInicio,
          hora_fim: horaFim,
          vagas_total: vagas,
        }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        setErro(String(json.error ?? 'Falha ao salvar.'))
        return
      }
      setMsg('Disponibilidade salva.')
      setData('')
      await carregar()
    } finally {
      setBusy(false)
    }
  }

  const remover = async (id: string) => {
    setBusy(true)
    try {
      await fetch(`/api/profissional/mobilidade-disponibilidade?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      await carregar()
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
        <h3 className="text-sm font-bold text-[#0097b2]">Disponibilidade</h3>
        <p className="mt-1 text-xs text-gray-500">
          Publique datas e vagas. Turistas só conseguem agendar em horários com vaga livre (placa
          vermelha).
        </p>
      </div>

      <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-3">
        <label className="block text-xs text-gray-600">
          Data
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </label>
        <div className="flex gap-2">
          <label className="flex-1 text-xs text-gray-600">
            Início
            <input
              type="time"
              value={horaInicio}
              onChange={(e) => setHoraInicio(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex-1 text-xs text-gray-600">
            Fim
            <input
              type="time"
              value={horaFim}
              onChange={(e) => setHoraFim(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="w-20 text-xs text-gray-600">
            Vagas
            <input
              type="number"
              min={1}
              max={50}
              value={vagas}
              onChange={(e) => setVagas(Math.max(1, Number(e.target.value) || 1))}
              className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-2 text-sm"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void salvar()}
          className="w-full rounded-xl bg-[#00D443] py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          Salvar disponibilidade
        </button>
      </div>

      {erro ? <p className="text-xs text-rose-600">{erro}</p> : null}
      {msg ? <p className="text-xs text-[#00D443]">{msg}</p> : null}

      <ul className="space-y-2">
        {slots.length === 0 ? (
          <li className="rounded-xl border border-dashed border-gray-200 px-3 py-6 text-center text-sm text-gray-500">
            Nenhuma data publicada ainda.
          </li>
        ) : (
          slots.map((s) => (
            <li
              key={s.id}
              className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm ${
                s.ativo ? 'border-gray-200 bg-white' : 'border-amber-200 bg-amber-50'
              }`}
            >
              <div>
                <p className="font-semibold text-gray-900">
                  {s.data} · {s.hora_inicio}–{s.hora_fim}
                </p>
                <p className="text-xs text-gray-500">
                  {s.vagas_ocupadas}/{s.vagas_total} ocupadas
                  {!s.ativo ? ' · inativo' : ''}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void remover(s.id)}
                className="text-xs font-semibold text-rose-600"
              >
                Remover
              </button>
            </li>
          ))
        )}
      </ul>

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
                {a.data_agendada
                  ? new Date(a.data_agendada).toLocaleString('pt-BR')
                  : '—'}{' '}
                · {a.lugares} pax
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
