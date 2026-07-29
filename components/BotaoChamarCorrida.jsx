'use client'

import { useRouter } from '@/i18n/navigation'
import { Car } from 'lucide-react'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import { AVISO_DOCS_PROF_ALERTA } from '@/lib/avisoDocsProfissionalTexto'
import { avaliarAvisoChamarCorrida } from '@/lib/chamar-corrida-empresa'

/**
 * @param {{
 *   variant?: 'coordenadas' | 'empresa'
 *   empresaId?: string | null
 *   horarios?: Record<string, unknown> | null
 *   latitude?: number | string | null
 *   longitude?: number | string | null
 *   nomeDestino?: string
 * }} props
 */
export default function BotaoChamarCorrida({
  variant = 'coordenadas',
  empresaId = null,
  horarios = null,
  latitude,
  longitude,
  nomeDestino,
}) {
  const router = useRouter()
  const { perfilEhProfissional, recursosProfissionaisLiberados } = useProfissionalGate()

  const lat = latitude != null && latitude !== '' ? Number(latitude) : NaN
  const lng = longitude != null && longitude !== '' ? Number(longitude) : NaN

  const handleClick = () => {
    if (perfilEhProfissional && !recursosProfissionaisLiberados) {
      window.alert(AVISO_DOCS_PROF_ALERTA)
      return
    }

    if (variant === 'empresa') {
      const id = empresaId != null && String(empresaId).trim() !== '' ? String(empresaId).trim() : ''
      if (!id) return
      const aviso = avaliarAvisoChamarCorrida(horarios ?? undefined)
      if (!aviso.irDireto) {
        if (!window.confirm(aviso.mensagem)) return
      }
      router.push(`/mobilidade?destino_empresa=${encodeURIComponent(id)}&abrir_pesquisa=1`)
      return
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
    router.push(
      `/mobilidade?destino_lat=${lat}&destino_lng=${lng}&destino_nome=${encodeURIComponent(nomeDestino || '')}&abrir_pesquisa=1`,
    )
  }

  if (variant === 'empresa') {
    const id = empresaId != null && String(empresaId).trim() !== '' ? String(empresaId).trim() : ''
    if (!id) return null
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
