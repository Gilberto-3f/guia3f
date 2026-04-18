'use client'

import Link from 'next/link'
import Image from 'next/image'
import AvaliacaoCard from '@/components/AvaliacaoCard'
import AvatarImage from '@/components/AvatarImage'

/**
 * @param {{
 *   itens: {
 *     id: string
 *     created_at: string
 *     texto: string | null
 *     foto_url: string | null
 *     conteudo_url: string | null
 *     tipo: string
 *     avaliacao_meta: Record<string, unknown> | null
 *     originalId: string | null
 *     autorOriginal: string | null
 *     usernameOriginal: string | null
 *     autorOriginalUsuarioId: string | null
 *   }[]
 *   reposter: { id: string; username: string; foto: string | null }
 * }} props
 */
export default function AbaRepublicados({ itens, reposter }) {
  if (itens.length === 0) {
    return <p className="py-12 text-center text-sm text-gray-400">Nenhum republicado</p>
  }

  return (
    <ul className="space-y-4 px-3">
      {itens.map((item) => {
        const mediaUrl = item.conteudo_url || item.foto_url
        const tipoNorm = String(item.tipo || '').toLowerCase()
        const repostEhFoto = tipoNorm === 'foto' || tipoNorm === 'misto'
        const meta =
          item.avaliacao_meta && typeof item.avaliacao_meta === 'object'
            ? /** @type {{ empresa_id?: string, nome_fantasia?: string, foto_url?: string | null, nota?: number, feedback?: string | null }} */ (
                item.avaliacao_meta
              )
            : null
        const showAvaliacao = tipoNorm === 'avaliacao' && meta

        return (
          <li key={item.id} className="overflow-hidden rounded-lg border border-[#E0E0E0] bg-white text-gray-900 shadow-sm">
            <div className="border-b border-gray-100 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <Link
                  href={`/perfil/${reposter.id}`}
                  className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md bg-gray-100"
                  aria-label={`Perfil de @${reposter.username}`}
                >
                  <AvatarImage src={reposter.foto} alt="" width={32} height={32} className="h-full w-full object-cover" />
                </Link>
                <p className="min-w-0 text-xs leading-snug text-gray-600">
                  <Link href={`/perfil/${reposter.id}`} className="font-semibold text-gray-800 hover:text-[#0097b2]">
                    @{reposter.username}
                  </Link>
                  <span>{repostEhFoto ? ' republicou foto de ' : ' republicou post de '}</span>
                  {item.usernameOriginal ? (
                    item.autorOriginalUsuarioId ? (
                      <Link
                        href={`/perfil/${item.autorOriginalUsuarioId}`}
                        className="font-semibold text-gray-800 hover:text-[#0097b2]"
                      >
                        @{item.usernameOriginal}
                      </Link>
                    ) : (
                      <span className="font-semibold text-gray-800">@{item.usernameOriginal}</span>
                    )
                  ) : item.autorOriginal ? (
                    <span className="font-semibold text-gray-800">{item.autorOriginal}</span>
                  ) : (
                    <span className="text-gray-500">autor original</span>
                  )}
                </p>
              </div>
            </div>

            {showAvaliacao ? (
              <div className="p-3 pt-2">
                <AvaliacaoCard meta={meta} />
              </div>
            ) : (
              <>
                {mediaUrl ? (
                  <div className="relative aspect-[4/3] w-full bg-gray-100">
                    <Image
                      src={mediaUrl}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 480px"
                    />
                  </div>
                ) : null}
                {item.texto ? (
                  <p className="whitespace-pre-wrap px-3 py-2 text-sm text-gray-800">{item.texto}</p>
                ) : null}
              </>
            )}

            <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2 text-xs text-gray-500">
              <time>
                {new Date(item.created_at).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </time>
              {item.originalId ? (
                <Link href={`/feed?post=${encodeURIComponent(item.originalId)}`} className="font-medium text-[#0097b2]">
                  Ver original
                </Link>
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
