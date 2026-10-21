import type { SupabaseClient } from '@supabase/supabase-js'
import {
  adminNivelTemBlocoFixo,
  adminPodeTrocarBlocoCanais,
  lerEcossistemaIdAdmin,
} from '@/lib/adminEcossistema'
import { buscarIdEcossistemaPadrao } from '@/lib/canaisEcossistema'
import { lerEcossistemaCanaisAdmId } from '@/lib/ecossistemaCanaisAdmStorage'

/**
 * Bloco da página de canais do ADM: vínculo fixo (2/4) ou escolha do chevron (1/3).
 * Independente do chevron da home.
 */
export async function resolverIdBlocoCanaisAdm(
  db: Pick<SupabaseClient, 'from' | 'auth'>,
  usuarioId?: string | null,
): Promise<string | null> {
  const padrao = await buscarIdEcossistemaPadrao(db)
  let uid = usuarioId != null ? String(usuarioId).trim() : ''
  if (!uid) {
    try {
      const { data } = await db.auth.getSession()
      uid = data.session?.user?.id ? String(data.session.user.id) : ''
    } catch {
      uid = ''
    }
  }
  if (!uid) return padrao

  const { data: row } = await db
    .from('usuarios')
    .select('admin_level, admin_permissoes, ecossistema_id')
    .eq('id', uid)
    .maybeSingle()

  const nivel = Number(row?.admin_level ?? 0)
  const cargo =
    row?.admin_permissoes && typeof row.admin_permissoes === 'object' && !Array.isArray(row.admin_permissoes)
      ? String((row.admin_permissoes as { cargo?: string }).cargo ?? '')
      : ''

  if (adminNivelTemBlocoFixo(nivel)) {
    return lerEcossistemaIdAdmin(row) || padrao
  }

  if (adminPodeTrocarBlocoCanais(nivel, cargo)) {
    const stored = lerEcossistemaCanaisAdmId()
    if (stored) {
      const { data: eco } = await db.from('ecossistemas').select('id').eq('id', stored).maybeSingle()
      if (eco?.id) return String(eco.id)
    }
    return padrao
  }

  return padrao
}
