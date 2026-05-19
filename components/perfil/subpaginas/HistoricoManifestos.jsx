'use client'

/** Drawer: manifestos finalizados (atendimentos concluídos). */
export default function HistoricoManifestos() {
  return (
    <div className="space-y-3 px-1">
      <p className="text-sm text-gray-600">
        Histórico de manifestos finalizados — atendimentos concluídos por indicações de parcerias.
      </p>
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-10 text-center text-sm text-gray-400">
        Nenhum manifesto finalizado ainda
      </div>
    </div>
  )
}
