'use client'

import Image from 'next/image'
import { useMemo } from 'react'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import { profissionalTemCategoriaMobilidade } from '@/lib/mobilidadeStatusProfissional'
import ToggleStatusMobilidade from '@/components/mobilidade/ToggleStatusMobilidade'

type Props = {
  /** Altura visual do logo / toggle. */
  compact?: boolean
}

/**
 * Cabeçalho Mobilidade: profissionais de mobilidade veem Online/Offline no lugar da logo.
 */
export default function CabecalhoMobilidadeLogoOuToggle({ compact = false }: Props) {
  const { perfilEhProfissional, recursosProfissionaisLiberados, profRow, loading } =
    useProfissionalGate()

  const mostrarToggle = useMemo(() => {
    if (loading || !perfilEhProfissional || !recursosProfissionaisLiberados) return false
    const cats = Array.isArray(profRow?.categorias)
      ? (profRow.categorias as string[])
      : []
    return profissionalTemCategoriaMobilidade(cats)
  }, [loading, perfilEhProfissional, recursosProfissionaisLiberados, profRow])

  if (mostrarToggle) {
    return <ToggleStatusMobilidade className={compact ? 'min-h-[56px]' : 'min-h-[76px]'} />
  }

  return (
    <div className={`flex justify-center ${compact ? 'py-3' : 'py-4'}`}>
      <Image
        src="/logo.png"
        alt="Guia 3F"
        width={compact ? 180 : 228}
        height={compact ? 60 : 76}
        priority
        className={`h-auto w-auto object-contain ${
          compact ? 'max-h-[56px] max-w-[180px]' : 'max-h-[76px] max-w-[228px]'
        }`}
      />
    </div>
  )
}
