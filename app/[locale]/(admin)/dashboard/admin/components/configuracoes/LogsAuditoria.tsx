'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAdminGate } from '../../hooks/usePermissao'

type Filtros = {
  periodo: '7d' | '30d' | '90d' | 'todos'
  admin: string
  acao: string
}

type LogRow = {
  id: string
  created_at: string
  admin_email: string | null
  acao: string
  detalhes: unknown
}

function getDataLimite(periodo: Filtros['periodo']): string | null {
  if (periodo === 'todos') return null
  const days = periodo === '7d' ? 7 : periodo === '30d' ? 30 : 90
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

function formatarDataHora(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function escaparCsv(c: string) {
  return `"${c.replace(/"/g, '""')}"`
}

function getAcaoIcon(acao: string) {
  const a = acao.toLowerCase()
  if (a.includes('aprov')) return '✅'
  if (a.includes('reprov')) return '❌'
  if (a.includes('suspens')) return '⏸️'
  if (a.includes('ban')) return '⛔'
  if (a.includes('advert')) return '📝'
  return '📋'
}

export function LogsAuditoria() {
  const gate = useAdminGate()
  const admin = gate.status === 'ok' ? gate.admin : null
  const isAdminGeral = admin?.admin_level === 1
  const rawCargo = (admin?.admin_permissoes as unknown as { cargo?: string })?.cargo
  const isFinanceiro = rawCargo === 'FINANCEIRO'
  const podeExportar = Boolean(isAdminGeral || isFinanceiro)

  const [logs, setLogs] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filtros, setFiltros] = useState<Filtros>({ periodo: '7d', admin: 'todos', acao: 'todas' })
  const [admins, setAdmins] = useState<{ email: string | null }[]>([])
  const [exportando, setExportando] = useState(false)

  const fetchAdmins = useCallback(async () => {
    const { data } = await supabase.from('usuarios').select('email').eq('role', 'admin').order('email')
    setAdmins(data ?? [])
  }, [])

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase.from('logs_verificacao').select('*').order('created_at', { ascending: false }).limit(200)

      const limite = getDataLimite(filtros.periodo)
      if (limite) query = query.gte('created_at', limite)
      if (filtros.admin !== 'todos') query = query.eq('admin_email', filtros.admin)
      if (filtros.acao !== 'todas') query = query.ilike('acao', `%${filtros.acao}%`)

      const { data, error } = await query
      if (error) throw error
      setLogs((data ?? []) as LogRow[])
    } finally {
      setLoading(false)
    }
  }, [filtros])

  useEffect(() => {
    void fetchAdmins()
  }, [fetchAdmins])

  useEffect(() => {
    void fetchLogs()
  }, [fetchLogs])

  const proximaExclusao = useMemo(
    () => formatarDataHora(new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString()),
    []
  )

  const exportarLogs = async (formato: 'csv' | 'json') => {
    if (!podeExportar) return
    setExportando(true)
    try {
      const dados = logs.map((log) => ({
        Data: formatarDataHora(log.created_at),
        Admin: log.admin_email ?? 'Sistema',
        Ação: log.acao,
        Descrição: log.detalhes ? JSON.stringify(log.detalhes).slice(0, 200) : '-',
      }))
      if (formato === 'json') {
        const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `logs_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`
        a.click()
        URL.revokeObjectURL(url)
      } else {
        const headers = ['Data', 'Admin', 'Ação', 'Descrição']
        const rows = dados.map((d) => [d.Data, d.Admin, d.Ação, d.Descrição])
        const csv = [headers, ...rows].map((row) => row.map((cell) => escaparCsv(cell)).join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `logs_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`
        a.click()
        URL.revokeObjectURL(url)
      }
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="space-y-4">
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
            Admin
            <select
              value={filtros.admin}
              onChange={(e) => setFiltros({ ...filtros, admin: e.target.value })}
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm"
            >
              <option value="todos">Todos</option>
              {admins
                .filter((a): a is { email: string } => typeof a.email === 'string' && a.email.length > 0)
                .map((adm) => (
                  <option key={adm.email} value={adm.email}>
                    {adm.email}
                  </option>
                ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-gray-700">
            Ação
            <select
              value={filtros.acao}
              onChange={(e) => setFiltros({ ...filtros, acao: e.target.value })}
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm"
            >
              <option value="todas">Todas</option>
              <option value="aprov">Aprovações</option>
              <option value="reprov">Reprovações</option>
              <option value="suspens">Suspensões</option>
              <option value="ban">Banimentos</option>
              <option value="advert">Advertências</option>
            </select>
          </label>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">Carregando logs...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">Nenhum log encontrado</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Data/Hora</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Admin</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Ação</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Descrição</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-800">{formatarDataHora(log.created_at)}</td>
                    <td className="px-4 py-3 text-sm text-gray-800">{log.admin_email ?? 'Sistema'}</td>
                    <td className="px-4 py-3 text-sm text-gray-800">
                      <span className="inline-flex items-center gap-1">
                        {getAcaoIcon(log.acao)} {log.acao}
                      </span>
                    </td>
                    <td className="max-w-md truncate px-4 py-3 text-sm text-gray-600">
                      {log.detalhes ? JSON.stringify(log.detalhes).slice(0, 100) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-600">📋 Retenção: 6 meses</p>
          <p className="text-xs text-gray-500">Próxima exclusão (simulado): {proximaExclusao}</p>
        </div>
        {podeExportar ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => exportarLogs('csv')}
              disabled={exportando || logs.length === 0}
              className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-gray-800 ring-1 ring-gray-200 disabled:opacity-50"
            >
              CSV
            </button>
            <button
              type="button"
              onClick={() => exportarLogs('json')}
              disabled={exportando || logs.length === 0}
              className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-gray-800 ring-1 ring-gray-200 disabled:opacity-50"
            >
              JSON
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
