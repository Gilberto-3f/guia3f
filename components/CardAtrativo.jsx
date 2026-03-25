'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import Estrelas from '@/components/Estrelas'
import BotaoSeguir from '@/components/BotaoSeguir'
import BotaoDinamico from '@/components/BotaoDinamico'

/**
 * @param {{
 *   empresa: {
 *     id: string
 *     nome_fantasia: string
 *     foto_url: string | null
 *     descricao_curta: string
 *     nota_media: number
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
export default function CardAtrativo({ empresa, onSeguirToggle }) {
  const router = useRouter()

  const handleClick = () => {
    router.push(`/empresa/${empresa.id}`)
  }

  const desc =
    empresa.descricao_curta && empresa.descricao_curta.length > 170
      ? `${empresa.descricao_curta.substring(0, 170)}...`
      : empresa.descricao_curta || ''

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick()
        }
      }}
      className="cursor-pointer overflow-hidden rounded-xl bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[2/3] bg-gray-100">
        {empresa.foto_url ? (
          <Image
            src={empresa.foto_url}
            alt={empresa.nome_fantasia}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, 280px"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">Sem foto</div>
        )}
      </div>

      <div className="p-3">
        <div className="mb-1 flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-base font-bold text-gray-800">{empresa.nome_fantasia}</h3>
          <Estrelas nota={Number(empresa.nota_media) || 0} tamanho={14} />
        </div>

        <p className="mb-3 line-clamp-2 text-sm text-gray-500">{desc}</p>

        <div className="flex flex-col gap-2 sm:flex-row">
          <BotaoSeguir
            empresaId={empresa.id}
            isFollowing={empresa.is_seguindo}
            onToggle={onSeguirToggle}
          />
          <BotaoDinamico
            categoria={empresa.categoria}
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
