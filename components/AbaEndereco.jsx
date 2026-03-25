'use client'

import { MapPin, Phone, MessageCircle, Globe, Clock } from 'lucide-react'
import BotaoChamarCorrida from '@/components/BotaoChamarCorrida'
import HorariosFuncionamento from '@/components/HorariosFuncionamento'

/**
 * @param {{ empresa: {
 *   endereco: string
 *   cidade: string
 *   latitude: number | string | null
 *   longitude: number | string | null
 *   telefone: string | null
 *   whatsapp: string | null
 *   website: string | null
 *   horarios: Record<string, { abre: string, fecha: string, fechado: boolean }>
 *   nome_fantasia?: string
 * }}} props
 */
export default function AbaEndereco({ empresa }) {
  const nomeDestino = empresa.nome_fantasia || ''

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <MapPin size={18} className="mt-0.5 text-gray-400" aria-hidden />
          <div>
            <p className="text-gray-700">{empresa.endereco}</p>
            <p className="text-sm text-gray-500">{empresa.cidade}</p>
          </div>
        </div>

        <BotaoChamarCorrida
          latitude={empresa.latitude}
          longitude={empresa.longitude}
          nomeDestino={nomeDestino}
        />
      </div>

      {(empresa.telefone || empresa.whatsapp || empresa.website) && (
        <div className="space-y-2 border-t border-gray-100 pt-4">
          {empresa.telefone ? (
            <a
              href={`tel:${empresa.telefone}`}
              className="flex items-center gap-2 text-gray-700 hover:text-[#0097b2]"
            >
              <Phone size={18} aria-hidden />
              <span>{empresa.telefone}</span>
            </a>
          ) : null}
          {empresa.whatsapp ? (
            <a
              href={`https://wa.me/${String(empresa.whatsapp).replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-gray-700 hover:text-[#0097b2]"
            >
              <MessageCircle size={18} aria-hidden />
              <span>{empresa.whatsapp}</span>
            </a>
          ) : null}
          {empresa.website ? (
            <a
              href={empresa.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-gray-700 hover:text-[#0097b2]"
            >
              <Globe size={18} aria-hidden />
              <span>{empresa.website}</span>
            </a>
          ) : null}
        </div>
      )}

      <div className="border-t border-gray-100 pt-4">
        <div className="mb-3 flex items-center gap-2">
          <Clock size={18} className="text-gray-400" aria-hidden />
          <span className="font-medium">Horário de Funcionamento</span>
        </div>
        <HorariosFuncionamento horarios={empresa.horarios || {}} />
      </div>
    </div>
  )
}
