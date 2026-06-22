'use client'

import { Info, X } from 'lucide-react'
import type { ParadaItinerarioRow } from '@/lib/itinerarioParadas'
import { useModalScrollLock } from '@/lib/useModalScrollLock'

type Props = {
  aberto: boolean
  onFechar: () => void
  passageiroNome: string
  paradas: ParadaItinerarioRow[]
}

/** Paradas do itinerário escolhidas por um passageiro específico. */
export default function PopupParadasPassageiro({ aberto, onFechar, passageiroNome, paradas }: Props) {
  useModalScrollLock(aberto)
  if (!aberto) return null

  return (
    <div className="fixed inset-0 z-[240] flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl" role="dialog">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 shrink-0 text-[#0097b2]" aria-hidden />
            <div>
              <h3 className="font-bold text-gray-900">Itinerário — {passageiroNome}</h3>
              <p className="text-xs text-gray-500">Paradas selecionadas por este passageiro</p>
            </div>
          </div>
          <button type="button" onClick={onFechar} className="rounded-lg p-1 hover:bg-gray-100" aria-label="Fechar">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {paradas.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">Nenhuma parada selecionada ainda.</p>
        ) : (
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {paradas.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                <span className="font-medium text-gray-900">{p.empresa_nome}</span>
                <span
                  className={`text-[10px] font-bold uppercase ${
                    p.visitado ? 'text-[#15803d]' : 'text-amber-700'
                  }`}
                >
                  {p.visitado ? 'Visitado' : 'Agendado'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
