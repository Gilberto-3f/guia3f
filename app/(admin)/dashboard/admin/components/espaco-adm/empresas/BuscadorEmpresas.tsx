'use client'

import type { EmpresaAdm } from '../../../hooks/useEmpresasAdm'

export function BuscadorEmpresas({
  busca,
  onBuscaChange,
  empresas,
  loading,
  onSelect,
}: {
  busca: string
  onBuscaChange: (v: string) => void
  empresas: EmpresaAdm[]
  loading: boolean
  onSelect: (e: EmpresaAdm) => void
}) {
  return (
    <div className="mt-3 space-y-3">
      <input
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#0097b2]"
        placeholder="Buscar empresa por nome ou @..."
        value={busca}
        onChange={(e) => onBuscaChange(e.target.value)}
      />
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : (
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {empresas.map((emp) => (
            <button
              key={emp.id}
              type="button"
              onClick={() => onSelect(emp)}
              className="w-full rounded-xl border border-gray-200 p-3 text-left text-xs hover:bg-gray-50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-gray-900">{emp.nome}</div>
                  <div className="text-gray-500">@{emp.username}</div>
                </div>
                <div className="text-right text-[11px] text-gray-500">
                  <div>{emp.categoria}</div>
                  <div>{emp.cidade}</div>
                </div>
              </div>
              <div className="mt-1 flex items-center gap-3 text-[11px] text-gray-500">
                <span>⭐ {emp.nota.toFixed(1)}</span>
                <span className={emp.plano === 'Premium' ? 'rounded-full bg-purple-100 px-2 py-0.5 text-purple-800' : 'rounded-full bg-gray-100 px-2 py-0.5 text-gray-700'}>
                  {emp.plano}
                </span>
                <span className="text-emerald-700">{emp.status}</span>
              </div>
            </button>
          ))}
          {!empresas.length && busca.trim().length >= 2 ? (
            <div className="py-3 text-center text-xs text-gray-500">Nenhuma empresa encontrada.</div>
          ) : null}
        </div>
      )}
    </div>
  )
}

