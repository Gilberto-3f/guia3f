'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import AvatarImage from '@/components/AvatarImage'
import type { RecomendacaoProfissional } from '../../types/dashboard.types'

function formatarDataHora(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const dia = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${dia} · ${hora}`
}

interface Props {
  profissional: RecomendacaoProfissional
}

export default function LinhaProfissionalRecomendacao({ profissional }: Props) {
  const [aberto, setAberto] = useState(false)
  const username = profissional.profissional_username.replace(/^@+/, '')

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-white/60"
        aria-expanded={aberto}
      >
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-gray-100">
          <AvatarImage
            src={profissional.profissional_foto_url}
            alt={profissional.profissional_nome}
            width={40}
            height={40}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-gray-900">{profissional.profissional_nome}</p>
          <p className="truncate text-sm text-gray-500">@{username}</p>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[#0097b2] transition-transform duration-200 ${aberto ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {aberto ? (
        <div className="space-y-2 border-t border-gray-100 bg-white/80 px-3 py-3">
          {profissional.detalhes.map((detalhe) => (
            <div key={detalhe.id} className="text-sm leading-relaxed text-gray-600">
              <p>{formatarDataHora(detalhe.created_at)}</p>
              {detalhe.turista_whatsapp_final ? (
                <p className="text-gray-500">WhatsApp turista ····{detalhe.turista_whatsapp_final}</p>
              ) : (
                <p className="text-gray-400">WhatsApp turista não informado</p>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
