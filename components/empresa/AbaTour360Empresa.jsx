'use client'

import TourPlayer from '@/components/empresa/TourPlayer'
import { parseTourConfig, sincronizarTourComFotos } from '@/lib/pannellumTour'
import { useMemo } from 'react'

/**
 * Aba pública do tour 360° — abre o player em tela cheia ao entrar na aba.
 *
 * @param {{
 *   fotos360Url: string[]
 *   tourConfig?: import('@/lib/tour360Types').TourConfig | unknown
 * }} props
 */
export default function AbaTour360Empresa({ fotos360Url, tourConfig }) {
  const urls = Array.isArray(fotos360Url) ? fotos360Url.filter((u) => typeof u === 'string' && u.trim()) : []
  const tourMerged = useMemo(
    () => sincronizarTourComFotos(urls, parseTourConfig(tourConfig)),
    [urls, tourConfig]
  )

  return <TourPlayer fotos360Url={urls} tourConfig={tourMerged} autoOpen />
}
