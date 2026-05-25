import type { SupabaseClient } from '@supabase/supabase-js'

export type RemetenteCanal = {
  id: string
  nome: string
  foto_url: string | null
  role: string
}

function pickFoto(row: { foto_perfil_url?: unknown; foto_url?: unknown } | null | undefined): string | null {
  if (!row) return null
  if (row.foto_perfil_url != null) return String(row.foto_perfil_url)
  if (row.foto_url != null) return String(row.foto_url)
  return null
}

const empty = { data: [] as Record<string, unknown>[], error: null }

/**
 * Resolve remetentes de mensagens de canal em poucas queries (evita N+1).
 */
export async function buscarRemetentesEmLote(
  supabase: SupabaseClient,
  remetenteIds: string[],
): Promise<Map<string, RemetenteCanal>> {
  const map = new Map<string, RemetenteCanal>()
  const unique = [...new Set(remetenteIds.map((id) => String(id ?? '').trim()).filter(Boolean))]
  if (unique.length === 0) return map

  const { data: users, error } = await supabase.from('usuarios').select('id, email, role').in('id', unique)
  if (error || !users?.length) return map

  const turistaIds: string[] = []
  const profIds: string[] = []
  const empresaIds: string[] = []
  const adminIds: string[] = []
  const emailPorId = new Map<string, string>()

  for (const u of users) {
    const id = u.id != null ? String(u.id) : ''
    if (!id) continue
    const role = String(u.role ?? '')
    emailPorId.set(id, u.email != null ? String(u.email) : '')
    if (role === 'turista') turistaIds.push(id)
    else if (role === 'profissional') profIds.push(id)
    else if (role === 'empresa') empresaIds.push(id)
    else if (role === 'admin') adminIds.push(id)
    else {
      const email = emailPorId.get(id) ?? ''
      map.set(id, { id, nome: email ? email.split('@')[0] : 'Usuário', foto_url: null, role })
    }
  }

  const [turRes, profRes, empRes, adminProfRes, adminTurRes] = await Promise.all([
    turistaIds.length
      ? supabase.from('turistas').select('usuario_id, nome_completo, foto_perfil_url, foto_url').in('usuario_id', turistaIds)
      : Promise.resolve(empty),
    profIds.length
      ? supabase
          .from('profissionais')
          .select('usuario_id, nome_completo, foto_perfil_url, foto_url')
          .in('usuario_id', profIds)
      : Promise.resolve(empty),
    empresaIds.length
      ? supabase.from('empresas').select('usuario_id, nome_fantasia, foto_url').in('usuario_id', empresaIds)
      : Promise.resolve(empty),
    adminIds.length
      ? supabase.from('profissionais').select('usuario_id, nome_completo, foto_perfil_url, foto_url').in('usuario_id', adminIds)
      : Promise.resolve(empty),
    adminIds.length
      ? supabase.from('turistas').select('usuario_id, nome_completo, foto_perfil_url, foto_url').in('usuario_id', adminIds)
      : Promise.resolve(empty),
  ])

  for (const row of turRes.data ?? []) {
    const uid = row.usuario_id != null ? String(row.usuario_id) : ''
    if (!uid) continue
    const nome = row.nome_completo != null ? String(row.nome_completo) : emailPorId.get(uid)?.split('@')[0] ?? 'Usuário'
    map.set(uid, { id: uid, nome, foto_url: pickFoto(row), role: 'turista' })
  }
  for (const row of profRes.data ?? []) {
    const uid = row.usuario_id != null ? String(row.usuario_id) : ''
    if (!uid) continue
    const nome = row.nome_completo != null ? String(row.nome_completo) : emailPorId.get(uid)?.split('@')[0] ?? 'Usuário'
    map.set(uid, { id: uid, nome, foto_url: pickFoto(row), role: 'profissional' })
  }
  for (const row of empRes.data ?? []) {
    const uid = row.usuario_id != null ? String(row.usuario_id) : ''
    if (!uid) continue
    const nome =
      row.nome_fantasia != null ? String(row.nome_fantasia) : emailPorId.get(uid)?.split('@')[0] ?? 'Usuário'
    map.set(uid, {
      id: uid,
      nome,
      foto_url: row.foto_url != null ? String(row.foto_url) : null,
      role: 'empresa',
    })
  }

  const profAdmin = new Map<string, Record<string, unknown>>()
  for (const row of adminProfRes.data ?? []) {
    const uid = row.usuario_id != null ? String(row.usuario_id) : ''
    if (uid) profAdmin.set(uid, row)
  }
  const turAdmin = new Map<string, Record<string, unknown>>()
  for (const row of adminTurRes.data ?? []) {
    const uid = row.usuario_id != null ? String(row.usuario_id) : ''
    if (uid) turAdmin.set(uid, row)
  }
  for (const uid of adminIds) {
    const row = profAdmin.get(uid) ?? turAdmin.get(uid)
    const nome =
      row?.nome_completo != null
        ? String(row.nome_completo)
        : emailPorId.get(uid)?.split('@')[0] ?? 'Usuário'
    map.set(uid, { id: uid, nome, foto_url: pickFoto(row), role: 'admin' })
  }

  for (const id of unique) {
    if (map.has(id)) continue
    const email = emailPorId.get(id) ?? ''
    map.set(id, { id, nome: email ? email.split('@')[0] : 'Usuário', foto_url: null, role: '' })
  }

  return map
}
