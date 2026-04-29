'use client'

import { useState } from 'react'
import { VisualizadorDocs } from './VisualizadorDocs'
import { usePermissao } from '../../hooks/usePermissao'

export type CadastroPendente = {
  id: string
  nome: string
  username: string
  label: string
  dataCadastro: string
  email: string
  whatsappLine: string
  categoriaDisplay?: string
  empresaFiscal?: string
  alerta: string | null
  docsVerificado: boolean
  docsVerificadoEm?: string | null
  placaVermelha?: boolean
  raw: Record<string, unknown>
}

type DocThumb = { key: string; label: string; url: string }

function isPdfUrl(url: string): boolean {
  return url.toLowerCase().includes('.pdf')
}

function collectDocThumbs(tipo: 'turistas' | 'profissionais' | 'empresas', raw: Record<string, unknown>): DocThumb[] {
  if (tipo === 'turistas') {
    const out: DocThumb[] = []
    const frente = String(raw.documento_frente_url ?? '').trim()
    const verso = String(raw.documento_verso_url ?? '').trim()
    if (frente) out.push({ key: 'frente', label: 'Doc. frente', url: frente })
    if (verso) out.push({ key: 'verso', label: 'Doc. verso', url: verso })
    return out
  }
  if (tipo === 'profissionais') {
    const d = (raw.documentos ?? {}) as Record<string, string>
    const idF = String(
      raw.documento_frente_url ?? d.identidade_url ?? raw.identidade_url ?? ''
    ).trim()
    const idV = String(d.documento_verso_url ?? raw.documento_verso_url ?? '').trim()
    const res = String(d.comprovante_residencia_url ?? raw.comprovante_residencia_url ?? '').trim()
    const prof = String(d.comprovante_profissao_url ?? raw.comprovante_profissao_url ?? '').trim()
    const out: DocThumb[] = []
    if (idF) out.push({ key: 'idf', label: 'ID frente', url: idF })
    if (idV) out.push({ key: 'idv', label: 'ID verso', url: idV })
    if (res) out.push({ key: 'res', label: 'Resid.', url: res })
    if (prof) out.push({ key: 'prof', label: 'Profissão', url: prof })
    return out
  }
  const u = String(raw.documento_url ?? raw.documento_comercial_url ?? '').trim()
  if (u) return [{ key: 'com', label: 'Comercial', url: u }]
  return []
}

