import type { SupabaseClient } from '@supabase/supabase-js'

export type MotivoEmergenciaTurista = 'socorro' | 'perdido' | 'item_esquecido'

export type ProfissionalAtendimentoTurista = {
  profissional_id: string
  usuario_id: string
  nome: string
  username: string
  foto_url: string | null
  atendimento_em: string
  status: string
}

const STATUS_ATENDIMENTO = new Set(['aceita', 'concluida', 'concluido', 'finalizada', 'finalizado'])

/** Últimos 3 profissionais que atenderam o turista (mobilidade concluída/aceita). */
export async function fetchUltimosProfissionaisAtendimentoTurista(
  supabase: SupabaseClient,
  turistaUsuarioId: string,
  limit = 3,
): Promise<ProfissionalAtendimentoTurista[]> {
  const uid = turistaUsuarioId?.trim()
  if (!uid) return []

  const { data: rows, error } = await supabase
    .from('solicitacao_mobilidade')
    .select('id, profissional_id, status, created_at, updated_at')
    .eq('turista_id', uid)
    .not('profissional_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(30)

  if (error || !rows?.length) return []

  const filtrados = rows.filter((r) =>
    STATUS_ATENDIMENTO.has(String(r.status ?? '').toLowerCase()),
  )
  const vistos = new Set<string>()
  const profIds: { profissional_id: string; atendimento_em: string; status: string }[] = []

  for (const r of filtrados) {
    const pid = r.profissional_id != null ? String(r.profissional_id) : ''
    if (!pid || vistos.has(pid)) continue
    vistos.add(pid)
    profIds.push({
      profissional_id: pid,
      atendimento_em: String(r.updated_at ?? r.created_at ?? ''),
      status: String(r.status ?? ''),
    })
    if (profIds.length >= limit) break
  }

  if (profIds.length === 0) return []

  const ids = profIds.map((p) => p.profissional_id)
  const { data: profs } = await supabase
    .from('profissionais')
    .select('id, usuario_id, nome_completo, nome_usuario, foto_perfil_url, foto_url')
    .in('id', ids)

  const byId = new Map((profs ?? []).map((p) => [String(p.id), p]))

  return profIds
    .map((meta) => {
      const p = byId.get(meta.profissional_id)
      if (!p) return null
      const foto =
        p.foto_perfil_url != null
          ? String(p.foto_perfil_url)
          : p.foto_url != null
            ? String(p.foto_url)
            : null
      return {
        profissional_id: meta.profissional_id,
        usuario_id: String(p.usuario_id ?? ''),
        nome: String(p.nome_completo ?? 'Profissional'),
        username: String(p.nome_usuario ?? ''),
        foto_url: foto,
        atendimento_em: meta.atendimento_em,
        status: meta.status,
      }
    })
    .filter((x): x is ProfissionalAtendimentoTurista => x != null)
}

export function labelMotivoEmergencia(motivo: MotivoEmergenciaTurista | null | undefined): string {
  if (motivo === 'item_esquecido') return 'Item esquecido'
  if (motivo === 'perdido') return 'Estou perdido(a)'
  if (motivo === 'socorro') return 'SOCORRO'
  return 'Emergência'
}

export function assuntoPadraoMotivo(motivo: MotivoEmergenciaTurista): string {
  if (motivo === 'item_esquecido') return 'Item esquecido no veículo / hospedagem'
  if (motivo === 'perdido') return 'Turista perdido(a) — apoio de localização'
  return 'Solicitação emergencial — SOCORRO'
}

/** Contatos aduaneiros (atualizar tel quando definidos). */
export const EMERGENCIA_ADUANAS: { label: string; tel: string }[] = [
  { label: 'Aduana CDE', tel: '' },
  { label: 'Aduana Puerto Iguazú', tel: '' },
  { label: 'Aduana FOZ/CDE', tel: '' },
  { label: 'Aduana FOZ/PUERTO', tel: '' },
]
