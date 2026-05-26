import type { SupabaseClient } from '@supabase/supabase-js'
import { idsCanaisVisiveisAdmin, type CanalParticaoAdmin } from '@/lib/canaisAdminParticao'

/**
 * IDs dos canais visíveis na lista admin (pastas Mensageiro ADM) — alinhado à UI e aos badges por canal.
 */
export async function obterIdsCanaisMensagensAdmin(supabase: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('canais')
    .select('id, nome, tipo_publico, categoria, empresa_id, empresa_categoria')
    .eq('ativo', true)

  if (error) {
    console.error('obterIdsCanaisMensagensAdmin:', error)
    return new Set()
  }

  return idsCanaisVisiveisAdmin((data ?? []) as CanalParticaoAdmin[])
}
