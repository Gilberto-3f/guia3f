'use client'

export function ConfigServicosTabelados() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Defina os valores NET por rota, categoria e serviço. O preço de balcão é a referência para revenda ao turista.
      </p>
      <div className="rounded-xl border border-gray-200 p-3">
        <div className="text-sm font-semibold text-gray-900">Rota: Foz → CDE · Categoria: Guia</div>
        <div className="mt-1 text-xs text-gray-600">Preço NET: R$ 120,00</div>
        <button type="button" className="mt-3 rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white">
          Editar
        </button>
      </div>
    </div>
  )
}
