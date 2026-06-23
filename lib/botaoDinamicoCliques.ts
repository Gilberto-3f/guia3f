import type { SupabaseClient } from '@supabase/supabase-js'

export async function registrarCliqueBotaoDinamico(
  supabase: SupabaseClient,
  empresaId: string,
): Promise<void> {
  if (!empresaId) return
  try {
    await supabase.rpc('rpc_registrar_clique_botao_dinamico', { p_empresa_id: empresaId })
  } catch {
    /* analítico não bloqueia a ação */
  }
}

export async function contarCliquesBotaoDinamicoMes(
  supabase: SupabaseClient,
  empresaId: string,
): Promise<number> {
  if (!empresaId) return 0
  const { data, error } = await supabase.rpc('rpc_cliques_botao_dinamico_mes', {
    p_empresa_id: empresaId,
  })
  if (error) return 0
  return Number(data) || 0
}
