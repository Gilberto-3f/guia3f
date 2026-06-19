'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BadgeCheck, Building2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  buscarRecomendacoesPorEmpresaParaProfissional,
  getDataLimiteRecomendacoesProf,
  resolverProfissionalIdPorUsuario,
  type PeriodoRecomendacoesProf,
  type RecomendacaoEmpresaHistorico,
} from '@/lib/recomendacoesProfissionalHistorico'
import { buscarRecomendacoesProfissionaisParaProfissional } from '@/lib/recomendacoesProfParceriasHistorico'
import type { RecomendacaoProfissionalHistorico } from '@/lib/recomendacoesProfParceriasHistorico'
import LinhaEmpresaRecomendacao from './recomendacoes/LinhaEmpresaRecomendacao'
import LinhaProfissionalRecomendacao from './recomendacoes/LinhaProfissionalRecomendacao'

const PERIODOS: { id: PeriodoRecomendacoesProf; label: string }[] = [
  { id: 'mes', label: 'Este mês' },
  { id: '30d', label: '30 dias' },
  { id: '90d', label: '90 dias' },
]

type AbaRec = 'empresas' | 'parcerias'

type Props = {
  usuarioId: string | null
}

const abaCls = (ativo: boolean) =>
  `flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs transition-colors sm:text-sm ${
    ativo ? 'bg-[#0097b2] font-bold text-white' : 'bg-gray-100 font-normal text-gray-500 hover:bg-gray-200'
  }`

export default function RecomendacoesFeitas({ usuarioId }: Props) {
  const [aba, setAba] = useState<AbaRec>('empresas')
  const [periodo, setPeriodo] = useState<PeriodoRecomendacoesProf>('mes')
  const [empresas, setEmpresas] = useState<RecomendacaoEmpresaHistorico[]>([])
  const [parcerias, setParcerias] = useState<RecomendacaoProfissionalHistorico[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const dataLimite = useMemo(() => getDataLimiteRecomendacoesProf(periodo), [periodo])

  const carregar = useCallback(async () => {
    if (!usuarioId) {
      setEmpresas([])
      setParcerias([])
      setLoading(false)
      return
    }
    setLoading(true)
    setErro(null)
    try {
      const profissionalId = await resolverProfissionalIdPorUsuario(supabase, usuarioId)
      if (!profissionalId) {
        setEmpresas([])
        setParcerias([])
        return
      }
      const [listaEmp, listaPar] = await Promise.all([
        buscarRecomendacoesPorEmpresaParaProfissional(supabase, profissionalId, dataLimite),
        buscarRecomendacoesProfissionaisParaProfissional(supabase, profissionalId, periodo),
      ])
      setEmpresas(listaEmp)
      setParcerias(listaPar)
    } catch {
      setErro('Não foi possível carregar suas recomendações.')
      setEmpresas([])
      setParcerias([])
    } finally {
      setLoading(false)
    }
  }, [usuarioId, dataLimite, periodo])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const periodoCls = (ativo: boolean) =>
    `flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition-colors sm:text-sm ${
      ativo ? 'bg-[#00D443] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
    }`

  const totalEmp = empresas.reduce((acc, e) => acc + e.total, 0)
  const totalPar = parcerias.reduce((acc, p) => acc + p.total, 0)

  return (
    <div className="flex flex-col pb-4">
      <div className="flex gap-1 px-1" role="tablist" aria-label="Tipo de recomendação">
        <button type="button" role="tab" aria-selected={aba === 'empresas'} onClick={() => setAba('empresas')} className={abaCls(aba === 'empresas')}>
          <Building2 className={`h-4 w-4 ${aba === 'empresas' ? 'text-white' : 'text-gray-400'}`} aria-hidden />
          Empresas
        </button>
        <button type="button" role="tab" aria-selected={aba === 'parcerias'} onClick={() => setAba('parcerias')} className={abaCls(aba === 'parcerias')}>
          <BadgeCheck className={`h-4 w-4 ${aba === 'parcerias' ? 'text-white' : 'text-gray-400'}`} strokeWidth={aba === 'parcerias' ? 2.25 : 2} aria-hidden />
          Parcerias
        </button>
      </div>

      <div className="mt-3 flex gap-1 px-1" role="tablist" aria-label="Período do histórico">
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

      {!loading && !erro ? (
        <p className="mt-3 px-1 text-sm text-gray-600">
          {aba === 'empresas' ? (
            <>
              <span className="font-semibold text-[#001f3f]">{totalEmp}</span>
              {totalEmp === 1 ? ' recomendação' : ' recomendações'} em{' '}
              <span className="font-semibold text-[#001f3f]">{empresas.length}</span>{' '}
              {empresas.length === 1 ? 'empresa' : 'empresas'}
            </>
          ) : (
            <>
              <span className="font-semibold text-[#001f3f]">{totalPar}</span>
              {totalPar === 1 ? ' indicação' : ' indicações'} a{' '}
              <span className="font-semibold text-[#001f3f]">{parcerias.length}</span>{' '}
              {parcerias.length === 1 ? 'profissional' : 'profissionais'}
            </>
          )}
        </p>
      ) : null}

      <div className="mt-3 px-1">
        {loading ? (
          <p className="py-8 text-center text-sm text-gray-500">Carregando recomendações...</p>
        ) : erro ? (
          <p className="py-8 text-center text-sm text-rose-600">{erro}</p>
        ) : aba === 'empresas' ? (
          empresas.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-10 text-center text-sm text-gray-500">
              Nenhuma recomendação de empresa neste período.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              {empresas.map((emp) => (
                <LinhaEmpresaRecomendacao key={emp.empresa_id} empresa={emp} />
              ))}
            </div>
          )
        ) : parcerias.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-10 text-center text-sm text-gray-500">
            Nenhuma indicação de profissional neste período.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            {parcerias.map((p) => (
              <LinhaProfissionalRecomendacao key={p.profissional_id} profissional={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
