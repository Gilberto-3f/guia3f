'use client'

import { useRouter } from 'next/navigation'
import { Car } from 'lucide-react'

/**
 * @param {{
 *   latitude: number | string | null,
 *   longitude: number | string | null,
 *   nomeDestino?: string
 * }} props
 */
export default function BotaoChamarCorrida({ latitude, longitude, nomeDestino }) {
  const router = useRouter()

  const lat = latitude != null && latitude !== '' ? Number(latitude) : NaN
  const lng = longitude != null && longitude !== '' ? Number(longitude) : NaN

  const handleClick = () => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return

    router.push(
      `/mobilidade?destino_lat=${lat}&destino_lng=${lng}&destino_nome=${encodeURIComponent(nomeDestino || '')}`
    )
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#00D443] py-3 text-base font-bold text-white shadow-sm transition-opacity hover:opacity-95"
    >
      <Car size={20} className="text-white" aria-hidden />
      Chamar corrida
    </button>
  )
}
