'use client'

import { useEffect, useMemo, useState } from 'react'
import { useInfracoes } from '@/app/(admin)/dashboard/admin/hooks/useInfracoes'

export default function HistoricoDecisoes() {
  const { historico, loading, error, fetchHistoricoUsuario, marcarHistoricoComoVisualizado } = useInfracoes()
  const [filtro, setFiltro] = useState<'todos' | 'ativo' | 'expirado'>('todos')

  useEffect(() => {
    void fetchHistoricoUsuario()
  }, [fetchHistoricoUsuario])

  const items = useMemo(() => {
    if (filtro === 'todos') return historico
    if (filtro === 'ativo') return historico.filter((h) => h.status === 'ativo')
    return historico.filter((h) => h.status !== 'ativo')
  }, [filtro, historico])

  if (loading) return <div className="p-4 text-center text-sm text-gray-500">Carregando histórico...</div>
  if (error) return <div className="p-4 text-center text-sm text-rose-600">Erro ao carregar histórico</div>

  return (
    <div className="mx-auto max-w-3xl p-4">
      <h1 className="text-xl font-bold text-[#001f3f]">Histórico de Decisões</h1>
      <p className="mt-1 text-sm text-gray-600">Advertências, suspensões, banimentos e alertas preventivos.</p>

      <div className="mt-4 flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        <button type="button" onClick={() => setFiltro('todos')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${filtro === 'todos' ? 'bg-[#e6f7fa] text-[#007d94]' : 'bg-gray-100 text-gray-600'}`}>
          Todos ({historico.length})
        </button>
        <button type="button" onClick={() => setFiltro('ativo')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${filtro === 'ativo' ? 'bg-[#e6f7fa] text-[#007d94]' : 'bg-gray-100 text-gray-600'}`}>
          Em vigor ({historico.filter((h) => h.status === 'ativo').length})
        </button>
        <button type="button" onClick={() => setFiltro('expirado')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${filtro === 'expirado' ? 'bg-[#e6f7fa] text-[#007d94]' : 'bg-gray-100 text-gray-600'}`}>
          Finalizados ({historico.filter((h) => h.status !== 'ativo').length})
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <div className="rounded-lg bg-gray-50 p-6 text-center text-sm text-gray-500">Nenhum registro encontrado.</div>
        ) : (
          items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (!item.visualizado) void marcarHistoricoComoVisualizado(item.id)
              }}
              className={`w-full rounded-lg border p-4 text-left hover:bg-gray-50 ${!item.visualizado ? 'border-l-4 border-l-[#0097b2]' : 'border-gray-200'}`}
            >
              <div className="flex items-center gap-2">
                <div className="text-sm font-bold text-[#001f3f]">{item.titulo}</div>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{item.status}</span>
              </div>
              <div className="mt-1 text-sm text-gray-600">{item.descricao}</div>
              <div className="mt-2 text-xs text-gray-500">
                Aplicado em {new Date(item.data_aplicacao).toLocaleDateString('pt-BR')}
                {item.data_expiracao ? ` · Expira em ${new Date(item.data_expiracao).toLocaleDateString('pt-BR')}` : ''}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
