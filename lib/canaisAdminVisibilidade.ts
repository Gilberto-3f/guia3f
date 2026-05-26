import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * IDs de todos os canais ativos (visão admin / Mensageiro ADM).
 */
export async function obterIdsCanaisMensagensAdmin(supabase: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await supabase.from('canais').select('id').eq('ativo', true)

  if (error) {
    console.error('obterIdsCanaisMensagensAdmin:', error)
    return new Set()
  }

  return new Set((data ?? []).map((c) => String(c.id)))
}
