'use client'

import { useEffect, useMemo, useRef, useState, type SyntheticEvent } from 'react'
import { resolverUrlsDocumentosStorageAdmin } from '@/lib/documentosStorageUrl'
import { ModalDocumentoAmpliado } from './ModalDocumentoAmpliado'
import { PreviewDocumento, isPdfUrl } from './PreviewDocumento'
import { usePermissao } from '../../hooks/usePermissao'

export type CadastroPendente = {
  id: string
  nome: string
  username: string
  label: string
  dataCadastro: string
  email: string
  whatsappLine: string
  avatarUrl?: string | null
  categoriaDisplay?: string
  localizacaoDisplay?: string
  empresaFiscal?: string
  documentoIdentidade?: string
  alerta: string | null
  docsVerificado: boolean
  docsVerificadoEm?: string | null
  placaVermelha?: boolean
  raw: Record<string, unknown>
}

type DocThumb = { key: string; label: string; url: string }

const BADGE_EMPRESA_CATEGORIA: Record<string, string> = {
  Restaurantes: 'border-orange-200 bg-orange-50 text-orange-900',
  Atrativos: 'border-amber-200 bg-amber-50 text-amber-900',
  Lojas: 'border-violet-200 bg-violet-50 text-violet-900',
  Hospedagem: 'border-sky-200 bg-sky-50 text-sky-900',
}

function badgeEmpresaCategoriaClass(cat: string | undefined | null): string {
  const k = String(cat ?? '').trim()
  if (!k) return 'border-gray-200 bg-gray-100 text-gray-800'
  return BADGE_EMPRESA_CATEGORIA[k] ?? 'border-gray-200 bg-gray-100 text-gray-800'
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
    const idF = String(raw.documento_frente_url ?? d.identidade_url ?? raw.identidade_url ?? '').trim()
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
  const outEmp: DocThumb[] = []
  const ef = String(raw.documento_frente_url ?? '').trim()
  const ev = String(raw.documento_verso_url ?? '').trim()
  const er = String(raw.comprovante_residencia_url ?? '').trim()
  const ec = String(raw.documento_comercial_url ?? raw.documento_url ?? '').trim()
  if (ef) outEmp.push({ key: 'ef', label: 'Rep. ID frente', url: ef })
  if (ev) outEmp.push({ key: 'ev', label: 'Rep. ID verso', url: ev })
  if (er) outEmp.push({ key: 'er', label: 'Residência', url: er })
  if (ec) outEmp.push({ key: 'ec', label: 'Comercial / categoria', url: ec })
  if (outEmp.length > 0) return outEmp
  const u = String(raw.documento_url ?? raw.documento_comercial_url ?? '').trim()
  if (u) return [{ key: 'com', label: 'Comercial', url: u }]
  return []
}

function BotaoDocThumb({
  thumb,
  resolvedUrl,
  onAbrir,
}: {
  thumb: DocThumb
  resolvedUrl?: string
  onAbrir: (t: DocThumb) => void
}) {
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const abrir = (e: SyntheticEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onAbrir(thumb)
  }

  return (
    <button
      type="button"
      onClick={abrir}
      onTouchStart={(e) => {
        const touch = e.touches[0]
        if (touch) touchStart.current = { x: touch.clientX, y: touch.clientY }
      }}
      onTouchEnd={(e) => {
        const touch = e.changedTouches[0]
        const start = touchStart.current
        touchStart.current = null
        if (!touch || !start) return
        const dx = Math.abs(touch.clientX - start.x)
        const dy = Math.abs(touch.clientY - start.y)
        if (dx < 10 && dy < 10) abrir(e)
      }}
      aria-label={`Ampliar ${thumb.label}`}
      className="group flex cursor-zoom-in select-none touch-manipulation flex-col overflow-hidden rounded-xl border border-gray-200 bg-gray-50 text-left shadow-sm transition hover:border-[#0097b2]/50 hover:shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0097b2]"
    >
      <div className="relative aspect-square w-full bg-gray-100">
        {isPdfUrl(thumb.url) ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center">
            <span className="text-[10px] font-bold text-gray-700">PDF</span>
            <span className="line-clamp-2 text-[10px] text-gray-500">{thumb.label}</span>
            <span className="text-[9px] font-semibold text-[#0097b2]">Toque para abrir</span>
          </div>
        ) : (
          <PreviewDocumento
            url={thumb.url}
            label={thumb.label}
            className="pointer-events-none h-full w-full"
            objectFit="cover"
            resolvedUrl={resolvedUrl}
          />
        )}
      </div>
      <span className="border-t border-gray-100 bg-white px-1.5 py-1 text-center text-[10px] font-semibold leading-tight text-gray-700">
        {thumb.label}
      </span>
    </button>
  )
}

function AvatarQuadrado({ url, nome }: { url?: string | null; nome: string }) {
  const inicial = String(nome ?? '').trim().charAt(0).toUpperCase() || '?'
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className="h-14 w-14 shrink-0 rounded-lg object-cover bg-gray-100"
        loading="lazy"
      />
    )
  }
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-gray-200 text-lg font-bold text-gray-500">
      {inicial}
    </div>
  )
}

