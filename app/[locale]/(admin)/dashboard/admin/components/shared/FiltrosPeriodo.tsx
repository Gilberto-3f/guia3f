'use client'

export type PeriodoId = '7d' | '30d' | '90d' | '12m'

const opcoes: { id: PeriodoId; label: string }[] = [
  { id: '7d', label: 'Últimos 7 dias' },
  { id: '30d', label: 'Últimos 30 dias' },
  { id: '90d', label: 'Últimos 90 dias' },
  { id: '12m', label: 'Últimos 12 meses' },
]

export function FiltrosPeriodo({
  value,
  onChange,
}: {
  value: PeriodoId
  onChange: (next: PeriodoId) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {opcoes.map((o) => {
        const active = o.id === value
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={[
              'rounded-xl px-3 py-2 text-sm font-semibold transition',
              active ? 'bg-[#0097b2] text-white' : 'bg-white text-gray-700 hover:bg-gray-100',
            ].join(' ')}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

