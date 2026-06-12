'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ContadoresExclusaoCadastro, ContadoresVerificacao } from '../types/admin.types'

const VAZIO: ContadoresVerificacao = { turistas: 0, profissionais: 0, empresas: 0 }

/** Contadores para badges da pasta Denúncias (vermelho = pendentes, preto = exclusão de conta). */
export function useDenunciasContadores(enabled = true) {
  const [contadoresPendentes, setContadoresPendentes] = useState<ContadoresVerificacao>(VAZIO)
  const [contadoresExclusao, setContadoresExclusao] = useState<ContadoresExclusaoCadastro>(VAZIO)

  const refetch = useCallback(async () => {
    if (!enabled) return
    try {
      const [t, p, e, exTur, exProf, exEmp] = await Promise.all([
        supabase
          .from('denuncias')
          .select('*', { count: 'exact', head: true })
          .eq('denunciado_tipo', 'turista')
          .eq('status', 'pendente'),
        supabase
          .from('denuncias')
          .select('*', { count: 'exact', head: true })
          .eq('denunciado_tipo', 'profissional')
          .eq('status', 'pendente'),
        supabase
          .from('denuncias')
          .select('*', { count: 'exact', head: true })
          .eq('denunciado_tipo', 'empresa')
          .eq('status', 'pendente'),
        supabase
          .from('denuncias')
          .select('*', { count: 'exact', head: true })
          .eq('denunciado_tipo', 'turista')
          .eq('medida_tipo', 'excluir_cadastro')
          .neq('status', 'arquivada'),
        supabase
          .from('denuncias')
          .select('*', { count: 'exact', head: true })
          .eq('denunciado_tipo', 'profissional')
          .eq('medida_tipo', 'excluir_cadastro')
          .neq('status', 'arquivada'),
        supabase
          .from('denuncias')
          .select('*', { count: 'exact', head: true })
          .eq('denunciado_tipo', 'empresa')
          .eq('medida_tipo', 'excluir_cadastro')
          .neq('status', 'arquivada'),
      ])

      setContadoresPendentes({
        turistas: t.count ?? 0,
        profissionais: p.count ?? 0,
        empresas: e.count ?? 0,
      })
      setContadoresExclusao({
        turistas: exTur.count ?? 0,
        profissionais: exProf.count ?? 0,
        empresas: exEmp.count ?? 0,
      })
    } catch {
      // mantém último valor
    }
  }, [enabled])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const totalPendentes =
    contadoresPendentes.turistas + contadoresPendentes.profissionais + contadoresPendentes.empresas
  const totalExclusoes =
    contadoresExclusao.turistas + contadoresExclusao.profissionais + contadoresExclusao.empresas

  return { contadoresPendentes, contadoresExclusao, totalPendentes, totalExclusoes, refetch }
}
