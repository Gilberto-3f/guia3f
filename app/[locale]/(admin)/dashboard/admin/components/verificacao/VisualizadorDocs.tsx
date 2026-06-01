'use client'

import { useMemo } from 'react'
import { pickDocumentoEmpresaUrl } from './verificacaoFormatters'
import { isPdfUrl, PreviewDocumento } from './PreviewDocumento'
import { useBodyScrollLock } from './useBodyScrollLock'

export function VisualizadorDocs({
  aberto,
  onClose,
  pendente,
  tipo,
  urlsResolvidas,
}: {
  aberto: boolean
  onClose: () => void
  pendente: Record<string, unknown>
  tipo: 'turistas' | 'profissionais' | 'empresas'
  urlsResolvidas?: Map<string, string>
}) {
  useBodyScrollLock(aberto)

  const docs = useMemo(() => {
    if (tipo === 'turistas') {
      return [
        { label: 'Documento frente', url: String(pendente.documento_frente_url ?? '') },
        { label: 'Documento verso', url: String(pendente.documento_verso_url ?? '') },
      ].filter((d) => d.url)
    }
    if (tipo === 'profissionais') {
      const d = (pendente.documentos ?? {}) as Record<string, string>
      const idF = String(d.identidade_url ?? pendente.documento_frente_url ?? pendente.identidade_url ?? '')
      const idV = String(d.documento_verso_url ?? pendente.documento_verso_url ?? '')
      const res = String(d.comprovante_residencia_url ?? pendente.comprovante_residencia_url ?? '')
      const prof = String(d.comprovante_profissao_url ?? pendente.comprovante_profissao_url ?? '')
      return [
        { label: 'Identidade (frente)', url: idF },
        { label: 'Identidade (verso)', url: idV },
        { label: 'Comprovante residência', url: res },
        { label: 'Comprovante profissão', url: prof },
      ].filter((x) => x.url)
    }
    const comercial = pickDocumentoEmpresaUrl(pendente)
    return [{ label: 'Documento comercial', url: comercial }].filter((x) => x.url)
  }, [pendente, tipo])

  if (!aberto) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-bold text-gray-900">Documentos</div>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-sm font-semibold text-gray-600 hover:bg-gray-100">
            Fechar
          </button>
        </div>
        <div className="mt-3 space-y-3">
          {docs.length === 0 ? <div className="rounded-xl border border-gray-200 p-4 text-sm text-gray-500">Sem documentos.</div> : null}
          {docs.map((doc) => {
            const urlExibir = urlsResolvidas?.get(doc.url) ?? doc.url
            return (
              <div key={doc.label} className="rounded-xl border border-gray-200 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-gray-800">{doc.label}</div>
                  <a
                    href={urlExibir}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="shrink-0 rounded bg-gray-900 px-2 py-1 text-xs font-semibold text-white"
                  >
                    Abrir / download
                  </a>
                </div>
                {isPdfUrl(doc.url) ? (
                  <iframe src={urlExibir} className="h-80 w-full rounded border border-gray-200" title={doc.label} />
                ) : (
                  <div className="overflow-auto rounded border border-gray-200 bg-gray-50">
                    <PreviewDocumento
                      url={doc.url}
                      label={doc.label}
                      className="max-h-[28rem] w-full"
                      objectFit="contain"
                      resolvedUrl={urlsResolvidas?.get(doc.url)}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
