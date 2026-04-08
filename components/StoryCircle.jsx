'use client'

import Link from 'next/link'
import { Play } from 'lucide-react'
import AvatarImage from '@/components/AvatarImage'
import { STORY_RING_GRADIENT, visualizadoPorEmails } from '@/lib/feed-autor'

/**
 * @param {{
 *   id: string
 *   autorUsuarioId: string
 *   label: string
 *   avatarUrl: string | null
 *   isVideo?: boolean
 *   visualizado_por: unknown
 *   userEmail: string | null
 *   onOpen: (id: string) => void
 *   labelOnDark?: boolean
 * }} props
 */
export default function StoryCircle({
  id,
  autorUsuarioId,
  label,
  avatarUrl,
  isVideo = false,
  visualizado_por,
  userEmail,
  onOpen,
  labelOnDark = false,
}) {
  const emails = visualizadoPorEmails(visualizado_por)
  const visto = userEmail ? emails.includes(userEmail) : false

  const labelClass = labelOnDark
    ? 'max-w-[5rem] truncate text-center text-xs text-white/95'
    : 'max-w-[5rem] truncate text-center text-xs text-gray-600'

  return (
    <div className="flex w-[75px] shrink-0 flex-col items-center gap-0.5">
      <div className="relative w-[75px] shrink-0">
        <div
          className={`rounded-full p-[3px] ${visto ? 'bg-gray-300' : ''}`}
          style={visto ? undefined : { background: STORY_RING_GRADIENT }}
        >
          <div className="rounded-full bg-white p-[2px]">
            <Link
              href={`/perfil/${autorUsuarioId}`}
              className="relative block h-[75px] w-[75px] overflow-hidden rounded-full bg-gray-100"
              aria-label={`Perfil de ${label}`}
            >
              <AvatarImage src={avatarUrl} alt="" fill className="object-cover" sizes="75px" />
              {isVideo ? (
                <span
                  className="absolute bottom-0.5 right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/55"
                  aria-hidden
                >
                  <Play size={12} className="ml-0.5 text-white" fill="white" />
                </span>
              ) : null}
            </Link>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onOpen(id)}
          className="absolute -bottom-0.5 -right-0.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white shadow-md ring-2 ring-white"
          aria-label={`Ver story de ${label}`}
        >
          <Play size={14} className="ml-0.5 text-white" fill="white" />
        </button>
      </div>
      <Link href={`/perfil/${autorUsuarioId}`} className={labelClass}>
        {label}
      </Link>
    </div>
  )
}
