import type { SupabaseClient } from '@supabase/supabase-js'
import { reservasHospedagemDatasSobrepoem } from '@/lib/reservaHospedagem'
import { COR_AZUL_LOGO, COR_VERDE_BOTAO } from '@/lib/hospedagemAcomodacoesCatalogo'

export { COR_AZUL_LOGO, COR_VERDE_BOTAO }

export type PeriodoOcupacao = {
  inicio: string
  fim: string
  origem: 'reserva' | 'bloqueio'
  reservaId?: string
  status?: string
}

/** Intervalo [inicio, fim) em ISO date YYYY-MM-DD — fim exclusivo (checkout). */
export function dataNoPeriodoOcupado(dataIso: string, inicio: string, fim: string): boolean {
  const d = String(dataIso).slice(0, 10)
  const a = String(inicio).slice(0, 10)
  const b = String(fim).slice(0, 10)
  return Boolean(d && a && b && d >= a && d < b)
}

export function periodosSobrepoem(
  inicioA: string,
  fimA: string,
  inicioB: string,
  fimB: string,
): boolean {
  return reservasHospedagemDatasSobrepoem(inicioA, fimA, inicioB, fimB)
}

/** Status do mini-card no Drawer 1. */
export type StatusAcomodacaoCard = 'disponivel' | 'ocupado' | 'indisponivel_em_breve'

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/**
 * Status do card no Drawer 1:
 * - ocupado: há reserva/bloqueio cobrindo o dia de hoje
 * - indisponivel_em_breve: check-in futuro em até 3 dias
 * - disponivel: livre hoje (reservas mais distantes não ocupam o card)
 */
export function statusAcomodacaoHoje(
  periodos: PeriodoOcupacao[],
  hojeIso = hojeIsoLocal(),
): StatusAcomodacaoCard {
  const hoje = hojeIso.slice(0, 10)
  if (periodos.some((p) => dataNoPeriodoOcupado(hoje, p.inicio, p.fim))) {
    return 'ocupado'
  }
  const limite = addDaysIso(hoje, 3)
  const checkinProximo = periodos.some((p) => {
    const inicio = String(p.inicio).slice(0, 10)
    return Boolean(inicio && inicio > hoje && inicio <= limite)
  })
  if (checkinProximo) return 'indisponivel_em_breve'
  return 'disponivel'
}

function hojeIsoLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function corDiaCalendario(ocupado: boolean): string {
  return ocupado ? COR_AZUL_LOGO : COR_VERDE_BOTAO
}

export async function carregarPeriodosOcupacaoAcomodacao(
  supabase: SupabaseClient,
  acomodacaoId: string,
): Promise<PeriodoOcupacao[]> {
  const id = String(acomodacaoId ?? '').trim()
  if (!id) return []

  // RPC SECURITY DEFINER: qualquer visitante vê ocupação (sem PII do turista).
  const { data: rpcRows, error: rpcErr } = await supabase.rpc('periodos_ocupacao_acomodacao', {
    p_acomodacao_id: id,
  })

  if (!rpcErr && Array.isArray(rpcRows)) {
    return (rpcRows as Array<Record<string, unknown>>).map((r) => ({
      inicio: String(r.data_checkin).slice(0, 10),
      fim: String(r.data_checkout).slice(0, 10),
      origem: String(r.origem) === 'bloqueio' ? ('bloqueio' as const) : ('reserva' as const),
      reservaId: r.id != null && String(r.origem) !== 'bloqueio' ? String(r.id) : undefined,
      status: r.status != null ? String(r.status) : undefined,
    }))
  }

  // Fallback legado (sujeito a RLS — outros turistas não veem reservas alheias).
  const periodos: PeriodoOcupacao[] = []

  const { data: reservas } = await supabase
    .from('reservas_hospedagem')
    .select('id, data_checkin, data_checkout, status')
    .eq('acomodacao_id', id)
    .in('status', ['pendente', 'confirmada'])

  for (const r of reservas ?? []) {
    periodos.push({
      inicio: String(r.data_checkin).slice(0, 10),
      fim: String(r.data_checkout).slice(0, 10),
      origem: 'reserva',
      reservaId: String(r.id),
      status: String(r.status),
    })
  }

  const { data: bloqueios } = await supabase
    .from('hospedagem_bloqueios_calendario')
    .select('id, data_inicio, data_fim')
    .eq('acomodacao_id', id)

  for (const b of bloqueios ?? []) {
    const fimExcl = adicionarDias(String(b.data_fim).slice(0, 10), 1)
    periodos.push({
      inicio: String(b.data_inicio).slice(0, 10),
      fim: fimExcl,
      origem: 'bloqueio',
    })
  }

  return periodos
}

export function adicionarDias(isoDate: string, dias: number): string {
  const d = new Date(`${isoDate}T12:00:00`)
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

export function periodoDisponivel(
  periodos: PeriodoOcupacao[],
  checkin: string,
  checkout: string,
): boolean {
  if (!checkin || !checkout || checkin >= checkout) return false
  return !periodos.some((p) => periodosSobrepoem(checkin, checkout, p.inicio, p.fim))
}

export function listarDatasDoMes(ano: number, mes0: number): (string | null)[] {
  const primeiro = new Date(ano, mes0, 1)
  const diasNoMes = new Date(ano, mes0 + 1, 0).getDate()
  const inicioSemana = (primeiro.getDay() + 6) % 7 // segunda = 0
  const cells: (string | null)[] = []
  for (let i = 0; i < inicioSemana; i++) cells.push(null)
  for (let dia = 1; dia <= diasNoMes; dia++) {
    const iso = `${ano}-${String(mes0 + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
    cells.push(iso)
  }
  return cells
}

export function diaOcupado(periodos: PeriodoOcupacao[], dataIso: string): boolean {
  return periodos.some((p) => dataNoPeriodoOcupado(dataIso, p.inicio, p.fim))
}
