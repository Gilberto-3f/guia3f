import type { SupabaseClient } from '@supabase/supabase-js'

export type EtapaFunilNotif = 'recomendacoes' | 'pax' | 'vendas'

export interface LeituraFunilEmpresa {
  recomendacoes_visto_em: string
  pax_visto_em: string
  vendas_visto_em: string
}

export interface ContagemNaoLidasFunil {
  total: number
  recomendacoes: number
  pax: number
  vendas: number
}

const EPOCH = '1970-01-01T00:00:00.000Z'

function isTabelaInexistente(err: unknown): boolean {
  const e = err as { code?: string; message?: string; status?: number }
  if (e?.code === 'PGRST205') return true
  const msg = String(e?.message ?? '').toLowerCase()
  return msg.includes('could not find the table') || e?.status === 404
}

async function contarApos(
  builder: PromiseLike<{ count: number | null; error: unknown }>,
): Promise<number> {
  const { count, error } = await builder
  if (error) {
    if (isTabelaInexistente(error)) return 0
    throw error
  }
  return count ?? 0
}

export async function obterLeituraFunilEmpresa(
  supabase: SupabaseClient,
  empresaId: string,
  usuarioId: string,
): Promise<LeituraFunilEmpresa> {
  const { data, error } = await supabase
    .from('dashboard_funil_leitura')
    .select('recomendacoes_visto_em, pax_visto_em, vendas_visto_em')
    .eq('empresa_id', empresaId)
    .eq('usuario_id', usuarioId)
    .maybeSingle()

  if (error && !isTabelaInexistente(error)) throw error
  if (!data) {
    return { recomendacoes_visto_em: EPOCH, pax_visto_em: EPOCH, vendas_visto_em: EPOCH }
  }

  const row = data as Record<string, unknown>
  return {
    recomendacoes_visto_em: row.recomendacoes_visto_em != null ? String(row.recomendacoes_visto_em) : EPOCH,
    pax_visto_em: row.pax_visto_em != null ? String(row.pax_visto_em) : EPOCH,
    vendas_visto_em: row.vendas_visto_em != null ? String(row.vendas_visto_em) : EPOCH,
  }
}

export async function contarNaoLidasFunilEmpresa(
  supabase: SupabaseClient,
  empresaId: string,
  usuarioId: string,
): Promise<ContagemNaoLidasFunil> {
  const vazio: ContagemNaoLidasFunil = { total: 0, recomendacoes: 0, pax: 0, vendas: 0 }
  try {
    const leitura = await obterLeituraFunilEmpresa(supabase, empresaId, usuarioId)

    const [recomendacoes, pax, vendas] = await Promise.all([
      Promise.all([
        contarApos(
          supabase
            .from('recomendacoes')
            .select('*', { count: 'exact', head: true })
            .eq('empresa_id', empresaId)
            .gt('created_at', leitura.recomendacoes_visto_em),
        ),
        contarApos(
          supabase
            .from('recomendacoes_produto')
            .select('*', { count: 'exact', head: true })
            .eq('empresa_id', empresaId)
            .gt('created_at', leitura.recomendacoes_visto_em),
        ),
        contarApos(
          supabase
            .from('recomendacoes_prato')
            .select('*', { count: 'exact', head: true })
            .eq('empresa_id', empresaId)
            .gt('created_at', leitura.recomendacoes_visto_em),
        ).catch(() => 0),
      ]).then(([pagina, produtos, pratos]) => pagina + produtos + pratos),
      contarApos(
        supabase
          .from('manifesto')
          .select('*', { count: 'exact', head: true })
          .eq('empresa_destino_id', empresaId)
          .eq('status', 'confirmado')
          .gt('created_at', leitura.pax_visto_em),
      ),
      contarApos(
        supabase
          .from('comissao')
          .select('*', { count: 'exact', head: true })
          .eq('empresa_id', empresaId)
          .eq('tipo', 'venda_direta')
          .gt('created_at', leitura.vendas_visto_em),
      ),
    ])

    return { recomendacoes, pax, vendas, total: recomendacoes + pax + vendas }
  } catch (err) {
    console.warn('[dashboardFunilBadge] contarNaoLidasFunilEmpresa:', err)
    return vazio
  }
}

export async function marcarEtapaFunilLida(
  supabase: SupabaseClient,
  empresaId: string,
  usuarioId: string,
  etapa: EtapaFunilNotif,
): Promise<void> {
  const agora = new Date().toISOString()
  const patch: Record<string, string> = {
    empresa_id: empresaId,
    usuario_id: usuarioId,
  }

  if (etapa === 'recomendacoes') patch.recomendacoes_visto_em = agora
  if (etapa === 'pax') patch.pax_visto_em = agora
  if (etapa === 'vendas') patch.vendas_visto_em = agora

  const { error } = await supabase.from('dashboard_funil_leitura').upsert(patch, {
    onConflict: 'empresa_id,usuario_id',
  })

  if (error && !isTabelaInexistente(error)) throw error
}

export function vistoEmEtapa(leitura: LeituraFunilEmpresa, etapa: EtapaFunilNotif): string {
  if (etapa === 'recomendacoes') return leitura.recomendacoes_visto_em
  if (etapa === 'pax') return leitura.pax_visto_em
  return leitura.vendas_visto_em
}
