'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { ChevronDown, ChevronUp, Eye, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { tituloDenunciaConteudo, type ConteudoDenunciaPreview } from '@/lib/carregarConteudoDenuncia'

type DenunciaArquivada = {
  id: string
  created_at: string
  motivo: string
  descricao: string | null
  denunciante_email: string
  denunciante_nome: string
  denunciado_username: string
  denunciado_nome: string
  medida_tipo: string | null
  responsavel_email: string | null
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

export function DenunciasAuditoria() {
  const [logs, setLogs] = useState<DenunciaArquivada[]>([])
  const [loading, setLoading] = useState(true)
  const [detalheId, setDetalheId] = useState<string | null>(null)
  const [detalhe, setDetalhe] = useState<DenunciaArquivada | null>(null)
  const [conteudo, setConteudo] = useState<ConteudoDenunciaPreview | null>(null)
  const [leituras, setLeituras] = useState<LeituraRow[]>([])
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('denuncias')
        .select(
          'id, created_at, motivo, descricao, denunciante_id, denunciado_id, denunciado_tipo, conteudo_tipo, conteudo_id, medida_tipo, responsavel_id',
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
            denunciante_email: String(denunciante.data?.email ?? ''),
            denunciante_nome: String(denunciante.data?.username ?? ''),
            denunciado_username: denunciado.username,
            denunciado_nome: denunciado.nome,
            medida_tipo: r.medida_tipo != null ? String(r.medida_tipo) : null,
            responsavel_email: responsavel.data?.email != null ? String(responsavel.data.email) : null,
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

  const abrirDetalhe = async (id: string) => {
    if (detalheId === id) {
      setDetalheId(null)
      setDetalhe(null)
      setConteudo(null)
      setLeituras([])
      return
    }
    setDetalheId(id)
    setCarregandoDetalhe(true)
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
        denunciante?: { email?: string; username?: string }
      }
      const row = logs.find((l) => l.id === id)
      if (row) setDetalhe(row)
      setConteudo(json.conteudo ?? null)
      setLeituras(json.leituras ?? [])
    } finally {
      setCarregandoDetalhe(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="rounded-xl border border-[#0097b2]/20 bg-[#0097b2]/5 px-4 py-3 text-sm text-gray-700">
        Histórico arquivado de denúncias com medidas aplicadas. Ao abrir um registro, seu acesso fica registrado com
        usuário e data/hora.
      </p>

      {loading ? (
        <p className="text-sm text-gray-500">Carregando auditoria…</p>
      ) : logs.length === 0 ? (
        <p className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
          Nenhuma denúncia arquivada ainda.
        </p>
      ) : (
        <ul className="divide-y divide-gray-200 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          {logs.map((log) => {
            const expandido = detalheId === log.id
            const titulo = tituloDenunciaConteudo(log.conteudo_tipo, log.denunciado_tipo)
            return (
              <li key={log.id}>
                <button
                  type="button"
                  onClick={() => void abrirDetalhe(log.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
                >
                  <Eye className="h-4 w-4 shrink-0 text-gray-400" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[#0097b2]">{titulo}</p>
                    <p className="text-xs text-gray-500">
                      {formatarDataHora(log.created_at)} · @{log.denunciante_nome || log.denunciante_email.split('@')[0]}{' '}
                      → @{log.denunciado_username}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-gray-700">{log.motivo}</p>
                  </div>
                  {expandido ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </button>

                {expandido ? (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-4">
                    {carregandoDetalhe ? (
                      <p className="text-sm text-gray-500">Carregando…</p>
                    ) : (
                      <div className="space-y-3">
                        {detalhe?.medida_tipo ? (
                          <p className="text-sm">
                            <span className="font-semibold">Medida aplicada:</span> {detalhe.medida_tipo}
                            {detalhe.responsavel_email ? ` · por ${detalhe.responsavel_email}` : ''}
                          </p>
                        ) : null}
                        {conteudo?.texto ? (
                          <p className="whitespace-pre-wrap rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-800">
                            {conteudo.texto}
                          </p>
                        ) : null}
                        {conteudo?.imagemUrl ? (
                          <div className="relative aspect-video max-h-48 w-full overflow-hidden rounded-lg">
                            <Image src={conteudo.imagemUrl} alt="" fill className="object-contain" unoptimized />
                          </div>
                        ) : null}
                        <div className="rounded-xl border border-gray-200 bg-white p-3">
                          <p className="text-xs font-bold uppercase text-gray-500">Log de acesso (leitores)</p>
                          {leituras.length === 0 ? (
                            <p className="mt-2 text-sm text-gray-500">Nenhum acesso registrado.</p>
                          ) : (
                            <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto">
                              {leituras.map((l) => (
                                <li key={l.id} className="flex justify-between text-sm">
                                  <span className="font-medium">{l.admin_handle}</span>
                                  <span className="text-xs text-gray-500">{formatarDataHora(l.acessado_em)}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setDetalheId(null)
                            setDetalhe(null)
                          }}
                          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
                        >
                          <X className="h-4 w-4" /> Fechar
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
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
