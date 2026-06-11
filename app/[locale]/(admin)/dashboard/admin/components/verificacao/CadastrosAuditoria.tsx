'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Eye, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSharedAdminGate } from '../../context/AdminPermissaoContext'
import { statusFinalDoLog, formatarStatusFinal } from '../../utils/registrarLogVerificacao'
import { TIPOS_LOG_CADASTRO, type TipoLogCadastro } from '@/lib/cadastroAuditoriaLeitura'

type Filtros = {
  periodo: '7d' | '30d' | '90d' | 'todos'
  perfil: 'todos' | TipoLogCadastro
  acao: 'todas' | 'aprov' | 'reprov' | 'exclusao' | 'docs'
}

type LogRow = {
  id: string
  created_at: string
  admin_email: string | null
  acao: string
  tipo: string | null
  perfil_id: string
  detalhes: unknown
}

type LeituraRow = {
  id: string
  admin_handle: string
  acessado_em: string
}

type PerfilResumo = {
  id: string
  nome: string
  username: string
  status: string | null
  motivo_reprovacao: string | null
}

const COR_LOGO = '#0097b2'

const LABEL_PERFIL: Record<TipoLogCadastro, string> = {
  turistas: 'Turista',
  profissionais: 'Profissional',
  empresas: 'Empresa',
}

