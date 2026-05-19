'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useInfracoes } from '@/app/[locale]/(admin)/dashboard/admin/hooks/useInfracoes'
import { supabase } from '@/lib/supabase'

type Aba = 'denuncias' | 'decisoes'

type DenunciaUsuario = {
  id: string
  motivo: string
  descricao: string | null
  status: string
  created_at: string
}

type HistoricoDecisoesProps = {
  usuarioId: string | null
  empresaId: string | null
  denunciadoTipo: 'turista' | 'profissional' | 'empresa'
}

const STATUS_DENUNCIA: Record<string, string> = {
  pendente: 'Pendente',
  em_investigacao: 'Em investigação',
  encerrada: 'Encerrada',
  arquivada: 'Arquivada',
}

export default function HistoricoDecisoes({ usuarioId, empresaId, denunciadoTipo }: HistoricoDecisoesProps) {
  const { historico, loading, error, fetchHistoricoUsuario, marcarHistoricoComoVisualizado } = useInfracoes()
  const [aba, setAba] = useState<Aba>('denuncias')
  const [filtro, setFiltro] = useState<'todos' | 'ativo' | 'expirado'>('todos')
  const [denuncias, setDenuncias] = useState<DenunciaUsuario[]>([])
  const [loadingDenuncias, setLoadingDenuncias] = useState(false)
  const [erroDenuncias, setErroDenuncias] = useState<string | null>(null)

  useEffect(() => {
    void fetchHistoricoUsuario()
  }, [fetchHistoricoUsuario])

  const resolverDenunciadoId = useCallback(async (): Promise<string | null> => {
    if (denunciadoTipo === 'empresa') return empresaId
    if (!usuarioId) return null
    if (denunciadoTipo === 'turista') {
      const { data } = await supabase.from('turistas').select('id').eq('usuario_id', usuarioId).maybeSingle()
      return data?.id != null ? String(data.id) : null
    }
    if (denunciadoTipo === 'profissional') {
      const { data } = await supabase.from('profissionais').select('id').eq('usuario_id', usuarioId).maybeSingle()
      return data?.id != null ? String(data.id) : null
    }
    return null
  }, [denunciadoTipo, empresaId, usuarioId])

  const carregarDenuncias = useCallback(async () => {
    const denunciadoId = await resolverDenunciadoId()
    if (!denunciadoId) {
      setDenuncias([])
      return
    }
    setLoadingDenuncias(true)
    setErroDenuncias(null)
    try {
      const { data, error: e } = await supabase
        .from('denuncias')
        .select('id, motivo, descricao, status, created_at')
        .eq('denunciado_id', denunciadoId)
        .eq('denunciado_tipo', denunciadoTipo)
        .order('created_at', { ascending: false })
        .limit(100)
      if (e) throw e
      setDenuncias((data ?? []) as DenunciaUsuario[])
    } catch {
      setDenuncias([])
      setErroDenuncias('Não foi possível carregar as denúncias.')
    } finally {
      setLoadingDenuncias(false)
    }
  }, [denunciadoTipo, resolverDenunciadoId])

  useEffect(() => {
    if (aba === 'denuncias') void carregarDenuncias()
  }, [aba, carregarDenuncias])

  const items = useMemo(() => {
    if (filtro === 'todos') return historico
    if (filtro === 'ativo') return historico.filter((h) => h.status === 'ativo')
    return historico.filter((h) => h.status !== 'ativo')
  }, [filtro, historico])

  if (loading && aba === 'decisoes') {
    return <div className="p-4 text-center text-sm text-gray-500">Carregando...</div>
  }
  if (error && aba === 'decisoes') {
    return <div className="p-4 text-center text-sm text-rose-600">Erro ao carregar decisões</div>
  }

  return (
    <div className="mx-auto max-w-3xl p-4">
      <h1 className="text-xl font-bold text-[#001f3f]">Denúncias e Decisões</h1>
      <p className="mt-1 text-sm text-gray-600">Denúncias recebidas e penalidades aplicadas à sua conta.</p>

      <div className="mt-4 flex gap-1 border-b border-gray-200" role="tablist" aria-label="Denúncias e decisões">
        <button
          type="button"
          role="tab"
          aria-selected={aba === 'denuncias'}
          onClick={() => setAba('denuncias')}
          className={`px-4 py-2 text-sm font-semibold transition ${
            aba === 'denuncias' ? 'border-b-2 border-[#0097b2] text-[#007d94]' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Denúncias
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={aba === 'decisoes'}
          onClick={() => setAba('decisoes')}
          className={`px-4 py-2 text-sm font-semibold transition ${
            aba === 'decisoes' ? 'border-b-2 border-[#0097b2] text-[#007d94]' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Decisões
        </button>
      </div>

      {aba === 'denuncias' ? (
        <div className="mt-4 space-y-3">
          {loadingDenuncias ? (
            <p className="text-center text-sm text-gray-500">Carregando denúncias...</p>
          ) : erroDenuncias ? (
            <p className="text-center text-sm text-rose-600">{erroDenuncias}</p>
          ) : denuncias.length === 0 ? (
            <div className="rounded-lg bg-gray-50 p-6 text-center text-sm text-gray-500">Nenhuma denúncia registrada.</div>
          ) : (
            denuncias.map((item) => (
              <div key={item.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-bold text-[#001f3f]">{item.motivo}</div>
                  <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    {STATUS_DENUNCIA[item.status] ?? item.status}
                  </span>
                </div>
                {item.descricao ? <p className="mt-1 text-sm text-gray-600">{item.descricao}</p> : null}
                <p className="mt-2 text-xs text-gray-500">
                  Recebida em {new Date(item.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
            ))
          )}
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2 border-b border-gray-200 pb-2">
            <button
              type="button"
              onClick={() => setFiltro('todos')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${filtro === 'todos' ? 'bg-[#e6f7fa] text-[#007d94]' : 'bg-gray-100 text-gray-600'}`}
            >
              Todos ({historico.length})
            </button>
            <button
              type="button"
              onClick={() => setFiltro('ativo')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${filtro === 'ativo' ? 'bg-[#e6f7fa] text-[#007d94]' : 'bg-gray-100 text-gray-600'}`}
            >
              Em vigor ({historico.filter((h) => h.status === 'ativo').length})
            </button>
            <button
              type="button"
              onClick={() => setFiltro('expirado')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${filtro === 'expirado' ? 'bg-[#e6f7fa] text-[#007d94]' : 'bg-gray-100 text-gray-600'}`}
            >
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
        </>
      )}
    </div>
  )
}
