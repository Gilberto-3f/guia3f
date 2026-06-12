'use client'

import Image from 'next/image'
import type { ConteudoDenunciaPreview } from '@/lib/carregarConteudoDenuncia'

export function PreviewConteudoDenuncia({ conteudo }: { conteudo: ConteudoDenunciaPreview }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      {conteudo.texto ? <p className="whitespace-pre-wrap text-sm text-gray-800">{conteudo.texto}</p> : null}
      {conteudo.nota != null ? (
        <p className="mt-2 text-sm font-semibold text-amber-700">Nota: {conteudo.nota}/5</p>
      ) : null}
      {conteudo.meta ? <p className="mt-1 text-xs text-gray-500">{conteudo.meta}</p> : null}
      {conteudo.imagemUrl ? (
        <div className="relative mt-3 aspect-video max-h-64 w-full overflow-hidden rounded-lg">
          <Image src={conteudo.imagemUrl} alt="" fill className="object-contain" unoptimized />
        </div>
      ) : null}
      {conteudo.videoUrl ? (
        <video src={conteudo.videoUrl} controls className="mt-3 max-h-64 w-full rounded-lg" />
      ) : null}
    </div>
  )
}
