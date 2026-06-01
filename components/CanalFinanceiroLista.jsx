'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import CanalFinanceiroItem from '@/components/CanalFinanceiroItem'
import CanalFinanceiroConversa from '@/components/CanalFinanceiroConversa'

/**
 * @param {{ usuarioId: string, tipo: 'profissional' | 'empresa' }} props
 */
export default function CanalFinanceiroLista({ usuarioId, tipo }) {
  const [itens, setItens] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const carregar = async () => {
      if (!usuarioId) return
      setLoading(true)
      try {
        let profissionalId = /** @type {string | null} */ (null)
        let empresaId = /** @type {string | null} */ (null)

        if (tipo === 'profissional') {
          const { data: p } = await supabase.from('profissionais').select('id').eq('usuario_id', usuarioId).maybeSingle()
          profissionalId = p?.id != null ? String(p.id) : null
        } else {
          const { data: e } = await supabase.from('empresas').select('id').eq('usuario_id', usuarioId).maybeSingle()
          empresaId = e?.id != null ? String(e.id) : null
        }

        let query = supabase
          .from('canal_financeiro')
          .select(
            `
            id,
            tipo,
            titulo,
            mensagem,
            valor,
            anexo_url,
            lida_por_profissional,
            lida_por_empresa,
            created_at,
            profissional_id,
            empresa_id,
            profissionais (nome_completo),
            empresas (nome_fantasia)
          `
          )
          .order('created_at', { ascending: false })

        if (tipo === 'profissional' && profissionalId) {
          query = query.eq('profissional_id', profissionalId)
        } else if (tipo === 'empresa' && empresaId) {
          query = query.eq('empresa_id', empresaId)
        }

        const { data, error } = await query

        if (error) throw error

        const formatados =
          data?.map((row) => {
            const r = /** @type {Record<string, unknown>} */ (row)
            const prof = r.profissionais
            const emp = r.empresas
            const pn =
              prof && typeof prof === 'object' && prof !== null && 'nome_completo' in prof
                ? String(/** @type {{ nome_completo?: string }} */ (prof).nome_completo ?? 'Profissional')
                : 'Profissional'
            const en =
              emp && typeof emp === 'object' && emp !== null && 'nome_fantasia' in emp
                ? String(/** @type {{ nome_fantasia?: string }} */ (emp).nome_fantasia ?? 'Empresa')
                : 'Empresa'

            return {
              id: String(r.id),
              tipo: String(r.tipo ?? ''),
              titulo: String(r.titulo ?? ''),
              mensagem: r.mensagem != null ? String(r.mensagem) : null,
              valor: r.valor != null ? Number(r.valor) : null,
              anexo_url: r.anexo_url != null ? String(r.anexo_url) : null,
              lida_por_profissional: Boolean(r.lida_por_profissional),
              lida_por_empresa: Boolean(r.lida_por_empresa),
              created_at: String(r.created_at ?? ''),
              profissional_nome: pn,
              empresa_nome: en,
            }
          }) ?? []

        setItens(formatados)
      } catch (e) {
        console.error('Erro ao carregar canal financeiro:', e)
      } finally {
        setLoading(false)
      }
    }

    void carregar()
  }, [usuarioId, tipo])

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="animate-pulse text-gray-400">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="canal-financeiro-ui flex min-h-0 flex-1 flex-col text-gray-900">
      <CanalFinanceiroConversa usuarioId={usuarioId} />
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
      {itens.length === 0 ? (
        <div className="py-8 text-center text-gray-400">Nenhuma movimentação financeira ainda</div>
      ) : (
        itens.map((item) => <CanalFinanceiroItem key={item.id} item={item} userTipo={tipo} />)
      )}
      </div>
    </div>
  )
}
