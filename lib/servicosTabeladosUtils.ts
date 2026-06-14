import type { SupabaseClient } from '@supabase/supabase-js'
import type { CategoriaTabeladoId } from '@/lib/servicosTabeladosCatalogo'

/**
 * Valor de referência de uma rota tabelada (comissões / mobilidade futura).
 */
export async function buscarValorRotaTabelada(
  supabase: SupabaseClient,
  params: {
    categoria: CategoriaTabeladoId
    cidadeOrigem: string
    destinoFinal: string
  },
): Promise<number | null> {
  const destino = params.destinoFinal.trim()
  if (!destino) return null

  const { data } = await supabase
    .from('servicos_tabelados_rotas')
    .select('valor_rota')
    .eq('ativo', true)
    .eq('categoria', params.categoria)
    .eq('cidade_origem', params.cidadeOrigem)
    .ilike('destino_final', destino)
    .maybeSingle()

  if (!data?.valor_rota) return null
  const n = Number(data.valor_rota)
  return Number.isFinite(n) ? n : null
}