function getDataLimite(periodo: Filtros['periodo']): string | null {
  if (periodo === 'todos') return null
  const days = periodo === '7d' ? 7 : periodo === '30d' ? 30 : 90
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

function formatarDataHora(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getStatusIcon(acao: string) {
  const a = acao.toLowerCase()
  if (a.includes('aprov')) return '✅'
  if (a.includes('reprov')) return '❌'
  if (a.includes('exclus')) return '🗑️'
  if (a.includes('doc')) return '📄'
  return '📋'
}

function motivoDoLog(log: LogRow): string | null {
  const det = log.detalhes
  if (!det || typeof det !== 'object' || Array.isArray(det)) return null
  const m = (det as Record<string, unknown>).motivo
  return m != null && String(m).trim() ? String(m).trim() : null
}

function nomePerfilCacheKey(tipo: string, perfilId: string) {
  return `${tipo}:${perfilId}`
}

export function CadastrosAuditoria() {
  const gate = useSharedAdminGate()
  const admin = gate.status === 'ok' ? gate.admin : null
  const isAdminGeral = admin?.admin_level === 1
  const rawCargo = (admin?.admin_permissoes as unknown as { cargo?: string })?.cargo
  const podeExportar = Boolean(isAdminGeral || rawCargo === 'FINANCEIRO')

  const [logs, setLogs] = useState<LogRow[]>([])
  const [nomesPerfil, setNomesPerfil] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [filtros, setFiltros] = useState<Filtros>({ periodo: '30d', perfil: 'todos', acao: 'todas' })
  const [detalheId, setDetalheId] = useState<string | null>(null)
  const [detalheCarregando, setDetalheCarregando] = useState(false)
  const [detalheErro, setDetalheErro] = useState<string | null>(null)
  const [detalheLog, setDetalheLog] = useState<LogRow | null>(null)
  const [detalhePerfil, setDetalhePerfil] = useState<PerfilResumo | null>(null)
  const [leituras, setLeituras] = useState<LeituraRow[]>([])

  const carregarNomesPerfis = useCallback(async (rows: LogRow[]) => {
    const map: Record<string, string> = {}
    const porTipo = new Map<TipoLogCadastro, string[]>()
    for (const log of rows) {
      const tipo = log.tipo
      if (!tipo || !TIPOS_LOG_CADASTRO.includes(tipo as TipoLogCadastro)) continue
      const t = tipo as TipoLogCadastro
      const ids = porTipo.get(t) ?? []
      ids.push(log.perfil_id)
      porTipo.set(t, ids)
    }

    await Promise.all(
      [...porTipo.entries()].map(async ([tipo, ids]) => {
        const unique = [...new Set(ids.filter(Boolean))]
        if (!unique.length) return
        const { data } = await supabase.from(tipo).select('id, nome_completo, nome_fantasia, nome_usuario').in('id', unique)
        for (const row of data ?? []) {
          const r = row as Record<string, unknown>
          const id = String(r.id ?? '')
          const nome =
            String(r.nome_fantasia ?? r.nome_completo ?? r.nome_usuario ?? '').trim() || '—'
          map[nomePerfilCacheKey(tipo, id)] = nome
        }
      }),
    )
    setNomesPerfil(map)
  }, [])

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('logs_verificacao')
        .select('id, created_at, admin_email, acao, tipo, perfil_id, detalhes')
        .in('tipo', [...TIPOS_LOG_CADASTRO])
        .order('created_at', { ascending: false })
        .limit(200)

      const limite = getDataLimite(filtros.periodo)
      if (limite) query = query.gte('created_at', limite)
      if (filtros.perfil !== 'todos') query = query.eq('tipo', filtros.perfil)
      if (filtros.acao === 'aprov') query = query.ilike('acao', '%aprov%')
      else if (filtros.acao === 'reprov') query = query.ilike('acao', '%reprov%')
      else if (filtros.acao === 'exclusao') query = query.ilike('acao', '%exclus%')
      else if (filtros.acao === 'docs') query = query.ilike('acao', '%doc%')

      const { data, error } = await query
      if (error) throw error
      const rows = (data ?? []) as LogRow[]
      setLogs(rows)
      void carregarNomesPerfis(rows)
    } finally {
      setLoading(false)
    }
  }, [carregarNomesPerfis, filtros])

  useEffect(() => {
    void fetchLogs()
  }, [fetchLogs])

  const fecharDetalhe = () => {
    setDetalheId(null)
    setDetalheLog(null)
    setDetalhePerfil(null)
    setLeituras([])
    setDetalheErro(null)
  }

  const abrirDetalhe = async (logId: string) => {
    if (detalheId === logId) {
      fecharDetalhe()
      return
    }
    setDetalheId(logId)
    setDetalheCarregando(true)
    setDetalheErro(null)
    setDetalheLog(null)
    setDetalhePerfil(null)
    setLeituras([])

    try {
      await fetch(`/api/admin/cadastros-auditoria/${logId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'registrar_acesso' }),
      })

      const res = await fetch(`/api/admin/cadastros-auditoria/${logId}`)
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        log?: LogRow
        leituras?: LeituraRow[]
        perfil?: PerfilResumo | null
      }

      if (!res.ok || json.ok === false) {
        setDetalheErro(json.error ?? 'Não foi possível carregar o registro.')
        return
      }

      setDetalheLog(json.log ?? null)
      setDetalhePerfil(json.perfil ?? null)
      setLeituras(json.leituras ?? [])
    } catch {
      setDetalheErro('Erro de rede ao carregar o registro.')
    } finally {
      setDetalheCarregando(false)
    }
  }

  const exportarCsv = () => {
    if (!podeExportar || logs.length === 0) return
    const headers = ['Data', 'Admin', 'Ação', 'Perfil', 'Cadastro', 'Motivo']
    const rows = logs.map((log) => {
      const tipo = log.tipo ?? '—'
      const nome =
        log.tipo && log.perfil_id
          ? nomesPerfil[nomePerfilCacheKey(log.tipo, log.perfil_id)] ?? '—'
          : '—'
      return [
        formatarDataHora(log.created_at),
        log.admin_email ?? 'Sistema',
        statusFinalDoLog(log),
        LABEL_PERFIL[tipo as TipoLogCadastro] ?? tipo,
        nome,
        motivoDoLog(log) ?? '',
      ]
    })
    const csv = [headers, ...rows]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `auditoria_cadastros_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const logExpandido = useMemo(() => logs.find((l) => l.id === detalheId) ?? detalheLog, [detalheId, detalheLog, logs])

  return (
    <div className="space-y-4">
      <p className="rounded-xl border border-[#0097b2]/20 bg-[#0097b2]/5 px-4 py-3 text-sm text-gray-700">
        Histórico arquivado de aprovações, reprovações e solicitações de exclusão de cadastros. Ao abrir um
        registro, seu acesso fica registrado com usuário e data/hora.
      </p>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <label className="text-sm font-semibold text-gray-700">
            Período
            <select
              value={filtros.periodo}
              onChange={(e) => setFiltros({ ...filtros, periodo: e.target.value as Filtros['periodo'] })}
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm"
            >
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
              <option value="90d">Últimos 90 dias</option>
              <option value="todos">Todos</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-gray-700">
            Perfil
            <select
              value={filtros.perfil}
              onChange={(e) => setFiltros({ ...filtros, perfil: e.target.value as Filtros['perfil'] })}
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm"
            >
              <option value="todos">Todos</option>
              <option value="turistas">Turistas</option>
              <option value="profissionais">Profissionais</option>
              <option value="empresas">Empresas</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-gray-700">
            Ação
            <select
              value={filtros.acao}
              onChange={(e) => setFiltros({ ...filtros, acao: e.target.value as Filtros['acao'] })}
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm"
            >
              <option value="todas">Todas</option>
              <option value="aprov">Aprovações</option>
              <option value="reprov">Reprovações</option>
              <option value="exclusao">Exclusões solicitadas</option>
              <option value="docs">Documentos verificados</option>
            </select>
          </label>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">Carregando auditoria…</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            Nenhuma verificação arquivada no período selecionado.
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {logs.map((log) => {
              const expandido = detalheId === log.id
              const tipo = log.tipo as TipoLogCadastro | null
              const nomeCadastro =
                tipo && log.perfil_id ? nomesPerfil[nomePerfilCacheKey(tipo, log.perfil_id)] ?? '—' : '—'
              const status = statusFinalDoLog(log)

              return (
                <li key={log.id}>
                  <button
                    type="button"
                    onClick={() => void abrirDetalhe(log.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-gray-50"
                  >
                    <span className="text-lg" aria-hidden>
                      {getStatusIcon(log.acao)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="font-semibold text-gray-900">{status}</span>
                        {tipo ? (
                          <span className="text-xs font-medium uppercase text-[#0097b2]">
                            {LABEL_PERFIL[tipo]}
                          </span>
                        ) : null}
                        <span className="truncate text-sm text-gray-600">{nomeCadastro}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-gray-500">
                        {formatarDataHora(log.created_at)} · {log.admin_email ?? 'Sistema'}
                      </div>
                    </div>
                    <Eye className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                    {expandido ? (
                      <ChevronUp className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                    )}
                  </button>

                  {expandido ? (
                    <div className="border-t border-gray-100 bg-gray-50/80 px-4 py-4">
                      {detalheCarregando ? (
                        <p className="text-sm text-gray-500">Carregando análise arquivada…</p>
                      ) : detalheErro ? (
                        <p className="text-sm text-rose-700">{detalheErro}</p>
                      ) : logExpandido ? (
                        <div className="space-y-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-2 text-sm">
                              <p>
                                <span className="font-semibold text-gray-700">Verificado por:</span>{' '}
                                {logExpandido.admin_email ?? 'Sistema'}
                              </p>
                              <p>
                                <span className="font-semibold text-gray-700">Data/hora:</span>{' '}
                                {formatarDataHora(logExpandido.created_at)}
                              </p>
                              <p>
                                <span className="font-semibold text-gray-700">Resultado:</span>{' '}
                                {formatarStatusFinal(logExpandido.acao)}
                              </p>
                              {detalhePerfil ? (
                                <>
                                  <p>
                                    <span className="font-semibold text-gray-700">Cadastro:</span>{' '}
                                    {detalhePerfil.nome}{' '}
                                    <span className="text-gray-500">{detalhePerfil.username}</span>
                                  </p>
                                  {detalhePerfil.status ? (
                                    <p>
                                      <span className="font-semibold text-gray-700">Status atual:</span>{' '}
                                      {detalhePerfil.status}
                                    </p>
                                  ) : null}
                                </>
                              ) : null}
                              {motivoDoLog(logExpandido) ? (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                                  <p className="text-xs font-bold uppercase text-amber-800">Motivo registrado</p>
                                  <p className="mt-1 whitespace-pre-wrap text-amber-900">
                                    {motivoDoLog(logExpandido)}
                                  </p>
                                </div>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              onClick={fecharDetalhe}
                              className="rounded-full p-1.5 text-gray-500 hover:bg-gray-200"
                              aria-label="Fechar detalhe"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="rounded-xl border border-gray-200 bg-white p-3">
                            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                              Log de acesso (leitores)
                            </p>
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
                                    <span className="text-xs text-gray-500">
                                      {formatarDataHora(l.acessado_em)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {podeExportar ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={exportarCsv}
            disabled={logs.length === 0}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: COR_LOGO }}
          >
            Exportar CSV
          </button>
        </div>
      ) : null}
    </div>
  )
}
