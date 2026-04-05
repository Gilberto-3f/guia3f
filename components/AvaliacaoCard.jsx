'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Star } from 'lucide-react'

/**
 * @param {{
 *   meta: {
 *     empresa_id?: string
 *     nome_fantasia?: string
 *     foto_url?: string | null
 *     nota?: number
 *     feedback?: string | null
 *   }
 * }} props
 */
export default function AvaliacaoCard({ meta }) {
  const nota = Number(meta.nota) || 0
  const nome = meta.nome_fantasia ?? 'Estabelecimento'
  const empresaId = meta.empresa_id != null && String(meta.empresa_id) !== '' ? String(meta.empresa_id) : null

  const nomeLink =
    empresaId != null ? (
      <Link href={`/empresa/${empresaId}`} className="font-semibold text-[#0097b2] hover:underline">
        @{nome}
      </Link>
    ) : (
      <span className="font-semibold text-[#0097b2]">@{nome}</span>
    )

  return (
    <div>
      <p className="text-sm text-gray-800">
        Avaliei {nomeLink} com {nota}
        <Star size={14} className="ml-0.5 inline fill-amber-400 text-amber-400" aria-hidden />
      </p>
      <div className="mt-3 flex gap-3">
        {meta.foto_url ? (
          empresaId != null ? (
            <Link href={`/empresa/${empresaId}`} className="relative block h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100">
              <Image src={meta.foto_url} alt="" fill className="object-cover" sizes="64px" />
            </Link>
          ) : (
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100">
              <Image src={meta.foto_url} alt="" fill className="object-cover" sizes="64px" />
            </div>
          )
        ) : null}
        {meta.feedback ? <p className="text-sm text-gray-600">{meta.feedback}</p> : null}
      </div>
    </div>
  )
}
