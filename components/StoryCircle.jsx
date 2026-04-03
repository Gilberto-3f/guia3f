'use client'

import Image from 'next/image'
import { Play } from 'lucide-react'
import { visualizadoPorEmails } from '@/lib/feed-autor'

const GRADIENT =
  'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)'

/**
 * @param {{
 *   id: string
 *   label: string
 *   avatarUrl: string | null
 *   isVideo?: boolean
 *   visualizado_por: unknown
 *   userEmail: string | null
 *   onOpen: (id: string) => void
 * }} props
 * avatarUrl: foto de perfil do autor (não a mídia do story).
 */
export default function StoryCircle({ id, label, avatarUrl, isVideo = false, visualizado_por, userEmail, onOpen }) {
  const emails = visualizadoPorEmails(visualizado_por)
  const visto = userEmail ? emails.includes(userEmail) : false

  return (
    <button
      type="button"
      onClick={() => onOpen(id)}
      className="flex w-16 shrink-0 flex-col items-center gap-1"
      aria-label={`Story ${label}`}
    >
      <div
        className={`rounded-full p-[3px] ${visto ? 'bg-gray-300' : ''}`}
        style={visto ? undefined : { background: GRADIENT }}
      >
        <div className="rounded-full bg-white p-[2px]">
          <div className="relative h-14 w-14 overflow-hidden rounded-full bg-gray-100">
            {avatarUrl ? (
              <Image src={avatarUrl} alt="" fill className="object-cover" sizes="56px" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-lg font-medium text-gray-400">{label.charAt(0)}</div>
            )}
            {isVideo ? (
              <span
                className="absolute bottom-0.5 right-0.5 flex h-5 w-5 items-center justify-center rounded-sm bg-black/55"
                aria-hidden
              >
                <Play size={12} className="ml-0.5 text-white" fill="white" />
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <span className="max-w-[4.5rem] truncate text-center text-[10px] text-gray-600">{label}</span>
    </button>
  )
}
