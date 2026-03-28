'use client'

interface Props {
  aberto: boolean
  titulo: string
  descricao?: string
  confirmarLabel?: string
  cancelarLabel?: string
  confirmando?: boolean
  onConfirmar: () => void
  onCancelar: () => void
}

export default function ModalConfirmacao({
  aberto,
  titulo,
  descricao,
  confirmarLabel = 'Confirmar',
  cancelarLabel = 'Cancelar',
  confirmando = false,
  onConfirmar,
  onCancelar,
}: Props) {
  if (!aberto) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-lg font-bold text-gray-900">{titulo}</h3>
        {descricao ? <p className="mt-2 text-sm text-gray-600">{descricao}</p> : null}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium"
            onClick={onCancelar}
            disabled={confirmando}
          >
            {cancelarLabel}
          </button>
          <button
            type="button"
            className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white disabled:opacity-60"
            onClick={onConfirmar}
            disabled={confirmando}
          >
            {confirmando ? '...' : confirmarLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

