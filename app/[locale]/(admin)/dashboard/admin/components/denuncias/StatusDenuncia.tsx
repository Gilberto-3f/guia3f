'use client'

import type { DenunciaStatus } from '../../types/admin.types'

const opts: { id: DenunciaStatus | 'todas'; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'pendente', label: 'Pendente' },
  { id: 'em_investigacao', label: 'Em investigação' },
  { id: 'encerrada', label: 'Encerrada' },
  { id: 'arquivada', label: 'Arquivada' },
]

export default function StatusDenuncia({
  statusAtivo,
  onStatusChange,
  periodo,
  onPeriodoChange,
  busca,
  onBuscaChange,
  categoria,
  onCategoriaChange,
  perfil,
  badges,
}: {
  statusAtivo: DenunciaStatus | 'todas'
  onStatusChange: (v: DenunciaStatus | 'todas') => void
  periodo: 'hoje' | '7d' | '30d'
  onPeriodoChange: (v: 'hoje' | '7d' | '30d') => void
  busca: string
  onBuscaChange: (v: string) => void
  categoria: string
  onCategoriaChange: (v: string) => void
  perfil: 'turistas' | 'profissionais' | 'empresas'
  badges?: Partial<Record<DenunciaStatus, number>>
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {opts.map((o) => {
          const active = o.id === statusAtivo
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onStatusChange(o.id)}
              className={[
                'rounded-xl px-3 py-2 text-xs font-semibold transition',
                active ? 'bg-[#0097b2] text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100',
              ].join(' ')}
            >
              {o.label}{' '}
              {o.id !== 'todas' && typeof badges?.[o.id] === 'number' ? <span className="ml-1 text-[11px]">({badges?.[o.id]})</span> : null}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
        <select value={periodo} onChange={(e) => onPeriodoChange(e.target.value as 'hoje' | '7d' | '30d')} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
          <option value="hoje">Hoje</option>
          <option value="7d">Últimos 7 dias</option>
          <option value="30d">Últimos 30 dias</option>
        </select>
        <input
          value={busca}
          onChange={(e) => onBuscaChange(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm md:col-span-2"
          placeholder="Buscar por motivo ou descrição..."
        />
        {perfil === 'profissionais' ? (
          <input
            value={categoria}
            onChange={(e) => onCategoriaChange(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
            placeholder="Categoria (opcional)"
          />
        ) : (
          <div />
        )}
      </div>
    </div>
  )
}
