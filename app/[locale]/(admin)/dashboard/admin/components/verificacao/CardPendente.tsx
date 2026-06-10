'use client'

import { useEffect, useMemo, useState } from 'react'
import { resolverUrlsDocumentosStorageAdmin } from '@/lib/documentosStorageUrl'
import type { DocAmpliado } from './ModalDocumentoAmpliado'
import { collectBotoesDocumentos, urlsDeBotoes, type DocBotao } from './docBotoes'
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

function BotaoDocumento({
  botao,
  onAbrir,
}: {
  botao: DocBotao
  onAbrir: (doc: DocAmpliado) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onAbrir({ titulo: botao.label, paginas: botao.paginas })}
      className="min-h-[44px] flex-1 rounded-xl border border-[#0097b2]/35 bg-[#0097b2]/5 px-4 py-2.5 text-sm font-bold text-[#0097b2] shadow-sm transition hover:border-[#0097b2] hover:bg-[#0097b2]/10 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0097b2]"
      aria-label={`Abrir ${botao.label}`}
    >
      {botao.label}
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
  onAbrirDocumento,
}: {
  item: CadastroPendente
  tipo: 'turistas' | 'profissionais' | 'empresas'
  onAprovar: () => void
  onReprovar: (motivo: string) => void
  onAbrirDocumento: (doc: DocAmpliado, urlsResolvidas: Map<string, string>) => void
}) {
  const [reprovarAberto, setReprovarAberto] = useState(false)
  const [motivoReprova, setMotivoReprova] = useState('')
  const [urlsResolvidas, setUrlsResolvidas] = useState<Map<string, string>>(new Map())
  const { podeExecutarRecurso } = usePermissao()

  const botoesDocs = collectBotoesDocumentos(tipo, item.raw)
  const urlsDocs = useMemo(() => urlsDeBotoes(botoesDocs), [botoesDocs])
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
            {botoesDocs.length === 0 ? (
              <div className="mt-2 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-3 text-center text-xs text-gray-500">Nenhum anexo</div>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {botoesDocs.map((b) => (
                  <BotaoDocumento
                    key={b.key}
                    botao={b}
                    onAbrir={(doc) => onAbrirDocumento(doc, urlsResolvidas)}
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
    </>
  )
}
