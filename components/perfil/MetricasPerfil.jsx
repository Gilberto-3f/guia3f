'use client'

/**
 * @param {{
 *   favoritos: number
 *   seguidores: number
 *   avaliacoes: number
 *   onFavoritos: () => void
 *   onSeguidores: () => void
 *   onAvaliacoes: () => void
 * }} props
 */
export default function MetricasPerfil({ favoritos, seguidores, avaliacoes, onFavoritos, onSeguidores, onAvaliacoes }) {
  const btn =
    'flex flex-1 flex-col items-center justify-center rounded-lg border border-[#E0E0E0] bg-white py-3 px-2 text-center shadow-sm active:bg-gray-50'

  return (
    <div className="flex gap-2 px-4">
      <button type="button" className={btn} onClick={onFavoritos}>
        <span className="text-[10px] font-semibold tracking-wide text-[#001f3f]">FAVORITOS</span>
        <span className="mt-1 text-lg font-bold text-[#0097b2]">{favoritos}</span>
      </button>
      <button type="button" className={btn} onClick={onSeguidores}>
        <span className="text-[10px] font-semibold tracking-wide text-[#001f3f]">SEGUIDORES</span>
        <span className="mt-1 text-lg font-bold text-[#0097b2]">{seguidores}</span>
      </button>
      <button type="button" className={btn} onClick={onAvaliacoes}>
        <span className="text-[10px] font-semibold tracking-wide text-[#001f3f]">AVALIAÇÕES</span>
        <span className="mt-1 text-lg font-bold text-[#0097b2]">{avaliacoes}</span>
      </button>
    </div>
  )
}
