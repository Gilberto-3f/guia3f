import type { SupabaseClient } from '@supabase/supabase-js'

export type BloqueioMobilidade = {
  id: string
  data: string
  motivo: string | null
}

export function hojeIsoLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Status visual alinhado à hospedagem: verde livre / azul bloqueado. */
export type StatusDiaMobilidade = 'passado' | 'livre' | 'bloqueado'

export function statusDiaMobilidade(
  iso: string,
  bloqueados: Set<string> | ReadonlySet<string>,
  hoje: string,
): StatusDiaMobilidade {
  if (iso < hoje) return 'passado'
  if (bloqueados.has(iso)) return 'bloqueado'
  return 'livre'
}

export function corStatusDiaMobilidade(st: StatusDiaMobilidade): string {
  if (st === 'passado') return '#c4c4c4'
  if (st === 'bloqueado') return '#0097b2'
  return '#00D443'
}

export async function carregarBloqueiosMobilidade(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient | any,
  profissionalId: string,
  opts?: { aPartirDe?: string },
): Promise<BloqueioMobilidade[]> {
  const desde = opts?.aPartirDe ?? hojeIsoLocal()
  const { data, error } = await supabase
    .from('mobilidade_bloqueios_calendario')
    .select('id, data, motivo')
    .eq('profissional_id', profissionalId)
    .gte('data', desde)
    .order('data', { ascending: true })

  if (error) {
    console.warn('[mobilidadeBloqueios]', error.message)
    return []
  }

  return (data ?? []).map((r: { id?: unknown; data?: unknown; motivo?: unknown }) => ({
    id: String(r.id ?? ''),
    data: String(r.data ?? '').slice(0, 10),
    motivo: r.motivo != null ? String(r.motivo) : null,
  }))
}

/** Detecta erro de migration não aplicada (PostgREST schema cache). */
export function erroTabelaBloqueiosAusente(message: string | null | undefined): boolean {
  const msg = String(message ?? '')
  return (
    /mobilidade_bloqueios_calendario/i.test(msg) &&
    (/schema cache/i.test(msg) || /does not exist/i.test(msg) || /could not find/i.test(msg))
  )
}

export async function diaEstaBloqueadoMobilidade(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient | any,
  profissionalId: string,
  dataYmd: string,
): Promise<boolean> {
  const d = String(dataYmd).slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return true
  const { data } = await supabase
    .from('mobilidade_bloqueios_calendario')
    .select('id')
    .eq('profissional_id', profissionalId)
    .eq('data', d)
    .maybeSingle()
  return Boolean(data?.id)
}
