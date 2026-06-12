'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  carregarConteudoDenuncia,
  tituloDenunciaConteudo,
  type ConteudoDenunciaPreview,
} from '@/lib/carregarConteudoDenuncia'
import {
  LABEL_GRAVIDADE,
  formatarMotivoDenuncia,
  labelMedidaDenuncia,
  resumoMedidaDenuncia,
} from '../../utils/denunciaUi'
import type { DenunciaGravidade } from '../../types/admin.types'
import { PreviewConteudoDenuncia } from './PreviewConteudoDenuncia'
import ModalExpandirPublicacaoDenuncia from './ModalExpandirPublicacaoDenuncia'

type DenunciaArquivada = {
  id: string
  created_at: string
  motivo: string
  descricao: string | null
  gravidade: DenunciaGravidade | null
  denunciante_email: string
  denunciante_nome: string
  denunciado_username: string
  denunciado_nome: string
  medida_tipo: string | null
  penalidade_aplicada: string | null
  penalidade_detalhes: {
    texto?: string | null
    motivo?: string | null
    medida?: string | null
    dias?: number
  } | null
  responsavel_email: string | null
  analisado_em: string | null
  conteudo_tipo: string | null
  conteudo_id: string | null
  denunciado_tipo: string
  denunciado_id: string
}

type LeituraRow = { id: string; admin_handle: string; acessado_em: string }

function formatarDataHora(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function parsePenalidadeDetalhes(raw: unknown): DenunciaArquivada['penalidade_detalhes'] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const d = raw as Record<string, unknown>
  return {
    texto: d.texto != null ? String(d.texto) : null,
    motivo: d.motivo != null ? String(d.motivo) : null,
    medida: d.medida != null ? String(d.medida) : null,
    dias: typeof d.dias === 'number' ? d.dias : d.dias != null ? Number(d.dias) : undefined,
  }
}

