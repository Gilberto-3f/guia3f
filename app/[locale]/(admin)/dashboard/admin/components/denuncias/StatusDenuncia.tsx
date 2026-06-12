'use client'

import type { DenunciaStatus } from '../../types/admin.types'

const opts: { id: DenunciaStatus | 'todas'; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'pendente', label: 'Pendente' },
  { id: 'em_investigacao', label: 'Em investigação' },
  { id: 'encerrada', label: 'Encerrada' },
]

export default function StatusDenuncia({
  statusAtivo,
  onStatusChange,
  busca,
  onBuscaChange,
  categoria,
  onCategoriaChange,
  perfil,
  badges,
}: {
  statusAtivo: DenunciaStatus | 'todas'
  onStatusChange: (v: DenunciaStatus | 'todas') => void
  busca: string
  onBuscaChange: (v: string) => void
  categoria: string
  onCategoriaChange: (v: string) => void
  perfil: 'turistas' | 'profissionais' | 'empresas' | 'auditoria'
  badges?: Partial<Record<DenunciaStatus, number>>
}) {
  if (perfil === 'auditoria') return null

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
              {o.id !== 'todas' && typeof badges?.[o.id] === 'number' ? (
                <span className="ml-1 text-[11px]">({badges?.[o.id]})</span>
              ) : null}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
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
        ) : null}
      </div>
    </div>
  )
}
