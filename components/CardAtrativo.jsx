'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Heart } from 'lucide-react'
import BotaoDinamico from '@/components/BotaoDinamico'
import BotaoRecomendar from '@/components/BotaoRecomendar'
import NomeComVerificacao from '@/components/NomeComVerificacao'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import { contaVerificadaDocumentacao } from '@/lib/contaVerificada'

const BANDEIRA_POR_CIDADE = {
  'Foz do Iguaçu': '🇧🇷',
  'Ciudad del Este': '🇵🇾',
  'Puerto Iguazu': '🇦🇷',
}

function bandeiraPorCidade(cidade) {
  if (!cidade) return ''
  return BANDEIRA_POR_CIDADE[cidade] ?? ''
}

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
 *     endereco?: string | null
 *     bairro?: string | null
 *     total_avaliacoes?: number | null
 *     is_seguindo?: boolean
 *   },
 *   segmentoGuiaSlug?: string | null
 *   onSeguirToggle?: () => void
 * }} props
 */
export default function CardAtrativo({ empresa, segmentoGuiaSlug = null }) {
  const router = useRouter()
  const { perfilEhProfissional, loading: gateLoading } = useProfissionalGate()

  const desc =
    empresa.descricao_curta && empresa.descricao_curta.length > 170
      ? `${empresa.descricao_curta.substring(0, 170)}...`
      : empresa.descricao_curta || ''

  const username = (empresa?.nome_usuario ?? '').toString().replace(/^@+/, '').trim()
  const bandeira = bandeiraPorCidade(empresa?.cidade)

  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm">
      {/* RODADA 2: username maior e centralizado */}
      <div className="px-4 pt-4 text-center">
        {username ? (
          <div className="flex items-center justify-center gap-1.5 text-lg font-extrabold text-[#0097b2]">
            {bandeira ? (
              <span className="text-lg leading-none" aria-hidden>
                {bandeira}
              </span>
            ) : null}
            <span>@{username}</span>
          </div>
        ) : (
          <div className="h-5" aria-hidden />
        )}
      </div>

      {/* RODADA 2: foto quadrada (alinhada à hero quadrada da página da empresa) */}
      <div className="relative mt-2 aspect-square w-full min-w-0 bg-gray-100">
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
        <h3 className="line-clamp-1 text-base font-extrabold text-[#001f3f]">
          <NomeComVerificacao
            nome={String(empresa.nome_fantasia ?? '')}
            verificado={contaVerificadaDocumentacao('empresa', empresa)}
            nomeClassName="line-clamp-1"
          />
        </h3>

        {/* FIX: descrição até 170 chars */}
        {desc ? <p className="mt-1 text-sm text-gray-600">{desc}</p> : null}

        {/* RODADA 2: dois botões lado a lado, mesma largura; texto pode quebrar em 2 linhas */}
        <div className="mt-4 flex min-w-0 gap-2">
          <button
            type="button"
            onClick={() => router.push(`/empresa/${empresa.id}`)}
            className="flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-1 rounded-lg bg-[#0097b2] px-2 py-2 text-center text-xs font-extrabold leading-tight text-white whitespace-normal hover:opacity-95 sm:text-sm"
          >
            <Heart size={20} className="shrink-0 text-white" aria-hidden />
            <span>VISITAR PÁGINA</span>
          </button>
          {perfilEhProfissional ? (
            <BotaoRecomendar empresa={empresa} segmentoGuiaSlug={segmentoGuiaSlug} />
          ) : gateLoading ? (
            <div className="min-h-[3.25rem] flex-1 animate-pulse rounded-lg bg-gray-100" aria-hidden />
          ) : (
            <BotaoDinamico
              categoria={empresa.categoria}
              cidade={empresa.cidade}
              empresaId={empresa.id}
              empresaNome={empresa.nome_fantasia}
              empresaUsername={empresa.nome_usuario ?? null}
              whatsapp={empresa.whatsapp ?? null}
              precoTicketInteira={Number(empresa.preco_ticket_inteira) || 0}
              precoTicketMeia={Number(empresa.preco_ticket_meia) || 0}
              precoDiaria={Number(empresa.preco_diaria) || 0}
            />
          )}
        </div>
      </div>
    </div>
  )
}
