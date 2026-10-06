import type { SupabaseClient } from '@supabase/supabase-js'
import { gravarProfissionalIdCache, lerProfissionalIdCache } from '@/lib/perfilSessaoCache'

/** Evita SELECT profissionais.id em todo poll (dois aparelhos saturavam o REST). */
export async function profissionalIdPorUsuario(
  admin: SupabaseClient,
  usuarioId: string,
): Promise<string | null> {
  const uid = String(usuarioId ?? '').trim()
  if (!uid) return null
  const cached = await lerProfissionalIdCache(uid)
  if (cached) return cached
  const { data } = await admin.from('profissionais').select('id').eq('usuario_id', uid).maybeSingle()
  const id = data?.id != null ? String(data.id) : ''
  if (!id) return null
  await gravarProfissionalIdCache(uid, id)
  return id
}
