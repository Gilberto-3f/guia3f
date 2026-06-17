'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  buscarRecomendacoesPorEmpresaParaProfissional,
  getDataLimiteRecomendacoesProf,
  resolverProfissionalIdPorUsuario,
  type PeriodoRecomendacoesProf,
  type RecomendacaoEmpresaHistorico,
} from '@/lib/recomendacoesProfissionalHistorico'
import LinhaEmpresaRecomendacao from './recomendacoes/LinhaEmpresaRecomendacao'

const PERIODOS: { id: PeriodoRecomendacoesProf; label: string }[] = [
  { id: 'mes', label: 'Este mês' },
  { id: '30d', label: '30 dias' },
  { id: '90d', label: '90 dias' },
]

type Props = {
  usuarioId: string | null
}

export default function RecomendacoesFeitas({ usuarioId }: Props) {
  const [periodo, setPeriodo] = useState<PeriodoRecomendacoesProf>('mes')
  const [empresas, setEmpresas] = useState<RecomendacaoEmpresaHistorico[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const dataLimite = useMemo(() => getDataLimiteRecomendacoesProf(periodo), [periodo])

  const totalRecomendacoes = useMemo(
    () => empresas.reduce((acc, e) => acc + e.total, 0),
    [empresas],
  )

  const carregar = useCallback(async () => {
    if (!usuarioId) {
      setEmpresas([])
      setLoading(false)
      return
    }
    setLoading(true)
    setErro(null)
    try {
      const profissionalId = await resolverProfissionalIdPorUsuario(supabase, usuarioId)
      if (!profissionalId) {
        setEmpresas([])
        return
      }
      const lista = await buscarRecomendacoesPorEmpresaParaProfissional(
        supabase,
        profissionalId,
        dataLimite,
      )
      setEmpresas(lista)
    } catch {
      setErro('Não foi possível carregar suas recomendações.')
      setEmpresas([])
    } finally {
      setLoading(false)
    }
  }, [usuarioId, dataLimite])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const periodoCls = (ativo: boolean) =>
    `flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition-colors sm:text-sm ${
      ativo ? 'bg-[#00D443] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
    }`

  return (
    <div className="flex flex-col pb-4">
      <div className="flex gap-1 px-1" role="tablist" aria-label="Período do histórico">
        {PERIODOS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={periodo === p.id}
            onClick={() => setPeriodo(p.id)}
            className={periodoCls(periodo === p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {!loading && !erro && empresas.length > 0 ? (
        <p className="mt-3 px-1 text-sm text-gray-600">
          <span className="font-semibold text-[#001f3f]">{totalRecomendacoes}</span>
          {totalRecomendacoes === 1 ? ' recomendação' : ' recomendações'} em{' '}
          <span className="font-semibold text-[#001f3f]">{empresas.length}</span>{' '}
          {empresas.length === 1 ? 'empresa' : 'empresas'}
        </p>
      ) : null}

      <div className="mt-3 px-1">
        {loading ? (
          <p className="py-8 text-center text-sm text-gray-500">Carregando recomendações...</p>
        ) : erro ? (
          <p className="py-8 text-center text-sm text-rose-600">{erro}</p>
        ) : empresas.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-10 text-center text-sm text-gray-500">
            Nenhuma recomendação registrada neste período.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            {empresas.map((emp) => (
              <LinhaEmpresaRecomendacao key={emp.empresa_id} empresa={emp} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
