import type { SupabaseClient } from '@supabase/supabase-js'
import { buscarRemetentesEmLote } from '@/lib/canalRemetentes'

export type VisitaPerfilRow = {
  id: string
  visitante_usuario_id: string | null
  tipo_alvo: 'perfil' | 'empresa'
  empresa_id: string | null
  visitado_em: string
  visto_pelo_dono_em: string | null
  visitante_nome: string
  visitante_username: string
  visitante_foto_url: string | null
  pendente: boolean
}

const DEBOUNCE_MS = 30 * 60 * 1000

/**
 * Regista visita ao perfil ou página da empresa (ignora dono e visitas repetidas recentes).
 */
export async function registrarVisitaPerfil(
  supabase: SupabaseClient,
  params: {
    donoUsuarioId: string
    visitanteUsuarioId: string | null
    tipoAlvo: 'perfil' | 'empresa'
    empresaId?: string | null
  },
): Promise<void> {
  const dono = params.donoUsuarioId?.trim()
  const visitante = params.visitanteUsuarioId?.trim()
  if (!dono || !visitante || dono === visitante) return

  const desde = new Date(Date.now() - DEBOUNCE_MS).toISOString()
  let q = supabase
    .from('perfil_visitas')
    .select('id')
    .eq('dono_usuario_id', dono)
    .eq('visitante_usuario_id', visitante)
    .gte('visitado_em', desde)
    .limit(1)

  if (params.tipoAlvo === 'empresa' && params.empresaId) {
    q = q.eq('tipo_alvo', 'empresa').eq('empresa_id', params.empresaId)
  } else {
    q = q.eq('tipo_alvo', 'perfil')
  }

  const { data: recente } = await q.maybeSingle()
  if (recente?.id) return

  await supabase.from('perfil_visitas').insert({
    dono_usuario_id: dono,
    visitante_usuario_id: visitante,
    tipo_alvo: params.tipoAlvo,
    empresa_id: params.tipoAlvo === 'empresa' ? params.empresaId ?? null : null,
  })
}

export async function contarVisitasPerfilPendentes(
  supabase: SupabaseClient,
  donoUsuarioId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('perfil_visitas')
    .select('id', { count: 'exact', head: true })
    .eq('dono_usuario_id', donoUsuarioId)
    .is('visto_pelo_dono_em', null)

  if (error) return 0
  return count ?? 0
}

export async function marcarVisitasPerfilComoVistas(
  supabase: SupabaseClient,
  donoUsuarioId: string,
): Promise<void> {
  const agora = new Date().toISOString()
  await supabase
    .from('perfil_visitas')
    .update({ visto_pelo_dono_em: agora })
    .eq('dono_usuario_id', donoUsuarioId)
    .is('visto_pelo_dono_em', null)
}

export async function listarVisitasPerfil(
  supabase: SupabaseClient,
  donoUsuarioId: string,
  opts?: { limit?: number },
): Promise<VisitaPerfilRow[]> {
  const limit = opts?.limit ?? 80
  const { data, error } = await supabase
    .from('perfil_visitas')
    .select('id, visitante_usuario_id, tipo_alvo, empresa_id, visitado_em, visto_pelo_dono_em')
    .eq('dono_usuario_id', donoUsuarioId)
    .order('visitado_em', { ascending: false })
    .limit(limit)

  if (error || !data?.length) return []

  const visitanteIds = [
    ...new Set(data.map((r) => r.visitante_usuario_id).filter(Boolean) as string[]),
  ]

  const [remetentes, profsRes, empsRes] = await Promise.all([
    buscarRemetentesEmLote(supabase, visitanteIds),
    visitanteIds.length > 0
      ? supabase.from('profissionais').select('usuario_id, nome_usuario').in('usuario_id', visitanteIds)
      : Promise.resolve({ data: [] as { usuario_id: string; nome_usuario: string | null }[] }),
    visitanteIds.length > 0
      ? supabase.from('empresas').select('usuario_id, nome_usuario').in('usuario_id', visitanteIds)
      : Promise.resolve({ data: [] as { usuario_id: string; nome_usuario: string | null }[] }),
  ])

  const profs = profsRes.data
  const emps = empsRes.data

  const usernamePorId = new Map<string, string>()
  for (const p of profs ?? []) {
    const u = String(p.nome_usuario ?? '').trim()
    if (p.usuario_id && u) usernamePorId.set(String(p.usuario_id), u)
  }
  for (const e of emps ?? []) {
    const u = String(e.nome_usuario ?? '').trim()
    if (e.usuario_id && u && !usernamePorId.has(String(e.usuario_id))) {
      usernamePorId.set(String(e.usuario_id), u)
    }
  }

  return data.map((row) => {
    const vid = row.visitante_usuario_id != null ? String(row.visitante_usuario_id) : ''
    const rem = vid ? remetentes.get(vid) : undefined
    const username = usernamePorId.get(vid)
    return {
      id: String(row.id),
      visitante_usuario_id: vid || null,
      tipo_alvo: row.tipo_alvo === 'empresa' ? 'empresa' : 'perfil',
      empresa_id: row.empresa_id != null ? String(row.empresa_id) : null,
      visitado_em: String(row.visitado_em ?? ''),
      visto_pelo_dono_em:
        row.visto_pelo_dono_em != null ? String(row.visto_pelo_dono_em) : null,
      visitante_nome: rem?.nome ?? 'Usuário',
      visitante_username: username ? `@${username}` : '@—',
      visitante_foto_url: rem?.foto_url ?? null,
      pendente: row.visto_pelo_dono_em == null,
    }
  })
}
