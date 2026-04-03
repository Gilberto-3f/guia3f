'use client'

import Image from 'next/image'
import { Play } from 'lucide-react'
import { STORY_RING_GRADIENT, visualizadoPorEmails } from '@/lib/feed-autor'

const AVATAR_DEFAULT = '/avatar-default.png'

/**
 * @param {{
 *   id: string
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
    <button
      type="button"
      onClick={() => onOpen(id)}
      className="flex w-[75px] shrink-0 flex-col items-center gap-0.5"
      aria-label={`Story ${label}`}
    >
      <div
        className={`rounded-full p-[3px] ${visto ? 'bg-gray-300' : ''}`}
        style={visto ? undefined : { background: STORY_RING_GRADIENT }}
      >
        <div className="rounded-full bg-white p-[2px]">
          <div className="relative h-[75px] w-[75px] overflow-hidden rounded-full bg-gray-100">
            <Image src={avatarUrl || AVATAR_DEFAULT} alt="" fill className="object-cover" sizes="75px" />
            {isVideo ? (
              <span
                className="absolute bottom-0.5 right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/55"
                aria-hidden
              >
                <Play size={12} className="ml-0.5 text-white" fill="white" />
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <span className={labelClass}>{label}</span>
    </button>
  )
}
