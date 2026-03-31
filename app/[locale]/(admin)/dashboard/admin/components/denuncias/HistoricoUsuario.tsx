'use client'

export default function HistoricoUsuario({ totalAnteriores }: { totalAnteriores: number }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
      Histórico do denunciado: {totalAnteriores} denúncia(s) anterior(es) não arquivada(s).
    </div>
  )
}
