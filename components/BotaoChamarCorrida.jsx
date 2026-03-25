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
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#FFEAA7] py-2 font-medium text-gray-800 transition-colors hover:bg-[#FFEAA7]/80"
    >
      <Car size={18} aria-hidden />
      Chamar Corrida
    </button>
  )
}
