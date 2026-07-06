import type { SupabaseClient } from '@supabase/supabase-js'

/** Seguir perfil social sem erro 23505 em clique duplo ou corrida entre abas. */
export async function inserirRedeContato(
  supabase: SupabaseClient,
  row: { seguidor_id: string; seguido_id: string; seguido_tipo: string },
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('redecontatos').upsert(
    {
      seguidor_id: row.seguidor_id,
      seguido_id: row.seguido_id,
      seguido_tipo: row.seguido_tipo,
    },
    { onConflict: 'seguidor_id,seguido_id', ignoreDuplicates: true },
  )

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function removerRedeContato(
  supabase: SupabaseClient,
  seguidorId: string,
  seguidoId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('redecontatos')
    .delete()
    .eq('seguidor_id', seguidorId)
    .eq('seguido_id', seguidoId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
