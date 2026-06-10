'use client'

import { PreviewDocumento, isPdfUrl } from './PreviewDocumento'

export function DocumentoAnexoInline({
  titulo,
  url,
  resolvedUrl,
}: {
  titulo: string
  url: string
  resolvedUrl?: string | null
}) {
  const href = resolvedUrl ?? url
  const pdf = isPdfUrl(url)

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-bold text-gray-900">{titulo}</h4>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
        {pdf ? (
          <iframe
            src={href}
            title={titulo}
            className="h-[min(70vh,28rem)] w-full bg-white"
          />
        ) : (
          <PreviewDocumento
            url={url}
            label={titulo}
            resolvedUrl={resolvedUrl}
            className="min-h-[12rem] w-full"
            objectFit="contain"
          />
        )}
      </div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block text-xs font-semibold text-[#0097b2] hover:underline"
      >
        Abrir em nova aba
      </a>
    </div>
  )
}
