'use client'

import { useRouter } from '@/i18n/navigation'
import { Car } from 'lucide-react'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import { AVISO_DOCS_PROF_ALERTA } from '@/lib/avisoDocsProfissionalTexto'
import { avaliarAvisoChamarCorrida } from '@/lib/chamar-corrida-empresa'
import { buildHrefChamarCorridaEmpresa, buildMobilidadePesquisaHref } from '@/lib/mobilidadePesquisaParams'
import { salvarChamarCorridaIntent } from '@/lib/chamarCorridaIntent'

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
      const latOk = Number.isFinite(lat) ? lat : null
      const lngOk = Number.isFinite(lng) ? lng : null
      // Intent no sessionStorage: VisaoTurista aplica ESTE destino (não o da empresa anterior).
      salvarChamarCorridaIntent({
        empresaId: id,
        nomeDestino: nomeDestino || '',
        lat: latOk,
        lng: lngOk,
      })
      router.push(
        buildHrefChamarCorridaEmpresa({
          empresaId: id,
          nomeDestino: nomeDestino || '',
          latitude: latOk,
          longitude: lngOk,
        }),
      )
      return
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
    router.push(
      buildMobilidadePesquisaHref({
        origem: { nome: '', lat: null, lng: null },
        destino: {
          nome: String(nomeDestino || '').trim(),
          lat,
          lng,
        },
        abrirPesquisa: true,
      }),
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
