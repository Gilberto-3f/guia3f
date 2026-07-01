'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { usePermissao } from './usePermissao'
import type { ContadoresExclusaoCadastro, ContadoresVerificacao } from '../types/admin.types'

const VAZIO: ContadoresVerificacao = { turistas: 0, profissionais: 0, empresas: 0 }

/** Contadores para badges da pasta Denúncias (vermelho = pendentes, preto = exclusão de conta). */
export function useDenunciasContadores(enabled = true) {
  const { admin, getComunidade, nivel } = usePermissao()
  const [contadoresPendentes, setContadoresPendentes] = useState<ContadoresVerificacao>(VAZIO)
  const [contadoresExclusao, setContadoresExclusao] = useState<ContadoresExclusaoCadastro>(VAZIO)

  const refetch = useCallback(async () => {
    if (!enabled) return
    try {
      const nivelNum = Number(admin?.admin_level ?? nivel ?? 0)
      const comunidade = String(getComunidade() ?? '').toLowerCase()

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

      let pendentes: ContadoresVerificacao = {
        turistas: t.count ?? 0,
        profissionais: p.count ?? 0,
        empresas: e.count ?? 0,
      }
      let exclusoes: ContadoresExclusaoCadastro = {
        turistas: exTur.count ?? 0,
        profissionais: exProf.count ?? 0,
        empresas: exEmp.count ?? 0,
      }

      if (nivelNum === 2) {
        exclusoes.empresas = 0
        pendentes.empresas = 0
      }
      if (nivelNum === 4) {
        pendentes.profissionais = 0
        pendentes.empresas = 0
        exclusoes.profissionais = 0
        exclusoes.empresas = 0
      }

      if (nivelNum === 2 && comunidade) {
        const { data: profs } = await supabase.from('profissionais').select('id, categorias')
        const allowed = new Set(
          (profs ?? [])
            .filter(
              (pRow: { categorias?: unknown[] }) =>
                Array.isArray(pRow.categorias) &&
                pRow.categorias.map((c) => String(c).toLowerCase()).includes(comunidade),
            )
            .map((pRow: { id: string }) => pRow.id),
        )
        const [{ data: dsPend }, { data: dsEx }] = await Promise.all([
          supabase
            .from('denuncias')
            .select('denunciado_id')
            .eq('denunciado_tipo', 'profissional')
            .eq('status', 'pendente'),
          supabase
            .from('denuncias')
            .select('denunciado_id')
            .eq('denunciado_tipo', 'profissional')
            .eq('medida_tipo', 'excluir_cadastro')
            .neq('status', 'arquivada'),
        ])
        pendentes = {
          ...pendentes,
          turistas: 0,
          empresas: comunidade === 'anfitrioes' ? pendentes.empresas : 0,
          profissionais: (dsPend ?? []).filter((d: { denunciado_id: string }) =>
            allowed.has(d.denunciado_id),
          ).length,
        }
        exclusoes = {
          ...exclusoes,
          turistas: 0,
          empresas: comunidade === 'anfitrioes' ? exclusoes.empresas : 0,
          profissionais: (dsEx ?? []).filter((d: { denunciado_id: string }) =>
            allowed.has(d.denunciado_id),
          ).length,
        }
      }

      setContadoresPendentes(pendentes)
      setContadoresExclusao(exclusoes)
    } catch {
      // mantém último valor
    }
  }, [enabled, admin?.admin_level, admin?.id, getComunidade, nivel])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const totalPendentes =
    contadoresPendentes.turistas + contadoresPendentes.profissionais + contadoresPendentes.empresas
  const totalExclusoes =
    contadoresExclusao.turistas + contadoresExclusao.profissionais + contadoresExclusao.empresas

  return { contadoresPendentes, contadoresExclusao, totalPendentes, totalExclusoes, refetch }
}
