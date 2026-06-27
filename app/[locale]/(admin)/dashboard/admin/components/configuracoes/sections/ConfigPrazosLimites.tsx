'use client'

import type { ConfigGeral } from '../../../types/admin.types'

export function ConfigPrazosLimites({
  localGeral,
  setLocalGeral,
  podeEditar,
  salvando,
  onSalvar,
}: {
  localGeral: ConfigGeral
  setLocalGeral: (next: ConfigGeral) => void
  podeEditar: boolean
  salvando: boolean
  onSalvar: () => void
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold text-gray-700">
          Pré-aprovação turista (horas) — 24 a 72
          <input
            type="number"
            value={localGeral.prazo_pre_aprovacao_turista}
            onChange={(e) =>
              setLocalGeral({ ...localGeral, prazo_pre_aprovacao_turista: Number(e.target.value) })
            }
            disabled={!podeEditar}
            className="mt-1 w-full rounded-xl border border-gray-200 p-2 text-sm disabled:opacity-60"
            min={24}
            max={72}
          />
        </label>
        <label className="text-sm font-semibold text-gray-700">
          Verificação documentos (horas) — 12 a 48
          <input
            type="number"
            value={localGeral.prazo_verificacao_documentos}
            onChange={(e) =>
              setLocalGeral({ ...localGeral, prazo_verificacao_documentos: Number(e.target.value) })
            }
            disabled={!podeEditar}
            className="mt-1 w-full rounded-xl border border-gray-200 p-2 text-sm disabled:opacity-60"
            min={12}
            max={48}
          />
        </label>
        <label className="text-sm font-semibold text-gray-700">
          Limite fotos empresa — 10 a 50
          <input
            type="number"
            value={localGeral.limite_fotos_empresa}
            onChange={(e) => setLocalGeral({ ...localGeral, limite_fotos_empresa: Number(e.target.value) })}
            disabled={!podeEditar}
            className="mt-1 w-full rounded-xl border border-gray-200 p-2 text-sm disabled:opacity-60"
            min={10}
            max={50}
          />
        </label>
        <label className="text-sm font-semibold text-gray-700">
          Limite reservas ativas — 1 a 5
          <input
            type="number"
            value={localGeral.limite_reservas_ativas}
            onChange={(e) => setLocalGeral({ ...localGeral, limite_reservas_ativas: Number(e.target.value) })}
            disabled={!podeEditar}
            className="mt-1 w-full rounded-xl border border-gray-200 p-2 text-sm disabled:opacity-60"
            min={1}
            max={5}
          />
        </label>
        <label className="text-sm font-semibold text-gray-700 md:col-span-2">
          Tempo pagamento reserva (minutos) — 5 a 30
          <input
            type="number"
            value={localGeral.tempo_pagamento_reserva}
            onChange={(e) => setLocalGeral({ ...localGeral, tempo_pagamento_reserva: Number(e.target.value) })}
            disabled={!podeEditar}
            className="mt-1 w-full max-w-md rounded-xl border border-gray-200 p-2 text-sm disabled:opacity-60"
            min={5}
            max={30}
          />
        </label>
      </div>
      {podeEditar ? (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onSalvar}
            disabled={salvando}
            className="rounded-xl bg-[#0097b2] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {salvando ? 'Salvando...' : 'Salvar prazos e limites'}
          </button>
        </div>
      ) : null}
    </>
  )
}
