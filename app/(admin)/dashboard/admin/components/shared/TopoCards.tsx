'use client'

import { useAdminData } from '../../hooks/useAdminData'

function Card({
  titulo,
  valor = '-',
  deltaPct,
  loading,
}: {
  titulo: string
  valor?: string
  deltaPct?: number
  loading?: boolean
}) {
  const up = (deltaPct ?? 0) >= 0
  const label = `${up ? '↑' : '↓'} ${Math.abs(deltaPct ?? 0).toFixed(1)}%`

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold text-gray-500">{titulo}</div>
      <div className="mt-1 text-2xl font-bold text-gray-900">{loading ? '...' : valor}</div>
      {!loading && typeof deltaPct === 'number' ? (
        <div className="mt-2 text-xs font-semibold">
          <span className={up ? 'text-emerald-700' : 'text-rose-700'}>{label}</span>
        </div>
      ) : null}
    </div>
  )
}

export function TopoCards() {
  const { topoCards, loading } = useAdminData('turistas', { periodo: '30d' })

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Card
        titulo="👥 Turistas"
        valor={topoCards ? topoCards.turistas.total.toLocaleString('pt-BR') : '-'}
        deltaPct={topoCards?.turistas.variacao}
        loading={loading}
      />
      <Card
        titulo="🚗 Profissionais"
        valor={topoCards ? topoCards.profissionais.total.toLocaleString('pt-BR') : '-'}
        deltaPct={topoCards?.profissionais.variacao}
        loading={loading}
      />
      <Card
        titulo="🏢 Empresas"
        valor={topoCards ? topoCards.empresas.total.toLocaleString('pt-BR') : '-'}
        deltaPct={topoCards?.empresas.variacao}
        loading={loading}
      />
    </div>
  )
}

