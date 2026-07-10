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

/** Status do card no Drawer 1: ocupado se a data de referência (hoje) está em reserva/bloqueio. */
export function statusAcomodacaoHoje(
  periodos: PeriodoOcupacao[],
  hojeIso = new Date().toISOString().slice(0, 10),
): 'disponivel' | 'ocupado' {
  const hoje = hojeIso.slice(0, 10)
  return periodos.some((p) => dataNoPeriodoOcupado(hoje, p.inicio, p.fim))
    ? 'ocupado'
    : 'disponivel'
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
    // Bloqueio inclusivo: data_fim conta como ocupado → fim exclusivo = dia seguinte
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
