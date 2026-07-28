import type { SupabaseClient } from '@supabase/supabase-js'
import { itemCanalFinanceiroEhAvisoManifesto } from '@/lib/recomendacaoContratacaoDestino'

/**
 * Persiste leitura no canal financeiro do profissional (service role — evita falha silenciosa de RLS no cliente).
 * Não marca pré-liberação pendente (continua exigindo resposta).
 */
export async function persistirLeituraCanalFinanceiroProfissional(
  admin: SupabaseClient,
  profissionalId: string,
  itemId?: string,
  opts?: { marcarManifestoLegado?: boolean },
): Promise<boolean> {
  if (!profissionalId) return false

  if (itemId) {
    const { error } = await admin
      .from('canal_financeiro')
      .update({ lida_por_profissional: true })
      .eq('id', itemId)
      .eq('profissional_id', profissionalId)
      .neq('tipo', 'pre_liberacao_turista')

    if (error) {
      console.error('persistirLeituraCanalFinanceiroProfissional item:', error)
      return false
    }
    return true
  }

  const { error } = await admin
    .from('canal_financeiro')
    .update({ lida_por_profissional: true })
    .eq('profissional_id', profissionalId)
    .eq('lida_por_profissional', false)
    .neq('tipo', 'pre_liberacao_turista')

  if (error) {
    console.error('persistirLeituraCanalFinanceiroProfissional bulk:', error)
    return false
  }

  if (!opts?.marcarManifestoLegado) return true

  // Legado: garante que avisos de manifesto não fiquem como não lidos para anfitrião.
  const { data: pendentes, error: selErr } = await admin
    .from('canal_financeiro')
    .select('id, tipo, titulo, mensagem')
    .eq('profissional_id', profissionalId)
    .eq('lida_por_profissional', false)

  if (selErr) {
    console.error('persistirLeituraCanalFinanceiroProfissional manifesto select:', selErr)
    return true
  }

  const idsManifesto = (pendentes ?? [])
    .filter((r) => itemCanalFinanceiroEhAvisoManifesto(r))
    .map((r) => String(r.id))

  if (idsManifesto.length === 0) return true

  const { error: errManifesto } = await admin
    .from('canal_financeiro')
    .update({ lida_por_profissional: true })
    .in('id', idsManifesto)

  if (errManifesto) {
    console.error('persistirLeituraCanalFinanceiroProfissional manifesto:', errManifesto)
    return false
  }

  return true
}