export function CardPendente({
  item,
  tipo,
  onAprovar,
  onReprovar,
  onDocsVerificado,
}: {
  item: CadastroPendente
  tipo: 'turistas' | 'profissionais' | 'empresas'
  onAprovar: () => void
  onReprovar: (motivo: string) => void
  onDocsVerificado: () => void
}) {
  const [modalAberto, setModalAberto] = useState(false)
  const [reprovarAberto, setReprovarAberto] = useState(false)
  const [motivoReprova, setMotivoReprova] = useState('')
  const { podeExecutarRecurso } = usePermissao()

  const thumbs = collectDocThumbs(tipo, item.raw)
  const podeAprovar = podeExecutarRecurso('aprovar')
  const podeReprovar = podeExecutarRecurso('reprovar')

  const confirmarLiberar = () => {
    if (!window.confirm('Confirmar liberação (aprovação) deste cadastro?')) return
    onAprovar()
  }

  const confirmarReprovar = () => {
    const m = motivoReprova.trim()
    if (!m) return
    onReprovar(m)
    setReprovarAberto(false)
    setMotivoReprova('')
  }

  return (
    <>
      <div className="max-h-[85vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="p-4">
          <div className="break-words text-sm font-semibold text-gray-900">{item.email}</div>
          <div className="mt-0.5 text-xs text-gray-500">{item.username}</div>

          <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-gray-800">
            <span className="font-semibold">{item.nome}</span>
            {tipo !== 'turistas' ? (
              <>
                <span className="text-gray-400" aria-hidden>
                  ·
                </span>
                <span className="text-gray-600">{item.whatsappLine}</span>
              </>
            ) : null}
            <span className="text-gray-400" aria-hidden>
              ·
            </span>
            <span className="text-gray-600">Cadastro: {item.dataCadastro}</span>
          </div>

          {tipo === 'profissionais' && item.categoriaDisplay ? (
            <div className="mt-2 text-sm text-gray-800">
              <span className="font-medium text-gray-600">Categoria:</span> {item.categoriaDisplay}
            </div>
          ) : null}

          {tipo === 'empresas' ? (
            <>
              {item.categoriaDisplay ? (
                <div className="mt-1 text-sm text-gray-800">
                  <span className="font-medium text-gray-600">Categoria:</span> {item.categoriaDisplay}
                </div>
              ) : null}
              {item.empresaFiscal ? (
                <div className="mt-1 text-sm text-gray-800">
                  <span className="font-medium text-gray-600">CNPJ / RUC / CUIT:</span> {item.empresaFiscal}
                </div>
              ) : null}
              {item.whatsappLine !== '—' ? (
                <div className="mt-1 text-sm text-gray-800">
                  <span className="font-medium text-gray-600">Contato:</span> {item.whatsappLine}
                </div>
              ) : null}
            </>
          ) : null}

          {item.placaVermelha ? (
            <div className="mt-2 inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">Placa vermelha</div>
          ) : null}

          {item.alerta ? <div className="mt-2 text-xs text-amber-800">{item.alerta}</div> : null}

          <div className="mt-3 border-t border-gray-100 pt-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Documentos</div>
            {thumbs.length === 0 ? (
              <div className="mt-2 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-3 text-center text-xs text-gray-500">Nenhum anexo</div>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {thumbs.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setModalAberto(true)}
                    className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-gray-50 text-left shadow-sm transition hover:border-[#0097b2]/50 hover:shadow"
                  >
                    <div className="relative aspect-square w-full bg-gray-100">
                      {isPdfUrl(t.url) ? (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center">
                          <span className="text-[10px] font-bold text-gray-700">PDF</span>
                          <span className="line-clamp-2 text-[10px] text-gray-500">{t.label}</span>
                        </div>
                      ) : (
                        <img src={t.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                      )}
                    </div>
                    <span className="border-t border-gray-100 bg-white px-1.5 py-1 text-center text-[10px] font-semibold leading-tight text-gray-700">{t.label}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setModalAberto(true)}
                className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Ver todos / ampliar
              </button>
              {!item.docsVerificado ? (
                <button type="button" onClick={onDocsVerificado} className="rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800 hover:bg-sky-100">
                  Marcar documentos verificados
                </button>
              ) : (
                <span className="self-center text-[11px] text-emerald-700">Docs verificados{item.docsVerificadoEm ? ` · ${item.docsVerificadoEm}` : ''}</span>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {podeAprovar ? (
                <button
                  type="button"
                  onClick={confirmarLiberar}
                  className="min-h-[44px] min-w-[120px] rounded-xl px-5 text-sm font-bold text-white shadow-sm transition hover:brightness-95 active:brightness-90"
                  style={{ backgroundColor: '#00D443' }}
                >
                  LIBERAR
                </button>
              ) : null}
              {podeReprovar ? (
                <button
                  type="button"
                  onClick={() => setReprovarAberto((v) => !v)}
                  className="min-h-[44px] min-w-[120px] rounded-xl bg-red-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 active:bg-red-800"
                >
                  REPROVAR
                </button>
              ) : null}
            </div>
          </div>

          {reprovarAberto && podeReprovar ? (
            <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50/80 p-3">
              <label className="mb-1 block text-xs font-semibold text-rose-900">Justificativa (obrigatória)</label>
              <textarea
                value={motivoReprova}
                onChange={(e) => setMotivoReprova(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-rose-200 bg-white p-2 text-sm text-gray-900"
                placeholder="Descreva o motivo da reprovação..."
              />
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setReprovarAberto(false)} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700">
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!motivoReprova.trim()}
                  onClick={confirmarReprovar}
                  className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Confirmar reprovação
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <VisualizadorDocs
        aberto={modalAberto}
        onClose={() => setModalAberto(false)}
        pendente={item.raw}
        tipo={tipo}
        onMarcarVerificado={onDocsVerificado}
      />
    </>
  )
}
