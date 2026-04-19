'use client'

import AvatarImage from '@/components/AvatarImage'
import { STORY_RING_GRADIENT, visualizadoPorEmails } from '@/lib/feed-autor'

/**
 * @param {{
 *   id: string
 *   label: string
 *   avatarUrl: string | null
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
    <div className="flex w-[76px] shrink-0 flex-col items-center gap-1">
      <div className="relative flex aspect-square w-[76px] shrink-0 items-center justify-center">
        <div
          className={`box-border w-full max-w-[76px] rounded-full p-[3px] ${visto ? 'bg-gray-300' : ''}`}
          style={visto ? undefined : { background: STORY_RING_GRADIENT }}
        >
          <div className="rounded-full bg-white p-[2px]">
            <button
              type="button"
              onClick={() => onOpen(id)}
              className="relative block aspect-square w-full max-h-[68px] max-w-[68px] overflow-hidden rounded-full bg-gray-100"
              aria-label={`Ver story de ${label}`}
            >
              <AvatarImage
                src={avatarUrl}
                alt=""
                fill
                className="object-cover"
                sizes="76px"
                priority
              />
            </button>
          </div>
        </div>
      </div>
      <span className={labelClass} title={label}>
        {label}
      </span>
    </div>
  )
}
