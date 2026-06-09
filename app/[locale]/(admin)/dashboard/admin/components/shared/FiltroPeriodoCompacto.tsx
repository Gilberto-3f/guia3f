'use client'

import type { PeriodoId } from './FiltrosPeriodo'

const opcoes: { id: PeriodoId; label: string }[] = [
  { id: '7d', label: '7 dias' },
  { id: '30d', label: '30 dias' },
  { id: '90d', label: '90 dias' },
  { id: '12m', label: '12 meses' },
]

export function FiltroPeriodoCompacto({
  value,
  onChange,
}: {
  value: PeriodoId
  onChange: (next: PeriodoId) => void
}) {
  const rotuloAtual = opcoes.find((o) => o.id === value)?.label ?? 'Período'

  return (
    <label className="inline-flex min-w-0 items-center gap-1.5 text-xs text-gray-500">
      <span className="shrink-0 font-medium">Período:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as PeriodoId)}
        aria-label={`Período dos gráficos: ${rotuloAtual}`}
        className="max-w-[7.5rem] truncate rounded-md border border-gray-200 bg-white px-2 py-1 text-sm font-medium text-[#001f3f] shadow-sm"
      >
        {opcoes.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
