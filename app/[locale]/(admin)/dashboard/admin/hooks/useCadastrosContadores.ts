'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { usePermissao } from './usePermissao'
import { normalizarPaisProfissional } from '@/lib/adminConvites'
import type { ContadoresExclusaoCadastro, ContadoresVerificacao } from '../types/admin.types'

const VAZIO: ContadoresVerificacao = { turistas: 0, profissionais: 0, empresas: 0 }

function parseCategorias(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((c) => String(c).toLowerCase())
  return []
}

/** Contadores leves para badges da pasta Cadastros (painel principal). */
export function useCadastrosContadores(enabled = true) {
  const { admin, getComunidade, getPais } = usePermissao()
  const [contadores, setContadores] = useState<ContadoresVerificacao>(VAZIO)
  const [contadoresExclusao, setContadoresExclusao] = useState<ContadoresExclusaoCadastro>(VAZIO)

  const refetch = useCallback(async () => {
    if (!enabled) return
    try {
      const isModerador = admin?.admin_level === 2
      const comunidade = isModerador ? String(getComunidade() ?? '').toLowerCase() : ''
      const paisMod = isModerador ? String(getPais() ?? '').toUpperCase() : ''

      const [t, profRows, empRows, ex] = await Promise.all([
        isModerador
          ? Promise.resolve({ count: 0, error: null })
          : supabase.from('turistas').select('*', { count: 'exact', head: true }).eq('docs_verificado', false),
        supabase
          .from('profissionais')
          .select('categorias, pais, status, documentos_enviados_em')
          .eq('status', 'aguardando_analise')
          .not('documentos_enviados_em', 'is', null),
        isModerador && comunidade !== 'anfitrioes'
          ? Promise.resolve({ data: [], error: null })
          : supabase
              .from('empresas')
              .select('id, docs_verificado, status, documentos_enviados_em, documento_comercial_url, somente_modo_apresentacao')
              .eq('docs_verificado', false)
              .neq('status', 'aprovado'),
        supabase.from('solicitacoes_exclusao_cadastro').select('tipo').eq('status', 'pendente'),
      ])

      let profCount = 0
      if (!profRows.error && Array.isArray(profRows.data)) {
        for (const row of profRows.data) {
          const cats = parseCategorias((row as { categorias?: unknown }).categorias)
          if (comunidade && !cats.includes(comunidade)) continue
          if (paisMod) {
            const p = normalizarPaisProfissional((row as { pais?: string }).pais)
            if (p && p !== paisMod) continue
          }
          profCount += 1
        }
      }

      let empCount = 0
      if (!empRows.error && Array.isArray(empRows.data)) {
        for (const row of empRows.data) {
          const r = row as Record<string, unknown>
          if (Boolean(r.somente_modo_apresentacao)) continue
          const temDoc =
            r.documentos_enviados_em != null ||
            (r.documento_comercial_url != null && String(r.documento_comercial_url).trim() !== '')
          if (!temDoc) continue
          empCount += 1
        }
      }

      setContadores({
        turistas: isModerador ? 0 : (t.count ?? 0),
        profissionais: profCount,
        empresas: empCount,
      })

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
  }, [enabled, admin?.admin_level, admin?.id, getComunidade, getPais])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const totalVerificacoes = contadores.turistas + contadores.profissionais + contadores.empresas
  const totalExclusoes =
    contadoresExclusao.turistas + contadoresExclusao.profissionais + contadoresExclusao.empresas

  return { contadores, contadoresExclusao, totalVerificacoes, totalExclusoes, refetch }
}
