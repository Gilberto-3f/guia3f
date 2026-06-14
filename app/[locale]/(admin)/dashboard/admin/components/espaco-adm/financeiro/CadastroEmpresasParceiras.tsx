'use client'

export function CadastroEmpresasParceiras() {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <button type="button" className="rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white">
          Cadastrar nova empresa parceira
        </button>
      </div>
      <div className="rounded-xl border border-gray-200 p-3">
        <div className="text-sm font-semibold text-gray-900">Agência Turismo Foz · Foz do Iguaçu</div>
        <div className="mt-1 text-xs text-gray-600">5 colaboradores · Participação: 10% dos lucros</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700"
          >
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
