'use client'

export function ModalReprovarCadastro({
  aberto,
  nome,
  motivo,
  onMotivoChange,
  onConfirmar,
  onFechar,
  enviando,
}: {
  aberto: boolean
  nome: string
  motivo: string
  onMotivoChange: (v: string) => void
  onConfirmar: () => void
  onFechar: () => void
  enviando?: boolean
}) {
  if (!aberto) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-reprovar-titulo"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h3 id="modal-reprovar-titulo" className="text-base font-bold text-gray-900">
          Reprovar cadastro
        </h3>
        <p className="mt-2 text-sm text-gray-600">
          Informe o motivo da reprovação para <span className="font-semibold text-gray-800">{nome}</span>. O usuário
          receberá esta orientação para corrigir o cadastro.
        </p>

        <label className="mt-4 block text-xs font-semibold text-gray-700" htmlFor="motivo-reprovacao">
          Motivo da reprovação
        </label>
        <textarea
          id="motivo-reprovacao"
          value={motivo}
          onChange={(e) => onMotivoChange(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-900 outline-none ring-[#0097b2]/30 focus:border-[#0097b2] focus:ring-2"
          placeholder="Descreva o que precisa ser corrigido..."
          autoFocus
        />

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onFechar}
            disabled={enviando}
            className="min-h-[44px] rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!motivo.trim() || enviando}
            onClick={onConfirmar}
            className="min-h-[44px] rounded-xl bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {enviando ? 'Enviando…' : 'Confirmar reprovação'}
          </button>
        </div>
      </div>
    </div>
  )
}
