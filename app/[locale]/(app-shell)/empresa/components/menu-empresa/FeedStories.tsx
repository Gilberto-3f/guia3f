'use client'

import { useState } from 'react'
import { Link } from '@/i18n/navigation'
import SecaoChevron from './SecaoChevron'

export default function FeedStories() {
  const [secFeed, setSecFeed] = useState(true)
  const [secStory, setSecStory] = useState(false)

  return (
    <div className="mt-4 space-y-4">
      <SecaoChevron titulo="Feed" aberta={secFeed} onToggle={() => setSecFeed((v) => !v)}>
        <p className="mb-3 text-xs text-gray-600">
          Publique foto com texto ou apenas texto. As publicações aparecem no perfil da empresa, no feed dos
          seguidores e são intercaladas para novos utilizadores conforme as regras do feed.
        </p>
        <Link
          href="/feed/criar"
          className="inline-flex w-full items-center justify-center rounded-lg bg-[#0097b2] px-4 py-3 text-sm font-bold text-white hover:opacity-95 sm:w-auto"
        >
          Criar publicação no feed
        </Link>
      </SecaoChevron>

      <SecaoChevron titulo="Story" aberta={secStory} onToggle={() => setSecStory((v) => !v)}>
        <p className="mb-3 text-xs text-gray-600">
          Story em formato vertical (9:16). Visível no perfil da empresa e na barra de stories; distribuição para
          não seguidores segue as mesmas regras de intercalação do app.
        </p>
        <Link
          href="/feed/story/criar"
          className="inline-flex w-full items-center justify-center rounded-lg bg-[#0097b2] px-4 py-3 text-sm font-bold text-white hover:opacity-95 sm:w-auto"
        >
          Criar story
        </Link>
      </SecaoChevron>
    </div>
  )
}
