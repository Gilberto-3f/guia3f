import type { SupabaseClient } from '@supabase/supabase-js'

/** Garante os 5 canais de comunidade no banco (evita placeholders bloqueados na lista). */
export async function garantirCanaisEmpresaComunidade(
  supabase: SupabaseClient,
  empresaId: string | null | undefined,
): Promise<boolean> {
  const id = String(empresaId ?? '').trim()
  if (!id) return false
  try {
    const { error } = await supabase.rpc('garantir_canais_empresa_comunidade', {
      p_empresa_id: id,
    })
    if (error) {
      console.warn('garantir_canais_empresa_comunidade:', error.message)
      return false
    }
    return true
  } catch (err) {
    console.warn('garantir_canais_empresa_comunidade:', err)
    return false
  }
}
