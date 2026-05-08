'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import BotaoDinamico from '@/components/BotaoDinamico'

/**
 * @param {{
 *   empresa: {
 *     id: string
 *     nome_fantasia: string
 *     foto_url: string | null
 *     nome_usuario?: string | null
 *     descricao_curta: string | null
 *     nota_media: number | null
 *     categoria: string
 *     cidade: string
 *     whatsapp?: string | null
 *     preco_ticket_inteira?: number | null
 *     preco_ticket_meia?: number | null
 *     preco_diaria?: number | null
 *     is_seguindo?: boolean
 *   },
 *   onSeguirToggle?: () => void
 * }} props
 */
export default function CardAtrativo({ empresa }) {
  const router = useRouter()

  const desc =
    empresa.descricao_curta && empresa.descricao_curta.length > 170
      ? `${empresa.descricao_curta.substring(0, 170)}...`
      : empresa.descricao_curta || ''

  const username = (empresa?.nome_usuario ?? '').toString().replace(/^@+/, '').trim()

  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm">
      {/* FIX: @username no topo do card */}
      <div className="px-4 pt-4 text-center">
        {username ? (
          <div className="text-base font-extrabold text-[#0097b2]">@{username}</div>
        ) : (
          <div className="h-[1rem]" aria-hidden />
        )}
      </div>

      {/* FIX: foto quadrada (mesma linguagem visual da página da empresa) */}
      <div className="relative mt-2 aspect-square w-full bg-gray-100">
        {empresa.foto_url ? (
          <Image
            src={empresa.foto_url}
            alt={empresa.nome_fantasia}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 520px"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">Sem foto</div>
        )}
      </div>

      <div className="px-4 pb-4 pt-3">
        {/* FIX: nome cor #001f3f */}
        <h3 className="line-clamp-1 text-base font-extrabold text-[#001f3f]">{empresa.nome_fantasia}</h3>

        {/* FIX: descrição até 170 chars */}
        {desc ? <p className="mt-1 text-sm text-gray-600">{desc}</p> : null}

        {/* FIX: botões lado a lado, mesma largura */}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => router.push(`/empresa/${empresa.id}`)}
            className="flex flex-1 items-center justify-center rounded-lg bg-[#0097b2] px-4 py-2 text-sm font-extrabold text-white hover:opacity-95"
          >
            VISITAR PÁGINA
          </button>
          <BotaoDinamico
            categoria={empresa.categoria}
            cidade={empresa.cidade}
            empresaId={empresa.id}
            empresaNome={empresa.nome_fantasia}
            whatsapp={empresa.whatsapp ?? null}
            precoTicketInteira={Number(empresa.preco_ticket_inteira) || 0}
            precoTicketMeia={Number(empresa.preco_ticket_meia) || 0}
            precoDiaria={Number(empresa.preco_diaria) || 0}
          />
        </div>
      </div>
    </div>
  )
}
