'use client'

import type { Denuncia } from '../../types/admin.types'

export default function ModalVerDenuncia({
  aberto,
  onClose,
  denuncia,
}: {
  aberto: boolean
  onClose: () => void
  denuncia: Denuncia
}) {
  if (!aberto) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900">Detalhes da denúncia</h3>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100">
            Fechar
          </button>
        </div>

        <div className="mt-3 space-y-2 text-sm">
          <div><strong>Motivo:</strong> {denuncia.motivo}</div>
          <div><strong>Descrição:</strong> {denuncia.descricao || '-'}</div>
          <div><strong>Denunciante:</strong> {denuncia.denunciante_nome || denuncia.denunciante_email}</div>
          <div><strong>Denunciado:</strong> {denuncia.denunciado_nome} (@{denuncia.denunciado_username})</div>
          <div><strong>Status:</strong> {denuncia.status}</div>
          <div><strong>Gravidade:</strong> {denuncia.gravidade || 'não definida'}</div>
        </div>

        <div className="mt-4">
          <div className="mb-2 text-sm font-semibold text-gray-800">Evidências</div>
          {denuncia.evidencias.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500">Sem evidências anexadas.</div>
          ) : (
            <div className="space-y-2">
              {denuncia.evidencias.map((url, idx) => (
                <a key={`${url}-${idx}`} href={url} target="_blank" rel="noreferrer" className="block rounded-lg border border-gray-200 px-3 py-2 text-xs text-[#0097b2] hover:bg-gray-50">
                  Evidência {idx + 1}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