export function DenunciasAuditoria() {
  const [logs, setLogs] = useState<DenunciaArquivada[]>([])
  const [loading, setLoading] = useState(true)
  const [detalheId, setDetalheId] = useState<string | null>(null)
  const [detalhe, setDetalhe] = useState<DenunciaArquivada | null>(null)
  const [conteudo, setConteudo] = useState<ConteudoDenunciaPreview | null>(null)
  const [leituras, setLeituras] = useState<LeituraRow[]>([])
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)
  const [infoAberta, setInfoAberta] = useState(false)
  const [modalPublicacao, setModalPublicacao] = useState(false)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('denuncias')
        .select(
          'id, created_at, motivo, descricao, gravidade, denunciante_id, denunciado_id, denunciado_tipo, conteudo_tipo, conteudo_id, medida_tipo, penalidade_aplicada, penalidade_detalhes, responsavel_id, analisado_em',
        )
        .eq('status', 'arquivada')
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) throw error

      const mapped = await Promise.all(
        (data ?? []).map(async (row) => {
          const r = row as Record<string, unknown>
          const [denunciante, denunciado, responsavel] = await Promise.all([
            supabase.from('usuarios').select('email, username').eq('id', String(r.denunciante_id)).maybeSingle(),
            resolveDenunciadoLabel(String(r.denunciado_tipo), String(r.denunciado_id)),
            r.responsavel_id
              ? supabase.from('usuarios').select('email').eq('id', String(r.responsavel_id)).maybeSingle()
              : Promise.resolve({ data: null }),
          ])
          return {
            id: String(r.id),
            created_at: String(r.created_at),
            motivo: String(r.motivo),
            descricao: r.descricao != null ? String(r.descricao) : null,
            gravidade: r.gravidade != null ? (String(r.gravidade) as DenunciaGravidade) : null,
            denunciante_email: String(denunciante.data?.email ?? ''),
            denunciante_nome: String(denunciante.data?.username ?? ''),
            denunciado_username: denunciado.username,
            denunciado_nome: denunciado.nome,
            medida_tipo: r.medida_tipo != null ? String(r.medida_tipo) : null,
            penalidade_aplicada: r.penalidade_aplicada != null ? String(r.penalidade_aplicada) : null,
            penalidade_detalhes: parsePenalidadeDetalhes(r.penalidade_detalhes),
            responsavel_email: responsavel.data?.email != null ? String(responsavel.data.email) : null,
            analisado_em: r.analisado_em != null ? String(r.analisado_em) : null,
            conteudo_tipo: r.conteudo_tipo != null ? String(r.conteudo_tipo) : null,
            conteudo_id: r.conteudo_id != null ? String(r.conteudo_id) : null,
            denunciado_tipo: String(r.denunciado_tipo),
            denunciado_id: String(r.denunciado_id),
          } satisfies DenunciaArquivada
        }),
      )
      setLogs(mapped)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchLogs()
  }, [fetchLogs])

  const fecharDetalhe = () => {
    setDetalheId(null)
    setDetalhe(null)
    setConteudo(null)
    setLeituras([])
    setInfoAberta(false)
  }

  const abrirDetalhe = async (id: string) => {
    if (detalheId === id) {
      fecharDetalhe()
      return
    }
    setDetalheId(id)
    setCarregandoDetalhe(true)
    setInfoAberta(false)
    setConteudo(null)
    setLeituras([])

    try {
      await fetch(`/api/admin/denuncias-auditoria/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'registrar_acesso' }),
      })
      const res = await fetch(`/api/admin/denuncias-auditoria/${id}`)
      const json = (await res.json()) as {
        ok?: boolean
        denuncia?: Record<string, unknown>
        conteudo?: ConteudoDenunciaPreview | null
        leituras?: LeituraRow[]
      }
      const row = logs.find((l) => l.id === id) ?? null
      setDetalhe(row)
      setConteudo(json.conteudo ?? null)
      setLeituras(json.leituras ?? [])

      if (!json.conteudo && row) {
        const preview = await carregarConteudoDenuncia(supabase, {
          conteudoTipo: row.conteudo_tipo,
          conteudoId: row.conteudo_id,
          denunciadoTipo: row.denunciado_tipo,
          denunciadoId: row.denunciado_id,
        })
        setConteudo(preview)
      }
    } finally {
      setCarregandoDetalhe(false)
    }
  }

  const logExpandido = detalhe ?? logs.find((l) => l.id === detalheId) ?? null
  const postId =
    logExpandido?.conteudo_tipo === 'post' && logExpandido.conteudo_id ? logExpandido.conteudo_id : null

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 shadow-sm">
          Carregando auditoria…
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 shadow-sm">
          Nenhuma denúncia arquivada ainda.
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => {
            const expandido = detalheId === log.id
            const titulo = tituloDenunciaConteudo(log.conteudo_tipo, log.denunciado_tipo)
            const denuncianteHandle = log.denunciante_nome || log.denunciante_email.split('@')[0]
            const ativo = expandido ? logExpandido : log

            return (
              <article
                key={log.id}
                className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => void abrirDetalhe(log.id)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-gray-50"
                  aria-expanded={expandido}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-bold text-[#0097b2]">{titulo}</p>
                    <p className="mt-1 text-sm text-gray-700">
                      <span className="font-semibold">Denunciante:</span> @{denuncianteHandle}
                      {' · '}
                      <span className="font-semibold">Denunciado:</span> @{log.denunciado_username || log.denunciado_nome}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      Data da denúncia: {formatarDataHora(log.created_at)}
                    </p>
                  </div>
                  {expandido ? (
                    <ChevronUp className="h-5 w-5 shrink-0 text-gray-400" aria-hidden />
                  ) : (
                    <ChevronDown className="h-5 w-5 shrink-0 text-gray-400" aria-hidden />
                  )}
                </button>

                {expandido ? (
                  <div className="border-t border-gray-100 bg-gray-50/80 px-4 py-4">
                    {carregandoDetalhe ? (
                      <p className="text-sm text-gray-500">Carregando registro arquivado…</p>
                    ) : ativo ? (
                      <div className="space-y-4">
                        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                          <button
                            type="button"
                            onClick={() => setInfoAberta((v) => !v)}
                            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50"
                            aria-expanded={infoAberta}
                          >
                            <span className="text-sm font-bold uppercase tracking-wide text-gray-800">
                              Informações da denúncia
                            </span>
                            {infoAberta ? (
                              <ChevronUp className="h-5 w-5 shrink-0 text-gray-500" aria-hidden />
                            ) : (
                              <ChevronDown className="h-5 w-5 shrink-0 text-gray-500" aria-hidden />
                            )}
                          </button>

                          {infoAberta ? (
                            <div className="space-y-4 border-t border-gray-100 px-4 py-4">
                              <div>
                                <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                                  O que foi denunciado?
                                </p>
                                <p className="mt-1 text-sm text-gray-700">
                                  <span className="font-semibold">Motivo:</span>{' '}
                                  {formatarMotivoDenuncia(ativo.motivo, ativo.descricao)}
                                </p>
                                {conteudo ? (
                                  <div className="mt-3">
                                    <PreviewConteudoDenuncia conteudo={conteudo} />
                                  </div>
                                ) : (
                                  <p className="mt-2 text-sm text-gray-500">Conteúdo indisponível.</p>
                                )}
                                {postId ? (
                                  <button
                                    type="button"
                                    onClick={() => setModalPublicacao(true)}
                                    className="mt-3 text-sm font-semibold text-[#0097b2] hover:underline"
                                  >
                                    Expandir Publicação
                                  </button>
                                ) : null}
                              </div>

                              <div>
                                <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                                  Nível da denúncia
                                </p>
                                <p className="mt-1 text-sm font-bold text-gray-900">
                                  {ativo.gravidade ? LABEL_GRAVIDADE[ativo.gravidade] : 'Não definido'}
                                </p>
                              </div>
                            </div>
                          ) : null}
                        </div>

                        <div className="rounded-xl border border-gray-200 bg-white p-4">
                          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Medida aplicada</p>
                          <div className="mt-2 space-y-1.5 text-sm text-gray-800">
                            <p>
                              <span className="font-semibold text-gray-700">Administrador:</span>{' '}
                              {ativo.responsavel_email ?? '—'}
                            </p>
                            {ativo.analisado_em ? (
                              <p>
                                <span className="font-semibold text-gray-700">Data/hora:</span>{' '}
                                {formatarDataHora(ativo.analisado_em)}
                              </p>
                            ) : null}
                            <p>
                              <span className="font-semibold text-gray-700">Tipo:</span>{' '}
                              {labelMedidaDenuncia(ativo.medida_tipo ?? ativo.penalidade_aplicada)}
                            </p>
                            <p className="whitespace-pre-wrap rounded-lg border border-gray-100 bg-gray-50 p-3 text-gray-800">
                              {resumoMedidaDenuncia({
                                medida_tipo: ativo.medida_tipo,
                                penalidade_aplicada: ativo.penalidade_aplicada,
                                penalidade_detalhes: ativo.penalidade_detalhes,
                              })}
                            </p>
                          </div>
                        </div>

                        <div className="rounded-xl border border-gray-200 bg-white p-4">
                          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Logs de Acesso</p>
                          {leituras.length === 0 ? (
                            <p className="mt-2 text-sm text-gray-500">Nenhum acesso registrado ainda.</p>
                          ) : (
                            <ul className="mt-2 max-h-40 space-y-1.5 overflow-y-auto">
                              {leituras.map((l) => (
                                <li
                                  key={l.id}
                                  className="flex flex-wrap items-baseline justify-between gap-2 text-sm"
                                >
                                  <span className="font-medium text-gray-800">{l.admin_handle}</span>
                                  <span className="text-xs text-gray-500">{formatarDataHora(l.acessado_em)}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      )}

      <ModalExpandirPublicacaoDenuncia
        aberto={modalPublicacao}
        postId={postId}
        onClose={() => setModalPublicacao(false)}
      />
    </div>
  )
}

async function resolveDenunciadoLabel(tipo: string, id: string) {
  if (tipo === 'turista') {
    const { data } = await supabase.from('turistas').select('nome_completo, nome_usuario').eq('id', id).maybeSingle()
    return { nome: String(data?.nome_completo ?? ''), username: String(data?.nome_usuario ?? '') }
  }
  if (tipo === 'profissional') {
    const { data } = await supabase.from('profissionais').select('nome_completo, nome_usuario').eq('id', id).maybeSingle()
    return { nome: String(data?.nome_completo ?? ''), username: String(data?.nome_usuario ?? '') }
  }
  if (tipo === 'empresa') {
    const { data } = await supabase.from('empresas').select('nome_fantasia, nome_usuario').eq('id', id).maybeSingle()
    return { nome: String(data?.nome_fantasia ?? ''), username: String(data?.nome_usuario ?? '') }
  }
  return { nome: 'Story', username: 'autor' }
}
