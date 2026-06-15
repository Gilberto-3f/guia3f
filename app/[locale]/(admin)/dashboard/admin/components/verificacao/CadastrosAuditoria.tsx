'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSharedAdminGate } from '../../context/AdminPermissaoContext'
import { statusFinalDoLog, formatarStatusFinal } from '../../utils/registrarLogVerificacao'
import { TIPOS_LOG_CADASTRO, type TipoLogCadastro } from '@/lib/cadastroAuditoriaLeitura'
import { CardPendente, type CadastroPendente } from './CardPendente'
import { mapRowToCadastroPendente } from './mapCadastroPendente'
import { formatProfissionalCategorias } from './verificacaoFormatters'

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

const COR_LOGO = '#0097b2'
const COR_ARQUIVAR = '#00D443'

const LABEL_PERFIL_TITULO: Record<TipoLogCadastro, string> = {
  turistas: 'TURISTA',
  profissionais: 'PROFISSIONAL',
  empresas: 'EMPRESA',
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

function motivoDoLog(log: LogRow): string | null {
  const det = log.detalhes
  if (!det || typeof det !== 'object' || Array.isArray(det)) return null
  const m = (det as Record<string, unknown>).motivo
  return m != null && String(m).trim() ? String(m).trim() : null
}

function nomePerfilCacheKey(tipo: string, perfilId: string) {
  return `${tipo}:${perfilId}`
}

function statusAuditoriaUpper(log: LogRow): string {
  const acao = (log.acao ?? '').toLowerCase()
  const status = statusFinalDoLog(log).toLowerCase()
  if (acao.includes('exclus') || status.includes('exclus')) return 'EXCLUIDO'
  if (acao.includes('reprov') || status.includes('reprov')) return 'REPROVADO'
  if (acao.includes('aprov') || status.includes('aprov')) return 'APROVADO'
  return statusFinalDoLog(log).toUpperCase()
}

function tituloCardAuditoria(tipo: TipoLogCadastro, statusUpper: string): string {
  const perfil = LABEL_PERFIL_TITULO[tipo]
  const statusLabel =
    statusUpper === 'APROVADO'
      ? tipo === 'empresas'
        ? 'Aprovada'
        : 'Aprovado'
      : statusUpper === 'REPROVADO'
        ? tipo === 'empresas'
          ? 'Reprovada'
          : 'Reprovado'
        : statusUpper === 'EXCLUIDO'
          ? tipo === 'empresas'
            ? 'Excluída'
            : 'Excluído'
          : formatarStatusFinal(statusUpper)
  return `${perfil} ${statusLabel}`
}

async function carregarCadastroCompleto(
  tipo: TipoLogCadastro,
  perfilId: string,
): Promise<CadastroPendente | null> {
  const { data, error } = await supabase.from(tipo).select('*').eq('id', perfilId).maybeSingle()
  if (error || !data) return null

  const row = data as Record<string, unknown>
  const usuarioId = String(row.usuario_id ?? '')
  let email: string | null = null
  if (usuarioId) {
    const { data: usuario } = await supabase.from('usuarios').select('email').eq('id', usuarioId).maybeSingle()
    email = usuario?.email != null ? String(usuario.email).trim() : null
  }

  let preLiberacoes: Record<string, unknown>[] | undefined
  if (tipo === 'turistas' && usuarioId) {
    const { data: preRows } = await supabase
      .from('turista_pre_liberacoes')
      .select('*')
      .eq('turista_usuario_id', usuarioId)
      .order('solicitado_em', { ascending: false })
    preLiberacoes = (preRows ?? []) as Record<string, unknown>[]
  }

  return mapRowToCadastroPendente(tipo, row, email, preLiberacoes)
}

export function CadastrosAuditoria() {
  const gate = useSharedAdminGate()
  const admin = gate.status === 'ok' ? gate.admin : null
  const isAdminGeral = admin?.admin_level === 1
  const rawCargo = (admin?.admin_permissoes as unknown as { cargo?: string })?.cargo
  const podeExportar = Boolean(isAdminGeral || rawCargo === 'FINANCEIRO')

  const [logs, setLogs] = useState<LogRow[]>([])
  const [nomesPerfil, setNomesPerfil] = useState<Record<string, string>>({})
  const [categoriasPerfil, setCategoriasPerfil] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [filtros, setFiltros] = useState<Filtros>({ periodo: '30d', perfil: 'todos', acao: 'todas' })
  const [detalheId, setDetalheId] = useState<string | null>(null)
  const [detalheCarregando, setDetalheCarregando] = useState(false)
  const [detalheErro, setDetalheErro] = useState<string | null>(null)
  const [detalheLog, setDetalheLog] = useState<LogRow | null>(null)
  const [leituras, setLeituras] = useState<LeituraRow[]>([])
  const [cadastroCompleto, setCadastroCompleto] = useState<CadastroPendente | null>(null)
  const [resumoAberto, setResumoAberto] = useState(false)
  const [filtrosAbertos, setFiltrosAbertos] = useState(false)

  const carregarNomesPerfis = useCallback(async (rows: LogRow[]) => {
    const map: Record<string, string> = {}
    const catMap: Record<string, string> = {}
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

        if (tipo === 'profissionais') {
          const { data } = await supabase
            .from('profissionais')
            .select('id, nome_completo, nome_fantasia, nome_usuario, categorias')
            .in('id', unique)
          for (const row of data ?? []) {
            const id = String(row.id ?? '')
            const nome = String(row.nome_completo ?? row.nome_usuario ?? '').trim() || '—'
            map[nomePerfilCacheKey(tipo, id)] = nome
            const fmt = formatProfissionalCategorias(row.categorias)
            if (fmt !== '—') catMap[nomePerfilCacheKey(tipo, id)] = fmt
          }
          return
        }

        const { data } = await supabase
          .from(tipo)
          .select('id, nome_completo, nome_fantasia, nome_usuario')
          .in('id', unique)
        for (const row of data ?? []) {
          const id = String(row.id ?? '')
          const nome =
            tipo === 'empresas'
              ? String(row.nome_fantasia ?? row.nome_completo ?? row.nome_usuario ?? '').trim() || '—'
              : String(row.nome_completo ?? row.nome_usuario ?? '').trim() || '—'
          map[nomePerfilCacheKey(tipo, id)] = nome
        }
      }),
    )
    setNomesPerfil(map)
    setCategoriasPerfil(catMap)
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
    setLeituras([])
    setCadastroCompleto(null)
    setResumoAberto(false)
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
    setLeituras([])
    setCadastroCompleto(null)
    setResumoAberto(false)

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
      }

      if (!res.ok || json.ok === false) {
        setDetalheErro(json.error ?? 'Não foi possível carregar o registro.')
        return
      }

      const log = json.log ?? null
      setDetalheLog(log)
      setLeituras(json.leituras ?? [])

      if (log?.tipo && log.perfil_id && TIPOS_LOG_CADASTRO.includes(log.tipo as TipoLogCadastro)) {
        const cadastro = await carregarCadastroCompleto(log.tipo as TipoLogCadastro, log.perfil_id)
        setCadastroCompleto(cadastro)
      }
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
        LABEL_PERFIL_TITULO[tipo as TipoLogCadastro] ?? tipo,
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
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setFiltrosAbertos((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-gray-50"
          aria-expanded={filtrosAbertos}
        >
          <span className="text-sm font-bold uppercase tracking-wide text-gray-800">Filtros</span>
          {filtrosAbertos ? (
            <ChevronUp className="h-5 w-5 shrink-0 text-gray-500" aria-hidden />
          ) : (
            <ChevronDown className="h-5 w-5 shrink-0 text-gray-500" aria-hidden />
          )}
        </button>

        {filtrosAbertos ? (
          <div className="border-t border-gray-100 p-4">
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
        ) : null}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 shadow-sm">
          Carregando auditoria…
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 shadow-sm">
          Nenhuma verificação arquivada no período selecionado.
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => {
            const expandido = detalheId === log.id
            const tipo = log.tipo as TipoLogCadastro | null
            const nomeCadastro =
              tipo && log.perfil_id ? nomesPerfil[nomePerfilCacheKey(tipo, log.perfil_id)] ?? '—' : '—'
            const categoriaCadastro =
              tipo === 'profissionais' && log.perfil_id
                ? categoriasPerfil[nomePerfilCacheKey(tipo, log.perfil_id)]
                : undefined
            const statusUpper = statusAuditoriaUpper(log)
            const titulo = tipo ? tituloCardAuditoria(tipo, statusUpper) : statusFinalDoLog(log)

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
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-base font-bold uppercase tracking-wide" style={{ color: COR_LOGO }}>
                        {titulo}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm font-semibold text-gray-900">{nomeCadastro}</p>
                    {categoriaCadastro ? (
                      <p className="mt-0.5 text-xs font-bold uppercase tracking-wide" style={{ color: COR_ARQUIVAR }}>
                        {categoriaCadastro}
                      </p>
                    ) : null}
                    <p className="mt-0.5 text-xs text-gray-500">{formatarDataHora(log.created_at)}</p>
                  </div>
                  {expandido ? (
                    <ChevronUp className="h-5 w-5 shrink-0 text-gray-400" aria-hidden />
                  ) : (
                    <ChevronDown className="h-5 w-5 shrink-0 text-gray-400" aria-hidden />
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
                        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                          <button
                            type="button"
                            onClick={() => setResumoAberto((v) => !v)}
                            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50"
                            aria-expanded={resumoAberto}
                          >
                            <span className="text-sm font-bold uppercase tracking-wide text-gray-800">
                              Resumo do cadastro
                            </span>
                            {resumoAberto ? (
                              <ChevronUp className="h-5 w-5 shrink-0 text-gray-500" aria-hidden />
                            ) : (
                              <ChevronDown className="h-5 w-5 shrink-0 text-gray-500" aria-hidden />
                            )}
                          </button>

                          {resumoAberto ? (
                            <div className="border-t border-gray-100 p-3">
                              {cadastroCompleto && tipo ? (
                                <CardPendente
                                  item={cadastroCompleto}
                                  tipo={tipo}
                                  somenteLeitura
                                  ocultarTitulo
                                />
                              ) : (
                                <p className="py-4 text-center text-sm text-gray-500">
                                  Cadastro não encontrado ou indisponível.
                                </p>
                              )}
                            </div>
                          ) : null}
                        </div>

                        <div className="rounded-xl border border-gray-200 bg-white p-4">
                          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                            ADM que verificou
                          </p>
                          <div className="mt-2 space-y-1.5 text-sm text-gray-800">
                            <p>
                              <span className="font-semibold text-gray-700">Administrador:</span>{' '}
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
                            {motivoDoLog(logExpandido) ? (
                              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                                <p className="text-xs font-bold uppercase text-amber-800">Motivo registrado</p>
                                <p className="mt-1 whitespace-pre-wrap text-amber-900">
                                  {motivoDoLog(logExpandido)}
                                </p>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="rounded-xl border border-gray-200 bg-white p-4">
                          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                            Logs de Acesso
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
              </article>
            )
          })}
        </div>
      )}

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