export function CardPendente({
  item,
  tipo,
  onAprovar,
  onReprovar,
}: {
  item: CadastroPendente
  tipo: 'turistas' | 'profissionais' | 'empresas'
  onAprovar: () => void
  onReprovar: (motivo: string) => void
}) {
  const [docAmpliado, setDocAmpliado] = useState<DocThumb | null>(null)
  const [reprovarAberto, setReprovarAberto] = useState(false)
  const [motivoReprova, setMotivoReprova] = useState('')
  const [urlsResolvidas, setUrlsResolvidas] = useState<Map<string, string>>(new Map())
  const { podeExecutarRecurso } = usePermissao()

  const thumbs = collectDocThumbs(tipo, item.raw)
  const urlsDocs = useMemo(() => thumbs.map((t) => t.url).filter((u): u is string => Boolean(u?.trim())), [thumbs])
  const podeAprovar = podeExecutarRecurso('aprovar')
  const podeReprovar = podeExecutarRecurso('reprovar')

  useEffect(() => {
    if (!urlsDocs.length) return
    let ativo = true
    void resolverUrlsDocumentosStorageAdmin(urlsDocs).then((map) => {
      if (ativo) setUrlsResolvidas(map)
    })
    return () => {
      ativo = false
    }
  }, [urlsDocs])

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
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="p-4">
          <div className="flex gap-3">
            <AvatarQuadrado url={item.avatarUrl} nome={item.nome} />
            <div className="min-w-0 flex-1">
              <div className="break-words text-sm font-semibold text-gray-900">{item.email}</div>
              <div className="mt-0.5 text-xs text-gray-500">{item.username}</div>
            </div>
          </div>

          <div className="mt-3 space-y-1 text-sm text-gray-800">
            <div>
              <span className="font-medium text-gray-600">Nome social:</span> {item.nome}
            </div>
            {tipo !== 'turistas' && item.whatsappLine !== '—' ? (
              <div>
                <span className="font-medium text-gray-600">Telefone:</span> {item.whatsappLine}
              </div>
            ) : null}
            {item.documentoIdentidade && item.documentoIdentidade !== '—' ? (
              <div>
                <span className="font-medium text-gray-600">Nº documento:</span> {item.documentoIdentidade}
              </div>
            ) : null}
            <div>
              <span className="font-medium text-gray-600">Cadastro:</span> {item.dataCadastro}
            </div>
            {item.localizacaoDisplay ? (
              <div>
                <span className="font-medium text-gray-600">Localização:</span> {item.localizacaoDisplay}
              </div>
            ) : null}
            {tipo === 'profissionais' && item.categoriaDisplay && item.categoriaDisplay !== '—' ? (
              <div>
                <span className="font-medium text-gray-600">Categoria:</span> {item.categoriaDisplay}
              </div>
            ) : null}
            {tipo === 'profissionais' && item.placaVermelha ? (
              <div>
                <span className="font-medium text-gray-600">Placa vermelha:</span> Sim
              </div>
            ) : null}
          </div>

          {tipo === 'empresas' ? (
            <div className="mt-2 space-y-1 text-sm text-gray-800">
              {item.categoriaDisplay && item.categoriaDisplay !== '—' ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-gray-600">Categoria:</span>
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badgeEmpresaCategoriaClass(item.categoriaDisplay)}`}
                  >
                    {item.categoriaDisplay}
                  </span>
                </div>
              ) : null}
              {item.empresaFiscal && item.empresaFiscal !== '—' ? (
                <div>
                  <span className="font-medium text-gray-600">CNPJ / RUC / CUIT:</span> {item.empresaFiscal}
                </div>
              ) : null}
            </div>
          ) : null}

          {item.alerta ? <div className="mt-2 text-xs text-amber-800">{item.alerta}</div> : null}

          {tipo === 'turistas' && Array.isArray(item.raw.pre_liberacoes) && item.raw.pre_liberacoes.length > 0 ? (
            <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-950">
              <div className="font-semibold uppercase tracking-wide text-sky-800">Pré-liberação</div>
              <ul className="mt-2 space-y-2">
                {(item.raw.pre_liberacoes as Record<string, unknown>[]).map((pl) => {
                  const st = String(pl.status ?? '')
                  const prof = String(pl.prof_username ?? '—')
                  const quando = pl.respondido_em
                    ? new Date(String(pl.respondido_em)).toLocaleString('pt-BR')
                    : pl.solicitado_em
                      ? new Date(String(pl.solicitado_em)).toLocaleString('pt-BR')
                      : '—'
                  const contratos = Array.isArray(pl.contratacoes) ? pl.contratacoes : []
                  return (
                    <li key={String(pl.id ?? prof + quando)} className="border-t border-sky-100 pt-2 first:border-0 first:pt-0">
                      <div>
                        <span className="font-medium">Profissional:</span> @{prof} —{' '}
                        <span className="font-medium">{st}</span>
                      </div>
                      <div>
                        <span className="font-medium">Quando:</span> {quando}
                      </div>
                      {contratos.length > 0 ? (
                        <div className="mt-1">
                          <span className="font-medium">Contratações no período:</span>
                          <ul className="mt-0.5 list-inside list-disc">
                            {contratos.slice(0, 8).map((c, i) => (
                              <li key={i}>
                                {String((c as Record<string, unknown>).descricao ?? (c as Record<string, unknown>).tipo ?? '—')}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <div className="text-sky-800/80">Nenhuma contratação registrada no período.</div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}

          <div className="mt-3 border-t border-gray-100 pt-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Documentos</div>
            {thumbs.length === 0 ? (
              <div className="mt-2 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-3 text-center text-xs text-gray-500">Nenhum anexo</div>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {thumbs.map((t) => (
                  <BotaoDocThumb
                    key={t.key}
                    thumb={t}
                    resolvedUrl={urlsResolvidas.get(t.url)}
                    onAbrir={setDocAmpliado}
                  />
                ))}
              </div>
            )}
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

      <ModalDocumentoAmpliado
        doc={docAmpliado ? { label: docAmpliado.label, url: docAmpliado.url } : null}
        onClose={() => setDocAmpliado(null)}
        resolvedUrl={docAmpliado ? urlsResolvidas.get(docAmpliado.url) : undefined}
      />
    </>
  )
}
