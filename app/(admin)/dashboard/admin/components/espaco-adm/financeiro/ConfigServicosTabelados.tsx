'use client'

export function ConfigServicosTabelados() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-sm font-bold text-gray-900">Configuração de Serviços Tabelados</div>
      <div className="mt-3 space-y-3">
        <div className="rounded-xl border border-gray-200 p-3">
          <div className="text-sm font-semibold text-gray-900">Rota: Foz → CDE · Categoria: Guia</div>
          <div className="mt-1 text-xs text-gray-600">Valor: R$ 120,00</div>
          <button type="button" className="mt-3 rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white">
            Editar
          </button>
        </div>
      </div>
    </div>
  )
}

