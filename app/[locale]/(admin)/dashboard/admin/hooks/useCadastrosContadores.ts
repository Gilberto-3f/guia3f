'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ContadoresExclusaoCadastro, ContadoresVerificacao } from '../types/admin.types'

const VAZIO: ContadoresVerificacao = { turistas: 0, profissionais: 0, empresas: 0 }

/** Contadores leves para badges da pasta Cadastros (painel principal). */
export function useCadastrosContadores(enabled = true) {
  const [contadores, setContadores] = useState<ContadoresVerificacao>(VAZIO)
  const [contadoresExclusao, setContadoresExclusao] = useState<ContadoresExclusaoCadastro>(VAZIO)

  const refetch = useCallback(async () => {
    if (!enabled) return
    try {
      const [t, p, e, ex] = await Promise.all([
        supabase.from('turistas').select('*', { count: 'exact', head: true }).eq('docs_verificado', false),
        supabase
          .from('profissionais')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'aguardando_analise')
          .not('documentos_enviados_em', 'is', null),
        supabase
          .from('empresas')
          .select('*', { count: 'exact', head: true })
          .eq('docs_verificado', false)
          .neq('status', 'aprovado')
          .or('documentos_enviados_em.not.is.null,documento_comercial_url.not.is.null'),
        supabase.from('solicitacoes_exclusao_cadastro').select('tipo').eq('status', 'pendente'),
      ])

      if (!t.error && !p.error && !e.error) {
        setContadores({
          turistas: t.count ?? 0,
          profissionais: p.count ?? 0,
          empresas: e.count ?? 0,
        })
      }

      if (!ex.error && Array.isArray(ex.data)) {
        const counts: ContadoresExclusaoCadastro = { turistas: 0, profissionais: 0, empresas: 0 }
        for (const row of ex.data) {
          const tipo = String((row as { tipo?: string }).tipo ?? '') as keyof ContadoresExclusaoCadastro
          if (tipo in counts) counts[tipo] += 1
        }
        setContadoresExclusao(counts)
      }
    } catch {
      // mantém último valor
    }
  }, [enabled])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const totalVerificacoes = contadores.turistas + contadores.profissionais + contadores.empresas
  const totalExclusoes =
    contadoresExclusao.turistas + contadoresExclusao.profissionais + contadoresExclusao.empresas

  return { contadores, contadoresExclusao, totalVerificacoes, totalExclusoes, refetch }
}
