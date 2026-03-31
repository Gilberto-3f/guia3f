'use client'

export function CadastroEmpresasParceiras() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm font-bold text-gray-900">Cadastro de Empresas Parceiras</div>
        <button type="button" className="rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white">
          ➕ Cadastrar nova
        </button>
      </div>
      <div className="mt-3 rounded-xl border border-gray-200 p-3">
        <div className="text-sm font-semibold text-gray-900">🏢 Agência Turismo Foz · 📍 Foz</div>
        <div className="mt-1 text-xs text-gray-600">👥 5 colaboradores · 💰 Participação: 10% dos lucros</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700">
            Ver detalhes
          </button>
          <button type="button" className="rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white">
            Editar
          </button>
        </div>
      </div>
    </div>
  )
}

