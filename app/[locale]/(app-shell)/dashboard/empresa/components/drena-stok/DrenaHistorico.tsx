'use client'

import { useState } from 'react'
import type { PontoHistorico, SnapshotMensalRow } from '@/lib/drenaAnalytics'

type Props = {
  ano: number
  mes: number
  onAno: (n: number) => void
  onMes: (n: number) => void
  termo: string
  onTermo: (t: string) => void
  snapshot: SnapshotMensalRow[]
  serie: PontoHistorico[]
  labelMes: (mes: number) => string
}

function LinhaSvg({ serie }: { serie: PontoHistorico[] }) {
  if (!serie.length) {
    return (
      <p className="text-sm text-gray-400">
        Digite um termo (≥2 letras) e clique em Buscar para ver a evolução mensal.
      </p>
    )
  }

  const w = 320
  const h = 120
  const pad = 16
  const max = Math.max(...serie.map((p) => p.total), 1)
  const pts = serie.map((p, i) => {
    const x = pad + (i * (w - pad * 2)) / Math.max(serie.length - 1, 1)
    const y = h - pad - (p.total / max) * (h - pad * 2)
    return `${x},${y}`
  })

  return (
    <div>
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} className="max-w-full">
        <polyline fill="none" stroke="#0097b2" strokeWidth="2.5" points={pts.join(' ')} />
        {serie.map((p, i) => {
          const x = pad + (i * (w - pad * 2)) / Math.max(serie.length - 1, 1)
          const y = h - pad - (p.total / max) * (h - pad * 2)
          return <circle key={p.label} cx={x} cy={y} r="3" fill="#00D443" />
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-gray-400">
        <span>{serie[0]?.label}</span>
        <span>{serie[serie.length - 1]?.label}</span>
      </div>
      <p className="mt-2 text-xs text-gray-500">
        Pico: {max.toLocaleString('pt-BR')} intenções · Último mês:{' '}
        {(serie[serie.length - 1]?.total ?? 0).toLocaleString('pt-BR')}
      </p>
    </div>
  )
}

export default function DrenaHistorico({
  ano,
  mes,
  onAno,
  onMes,
  termo,
  onTermo,
  snapshot,
  serie,
  labelMes,
}: Props) {
  const [rascunho, setRascunho] = useState(termo)
  const anos = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold text-gray-700">
          Mês
          <select
            value={mes}
            onChange={(e) => onMes(Number(e.target.value))}
            className="mt-1 block rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {labelMes(m)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-gray-700">
          Ano
          <select
            value={ano}
            onChange={(e) => onAno(Number(e.target.value))}
            className="mt-1 block rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          >
            {anos.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[200px] flex-1 text-sm font-semibold text-gray-700">
          Termo (linha)
          <div className="mt-1 flex gap-2">
            <input
              type="search"
              value={rascunho}
              onChange={(e) => setRascunho(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onTermo(rascunho.trim())
              }}
              placeholder="Ex: iphone"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => onTermo(rascunho.trim())}
              className="shrink-0 rounded-lg bg-[#0097b2] px-3 py-2 text-sm font-semibold text-white"
            >
              Buscar
            </button>
          </div>
        </label>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h3 className="mb-3 font-bold text-[#001f3f]">📈 Evolução do termo</h3>
        <LinhaSvg serie={serie} />
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h3 className="mb-3 font-bold text-[#001f3f]">
          📅 Snapshot {labelMes(mes)}/{ano}
        </h3>
        {snapshot.length === 0 ? (
          <p className="text-sm text-gray-400">Sem intenções materializadas neste mês.</p>
        ) : (
          <ol className="max-h-72 space-y-1.5 overflow-y-auto text-sm">
            {snapshot.map((r, i) => (
              <li key={`${r.termo_normalizado}-${r.tipo}`} className="flex items-center gap-2 text-gray-700">
                <span className="w-6 shrink-0 text-right text-xs text-gray-400">{i + 1}.</span>
                <span className="min-w-0 flex-1 truncate font-medium">{r.termo}</span>
                <span className="shrink-0 text-[10px] uppercase text-gray-400">{r.tipo}</span>
                <span className="shrink-0 tabular-nums text-gray-500">{r.total_buscas}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
