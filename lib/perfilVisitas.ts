import type { SupabaseClient } from '@supabase/supabase-js'
import { buscarRemetentesEmLote } from '@/lib/canalRemetentes'

export type VisitaPerfilRow = {
  id: string
  visitante_usuario_id: string | null
  /** Alvo predominante no dia (última visita). */
  tipo_alvo: 'perfil' | 'empresa'
  empresa_id: string | null
  visitado_em: string
  visto_pelo_dono_em: string | null
  visitante_nome: string
  visitante_username: string
  visitante_foto_url: string | null
  pendente: boolean
  visitas_perfil: number
  visitas_empresa: number
  /** Empresa do visitante (navegação para página). */
  visitante_empresa_id: string | null
  visitante_role: string
}

/** Debounce em memória: evita contagem duplicada por remount (Strict Mode). */
const debounceRegistro = new Map<string, number>()
const DEBOUNCE_MS = 8_000

/** Chave visitante + dia civil (YYYY-MM-DD local). */
function chaveVisitaPorDia(visitanteUsuarioId: string | null, visitadoEm: string): string {
  const vid = visitanteUsuarioId?.trim() || 'anon'
  const d = new Date(visitadoEm)
  if (Number.isNaN(d.getTime())) return `${vid}:`
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${vid}:${y}-${m}-${day}`
}

/**
 * Regista visita ao perfil ou página da empresa (cada entrada conta;
 * debounce curto evita duplicata por remount).
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

  const debounceKey = `${dono}:${visitante}:${params.tipoAlvo}:${params.empresaId ?? ''}`
  const agora = Date.now()
  const ultima = debounceRegistro.get(debounceKey) ?? 0
  if (agora - ultima < DEBOUNCE_MS) return
  debounceRegistro.set(debounceKey, agora)

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
  const { data, error } = await supabase
    .from('perfil_visitas')
    .select('visitante_usuario_id, visitado_em')
    .eq('dono_usuario_id', donoUsuarioId)
    .is('visto_pelo_dono_em', null)

  if (error || !data?.length) return 0

  const chaves = new Set<string>()
  for (const row of data) {
    const vid = row.visitante_usuario_id != null ? String(row.visitante_usuario_id) : null
    chaves.add(chaveVisitaPorDia(vid, String(row.visitado_em ?? '')))
  }
  return chaves.size
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
  const limit = opts?.limit ?? 200
  const { data, error } = await supabase
    .from('perfil_visitas')
    .select('id, visitante_usuario_id, tipo_alvo, empresa_id, visitado_em, visto_pelo_dono_em')
    .eq('dono_usuario_id', donoUsuarioId)
    .order('visitado_em', { ascending: false })
    .limit(limit)

  if (error || !data?.length) return []

  type Agg = {
    id: string
    visitante_usuario_id: string | null
    tipo_alvo: 'perfil' | 'empresa'
    empresa_id: string | null
    visitado_em: string
    visto_pelo_dono_em: string | null
    visitas_perfil: number
    visitas_empresa: number
    pendente: boolean
  }

  const porDia = new Map<string, Agg>()
  for (const row of data) {
    const vid = row.visitante_usuario_id != null ? String(row.visitante_usuario_id) : null
    const visitadoEm = String(row.visitado_em ?? '')
    const key = chaveVisitaPorDia(vid, visitadoEm)
    const tipoAlvo: 'perfil' | 'empresa' = row.tipo_alvo === 'empresa' ? 'empresa' : 'perfil'
    const existente = porDia.get(key)
    if (!existente) {
      porDia.set(key, {
        id: String(row.id),
        visitante_usuario_id: vid,
        tipo_alvo: tipoAlvo,
        empresa_id: row.empresa_id != null ? String(row.empresa_id) : null,
        visitado_em: visitadoEm,
        visto_pelo_dono_em:
          row.visto_pelo_dono_em != null ? String(row.visto_pelo_dono_em) : null,
        visitas_perfil: tipoAlvo === 'perfil' ? 1 : 0,
        visitas_empresa: tipoAlvo === 'empresa' ? 1 : 0,
        pendente: row.visto_pelo_dono_em == null,
      })
      continue
    }
    if (tipoAlvo === 'perfil') existente.visitas_perfil += 1
    else existente.visitas_empresa += 1
    if (row.visto_pelo_dono_em == null) existente.pendente = true
    // Mantém a visita mais recente (já ordenado DESC — primeira entrada ganha visitado_em)
  }

  const agregados = [...porDia.values()].sort(
    (a, b) => new Date(b.visitado_em).getTime() - new Date(a.visitado_em).getTime(),
  )

  const visitanteIds = [
    ...new Set(agregados.map((r) => r.visitante_usuario_id).filter(Boolean) as string[]),
  ]

  const [remetentes, profsRes, empsRes] = await Promise.all([
    buscarRemetentesEmLote(supabase, visitanteIds),
    visitanteIds.length > 0
      ? supabase.from('profissionais').select('usuario_id, nome_usuario').in('usuario_id', visitanteIds)
      : Promise.resolve({ data: [] as { usuario_id: string; nome_usuario: string | null }[] }),
    visitanteIds.length > 0
      ? supabase
          .from('empresas')
          .select('id, usuario_id, nome_usuario')
          .in('usuario_id', visitanteIds)
      : Promise.resolve({
          data: [] as { id: string; usuario_id: string; nome_usuario: string | null }[],
        }),
  ])

  const profs = profsRes.data
  const emps = empsRes.data

  const usernamePorId = new Map<string, string>()
  const empresaIdPorUsuario = new Map<string, string>()
  for (const p of profs ?? []) {
    const u = String(p.nome_usuario ?? '').trim()
    if (p.usuario_id && u) usernamePorId.set(String(p.usuario_id), u)
  }
  for (const e of emps ?? []) {
    const uid = String(e.usuario_id ?? '')
    const u = String(e.nome_usuario ?? '').trim()
    if (uid && u && !usernamePorId.has(uid)) usernamePorId.set(uid, u)
    if (uid && e.id) empresaIdPorUsuario.set(uid, String(e.id))
  }

  return agregados.map((row): VisitaPerfilRow => {
    const vid = row.visitante_usuario_id ?? ''
    const rem = vid ? remetentes.get(vid) : undefined
    const username = usernamePorId.get(vid)
    const role = rem?.role ? String(rem.role) : ''
    return {
      id: row.id,
      visitante_usuario_id: row.visitante_usuario_id,
      tipo_alvo: row.tipo_alvo,
      empresa_id: row.empresa_id,
      visitado_em: row.visitado_em,
      visto_pelo_dono_em: row.visto_pelo_dono_em,
      visitante_nome: rem?.nome ?? 'Usuário',
      visitante_username: username ? `@${username}` : '@—',
      visitante_foto_url: rem?.foto_url ?? null,
      pendente: row.pendente,
      visitas_perfil: row.visitas_perfil,
      visitas_empresa: row.visitas_empresa,
      visitante_empresa_id: empresaIdPorUsuario.get(vid) ?? null,
      visitante_role: role,
    }
  })
}

/** Texto da 3ª linha do card (contagens do dia). */
export function textoContagemVisitasDia(v: Pick<VisitaPerfilRow, 'visitas_perfil' | 'visitas_empresa'>): string {
  const partes: string[] = []
  if (v.visitas_perfil > 0) {
    partes.push(
      `visitou seu perfil ${v.visitas_perfil} ${v.visitas_perfil === 1 ? 'vez' : 'vezes'}`,
    )
  }
  if (v.visitas_empresa > 0) {
    partes.push(
      `visitou sua página ${v.visitas_empresa} ${v.visitas_empresa === 1 ? 'vez' : 'vezes'}`,
    )
  }
  return partes.join(' - ') || 'visitou 1 vez'
}
