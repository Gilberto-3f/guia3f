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
    'flex min-w-[104px] flex-col items-center justify-center rounded-lg border border-[#E0E0E0] bg-white px-4 py-2 text-center shadow-sm active:bg-gray-50'

  return (
    <div className="flex justify-center gap-4 px-4">
      <button type="button" className={btn} onClick={onFavoritos}>
        <span className="text-xl font-bold text-[#0097b2]">{favoritos}</span>
        <span className="mt-1 text-xs font-semibold uppercase tracking-wider text-gray-500">FAVORITOS</span>
      </button>
      <button type="button" className={btn} onClick={onSeguidores}>
        <span className="text-xl font-bold text-[#0097b2]">{seguidores}</span>
        <span className="mt-1 text-xs font-semibold uppercase tracking-wider text-gray-500">SEGUIDORES</span>
      </button>
      <button type="button" className={btn} onClick={onAvaliacoes}>
        <span className="text-xl font-bold text-[#0097b2]">{avaliacoes}</span>
        <span className="mt-1 text-xs font-semibold uppercase tracking-wider text-gray-500">AVALIAÇÕES</span>
      </button>
    </div>
  )
}
