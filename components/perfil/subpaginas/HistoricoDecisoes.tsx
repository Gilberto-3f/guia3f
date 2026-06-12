'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Flag, Scale } from 'lucide-react'
import { useInfracoes } from '@/app/[locale]/(admin)/dashboard/admin/hooks/useInfracoes'
import { supabase } from '@/lib/supabase'

type Aba = 'denuncias' | 'decisoes'

type DenunciaEnviada = {
  id: string
  motivo: string
  descricao: string | null
  status: string
  created_at: string
  analisado_em: string | null
  conteudo_tipo: string | null
  medida_tipo: string | null
  penalidade_aplicada: string | null
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

const LABEL_CONTEUDO: Record<string, string> = {
  post: 'Publicação',
  comentario: 'Comentário',
  story: 'Story',
  avaliacao: 'Avaliação',
}

export default function HistoricoDecisoes({ usuarioId }: HistoricoDecisoesProps) {
  const { historico, loading, error, fetchHistoricoUsuario, marcarHistoricoComoVisualizado } = useInfracoes()
  const [aba, setAba] = useState<Aba>('denuncias')
  const [denuncias, setDenuncias] = useState<DenunciaEnviada[]>([])
  const [loadingDenuncias, setLoadingDenuncias] = useState(false)
  const [erroDenuncias, setErroDenuncias] = useState<string | null>(null)

  useEffect(() => {
    void fetchHistoricoUsuario()
  }, [fetchHistoricoUsuario])

  const carregarDenunciasEnviadas = useCallback(async () => {
    if (!usuarioId) {
      setDenuncias([])
      return
    }
    setLoadingDenuncias(true)
    setErroDenuncias(null)
    try {
      const { data, error: e } = await supabase
        .from('denuncias')
        .select(
          'id, motivo, descricao, status, created_at, analisado_em, conteudo_tipo, medida_tipo, penalidade_aplicada',
        )
        .eq('denunciante_id', usuarioId)
        .order('created_at', { ascending: false })
        .limit(100)
      if (e) throw e
      setDenuncias((data ?? []) as DenunciaEnviada[])
    } catch {
      setDenuncias([])
      setErroDenuncias('Não foi possível carregar suas denúncias.')
    } finally {
      setLoadingDenuncias(false)
    }
  }, [usuarioId])

  useEffect(() => {
    if (aba === 'denuncias') void carregarDenunciasEnviadas()
  }, [aba, carregarDenunciasEnviadas])

  const items = useMemo(() => {
    return [...historico].sort((a, b) => {
      const da = a.data_conclusao ?? a.data_aplicacao
      const db = b.data_conclusao ?? b.data_aplicacao
      return new Date(db).getTime() - new Date(da).getTime()
    })
  }, [historico])

  if (loading && aba === 'decisoes') {
    return <div className="p-4 text-center text-sm text-gray-500">Carregando...</div>
  }
  if (error && aba === 'decisoes') {
    return <div className="p-4 text-center text-sm text-rose-600">Erro ao carregar decisões</div>
  }

  return (
    <div className="mx-auto max-w-3xl p-4">
      <h1 className="text-xl font-bold text-[#001f3f]">Denúncias e Decisões</h1>

      <div className="mt-5 flex gap-2 px-1" role="tablist" aria-label="Denúncias e decisões">
        <button
          type="button"
          role="tab"
          aria-selected={aba === 'denuncias'}
          onClick={() => setAba('denuncias')}
          className={[
            'flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold uppercase tracking-wide transition',
            aba === 'denuncias'
              ? 'bg-[#0097b2] text-white shadow-sm'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
          ].join(' ')}
        >
          <Flag className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
          Denúncias
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={aba === 'decisoes'}
          onClick={() => setAba('decisoes')}
          className={[
            'flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold uppercase tracking-wide transition',
            aba === 'decisoes'
              ? 'bg-[#0097b2] text-white shadow-sm'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
          ].join(' ')}
        >
          <Scale className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
          Decisões
        </button>
      </div>

      {aba === 'denuncias' ? (
        <div className="mt-5 space-y-3">
          {loadingDenuncias ? (
            <p className="text-center text-sm text-gray-500">Carregando denúncias...</p>
          ) : erroDenuncias ? (
            <p className="text-center text-sm text-rose-600">{erroDenuncias}</p>
          ) : denuncias.length === 0 ? (
            <div className="rounded-lg bg-gray-50 p-6 text-center text-sm text-gray-500">
              Você ainda não enviou denúncias.
            </div>
          ) : (
            denuncias.map((item) => {
              const tipoConteudo = item.conteudo_tipo ? LABEL_CONTEUDO[item.conteudo_tipo] : null
              return (
                <div key={item.id} className="rounded-lg border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold text-[#001f3f]">{item.motivo}</div>
                      {tipoConteudo ? (
                        <p className="mt-0.5 text-xs font-medium uppercase text-[#0097b2]">{tipoConteudo}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      {STATUS_DENUNCIA[item.status] ?? item.status}
                    </span>
                  </div>
                  {item.descricao ? <p className="mt-1 text-sm text-gray-600">{item.descricao}</p> : null}
                  <p className="mt-2 text-xs text-gray-500">
                    Enviada em {new Date(item.created_at).toLocaleDateString('pt-BR')}
                    {item.analisado_em
                      ? ` · Atualizada em ${new Date(item.analisado_em).toLocaleDateString('pt-BR')}`
                      : ''}
                  </p>
                </div>
              )
            })
          )}
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {items.length === 0 ? (
            <div className="rounded-lg bg-gray-50 p-6 text-center text-sm text-gray-500">Nenhum registro encontrado.</div>
          ) : (
            items.map((item) => {
              const dataConclusao = item.data_conclusao ?? item.data_aplicacao
              return (
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
                    Concluída em {new Date(dataConclusao).toLocaleDateString('pt-BR')}
                    {item.data_expiracao && item.status === 'ativo'
                      ? ` · Expira em ${new Date(item.data_expiracao).toLocaleDateString('pt-BR')}`
                      : ''}
                  </div>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
