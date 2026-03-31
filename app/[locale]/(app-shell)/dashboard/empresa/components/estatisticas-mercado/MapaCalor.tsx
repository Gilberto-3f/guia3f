'use client'

export default function MapaCalor() {
  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="mb-4 font-bold text-[#001f3f]">🗺️ Mapa de Calor - Solicitações de Mobilidade</h3>
      <div className="flex h-64 items-center justify-center rounded-lg bg-gray-100">
        <div className="text-center text-gray-500">
          <p>🗺️ Mapa de calor em desenvolvimento</p>
          <p className="mt-2 text-sm">🔴 Áreas com mais solicitações</p>
          <p className="text-sm">🟡 Áreas com média solicitações</p>
          <p className="text-sm">🟢 Áreas com baixa solicitações</p>
        </div>
      </div>
    </div>
  )
}

