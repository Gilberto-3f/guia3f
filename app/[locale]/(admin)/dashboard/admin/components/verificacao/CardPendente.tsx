'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, MoreVertical } from 'lucide-react'
import { resolverUrlsDocumentosStorageAdmin } from '@/lib/documentosStorageUrl'
import { collectPaginasDocumentos, urlsDePaginas } from './docBotoes'
import { DocumentoAnexoInline } from './DocumentoAnexoInline'
import { ModalReprovarCadastro } from './ModalReprovarCadastro'
import { usePermissao } from '../../hooks/usePermissao'

const COR_LOGO = '#0097b2'

const TITULO_CATEGORIA: Record<'turistas' | 'profissionais' | 'empresas', string> = {
  turistas: 'TURISTA',
  profissionais: 'PROFISSIONAL',
  empresas: 'EMPRESA',
}

export type CadastroPendente = {
  id: string
  usuarioId: string
  nome: string
  username: string
  label: string
  dataCadastro: string
  email: string
  whatsappLine: string
  avatarUrl?: string | null
  documentoIdentidade?: string
  cidadeDisplay?: string
  empresaFiscal?: string
  alerta: string | null
  docsVerificado: boolean
  docsVerificadoEm?: string | null
  placaVermelha?: boolean
  raw: Record<string, unknown>
}

function AvatarCentralizado({ url, nome }: { url?: string | null; nome: string }) {
  const inicial = String(nome ?? '').trim().charAt(0).toUpperCase() || '?'
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className="mx-auto h-24 w-24 rounded-2xl object-cover bg-gray-100 shadow-sm"
        loading="lazy"
      />
    )
  }
  return (
    <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-2xl bg-gray-200 text-2xl font-bold text-gray-500 shadow-sm">
      {inicial}
    </div>
  )
}

function LinhaInfo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="text-sm text-gray-800">
      <span className="font-medium text-gray-600">{rotulo}:</span> {valor}
    </div>
  )
}

