'use client'

type Periodo = '7d' | '30d' | '90d'

interface Props {
  value: Periodo
  onChange: (value: Periodo) => void
}

export default function SeletorPeriodo({ value, onChange }: Props) {
  return (
    <div className="flex rounded-lg bg-gray-100 p-1">
      <button
        type="button"
        onClick={() => onChange('7d')}
        className={`rounded-lg px-3 py-1 text-sm ${
          value === '7d' ? 'bg-white text-[#0097b2] shadow' : 'text-gray-600 hover:text-gray-800'
        }`}
      >
        7 dias
      </button>
      <button
        type="button"
        onClick={() => onChange('30d')}
        className={`rounded-lg px-3 py-1 text-sm ${
          value === '30d' ? 'bg-white text-[#0097b2] shadow' : 'text-gray-600 hover:text-gray-800'
        }`}
      >
        30 dias
      </button>
      <button
        type="button"
        onClick={() => onChange('90d')}
        className={`rounded-lg px-3 py-1 text-sm ${
          value === '90d' ? 'bg-white text-[#0097b2] shadow' : 'text-gray-600 hover:text-gray-800'
        }`}
      >
        90 dias
      </button>
    </div>
  )
}