export function CardPendente({
  item,
  tipo,
  onAprovar,
  onReprovar,
  onSolicitarExclusao,
}: {
  item: CadastroPendente
  tipo: 'turistas' | 'profissionais' | 'empresas'
  onAprovar: () => void
  onReprovar: (motivo: string) => void | Promise<void>
  onSolicitarExclusao: () => void | Promise<void>
}) {
  const [docsAbertos, setDocsAbertos] = useState(false)
  const [reprovarAberto, setReprovarAberto] = useState(false)
  const [motivoReprova, setMotivoReprova] = useState('')
  const [reprovarEnviando, setReprovarEnviando] = useState(false)
  const [menuAberto, setMenuAberto] = useState(false)
  const [urlsResolvidas, setUrlsResolvidas] = useState<Map<string, string>>(new Map())
  const menuRef = useRef<HTMLDivElement>(null)
  const { podeExecutarRecurso } = usePermissao()

  const paginasDocs = useMemo(() => collectPaginasDocumentos(tipo, item.raw), [tipo, item.raw])
  const urlsDocs = useMemo(() => urlsDePaginas(paginasDocs), [paginasDocs])
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

  useEffect(() => {
    if (!menuAberto) return
    const fechar = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuAberto(false)
    }
    document.addEventListener('mousedown', fechar)
    return () => document.removeEventListener('mousedown', fechar)
  }, [menuAberto])

  const confirmarLiberar = () => {
    if (!window.confirm('Confirmar liberação (aprovação) deste cadastro?')) return
    onAprovar()
  }

  const confirmarReprovar = async () => {
    const m = motivoReprova.trim()
    if (!m) return
    setReprovarEnviando(true)
    try {
      await onReprovar(m)
      setReprovarAberto(false)
      setMotivoReprova('')
    } finally {
      setReprovarEnviando(false)
    }
  }

  const confirmarSolicitarExclusao = () => {
    setMenuAberto(false)
    if (
      !window.confirm(
        'Solicitar exclusão definitiva deste cadastro? O ADM GERAL será notificado para concluir a remoção da conta.',
      )
    ) {
      return
    }
    onSolicitarExclusao()
  }

  const nomeRotulo = tipo === 'empresas' ? 'Nome fantasia' : 'Nome social'
  const docRotulo = tipo === 'empresas' ? 'Nº doc. comercial (CNPJ, CUIT, RUC)' : 'Nº de documento'

  return (
    <>
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="p-4">
          <h3 className="text-center text-base font-bold uppercase tracking-wide sm:text-lg" style={{ color: COR_LOGO }}>
            {TITULO_CATEGORIA[tipo]}
          </h3>

          <div className="mt-4">
            <AvatarCentralizado url={item.avatarUrl} nome={item.nome} />
          </div>

          <div className="mt-4 space-y-1.5">
            <LinhaInfo rotulo={nomeRotulo} valor={item.nome || '—'} />
            <LinhaInfo rotulo={docRotulo} valor={item.documentoIdentidade || item.empresaFiscal || '—'} />
            <LinhaInfo rotulo="Username" valor={item.username || '—'} />
            <LinhaInfo rotulo="WhatsApp" valor={item.whatsappLine} />
            <LinhaInfo rotulo="E-mail" valor={item.email} />
            <LinhaInfo rotulo="Cadastro" valor={item.dataCadastro} />
            {tipo !== 'turistas' && item.cidadeDisplay ? (
              <LinhaInfo rotulo="Cidade" valor={item.cidadeDisplay} />
            ) : null}
          </div>

          {item.alerta ? <div className="mt-3 text-xs text-amber-800">{item.alerta}</div> : null}
          {tipo === 'profissionais' && item.placaVermelha ? (
            <div className="mt-2 text-xs font-medium text-rose-700">Placa vermelha registrada</div>
          ) : null}

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

          <div className="mt-4 border-t border-gray-100 pt-3">
            {paginasDocs.length === 0 ? (
              <p className="text-center text-sm font-bold text-gray-700">DOCUMENTOS</p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setDocsAbertos((v) => !v)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-center hover:bg-gray-50"
                  aria-expanded={docsAbertos}
                >
                  <span className="text-sm font-bold text-gray-900">DOCUMENTOS</span>
                  <span className="rounded-full bg-[#0097b2]/10 px-2 py-0.5 text-[11px] font-bold text-[#0097b2]">
                    {paginasDocs.length}
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-gray-600 transition-transform ${docsAbertos ? 'rotate-180' : ''}`}
                    aria-hidden
                  />
                </button>

                {docsAbertos ? (
                  <div className="mt-4 space-y-8">
                    {paginasDocs.map((pagina) => (
                      <DocumentoAnexoInline
                        key={pagina.key}
                        titulo={pagina.titulo}
                        url={pagina.url}
                        resolvedUrl={urlsResolvidas.get(pagina.url)}
                      />
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
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
                onClick={() => setReprovarAberto(true)}
                className="min-h-[44px] min-w-[120px] rounded-xl bg-red-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 active:bg-red-800"
              >
                REPROVAR
              </button>
            ) : null}
            {podeReprovar ? (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuAberto((v) => !v)}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 hover:text-gray-700"
                  aria-label="Mais opções"
                  aria-expanded={menuAberto}
                  aria-haspopup="menu"
                >
                  <MoreVertical className="h-5 w-5" aria-hidden />
                </button>
                {menuAberto ? (
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-10 mt-1 min-w-[220px] overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={confirmarSolicitarExclusao}
                      className="w-full px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-rose-700 hover:bg-rose-50"
                    >
                      Solicitar exclusão
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <ModalReprovarCadastro
        aberto={reprovarAberto}
        nome={item.nome}
        motivo={motivoReprova}
        onMotivoChange={setMotivoReprova}
        onConfirmar={confirmarReprovar}
        onFechar={() => {
          if (reprovarEnviando) return
          setReprovarAberto(false)
          setMotivoReprova('')
        }}
        enviando={reprovarEnviando}
      />
    </>
  )
}
