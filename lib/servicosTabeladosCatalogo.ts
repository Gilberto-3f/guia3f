import type { LucideIcon } from 'lucide-react'
import { Car, MapPin, Smartphone, Users } from 'lucide-react'
import { normalizarCidadeTriplice, type CidadeTriplice } from '@/lib/mobilidadeRegional'

export type CategoriaTabeladoId = 'guia' | 'van' | 'taxista' | 'motorista_app'

export type CidadeOrigemTabeladoId = 'cde' | 'foz' | 'puerto_iguazu'

export type TipoPeriodoGuia = 'acompanhamento' | 'diaria' | 'horas'

export type RotaTabelada = {
  id: string
  categoria: CategoriaTabeladoId
  cidadeOrigem: CidadeOrigemTabeladoId
  pontoPartida: string
  destinoFinal: string
  valorRota: number
  ativo: boolean
  createdAt: string
  /** Guia: acompanhamento, diária ou por horas. */
  tipoPeriodoGuia?: TipoPeriodoGuia | null
  horaInicio?: string | null
  horaFim?: string | null
  /** Van: ida e volta. */
  horaSaida?: string | null
  horaRetorno?: string | null
  /** Van: false = somente ida. */
  idaVolta?: boolean | null
  /** Taxista: minutos de deslocamento (opcional). */
  duracaoEstimadaMin?: number | null
  /** Taxista: usar ETA Mapbox no atendimento. */
  usarEtaMapbox?: boolean | null
  /** Guia: horas quando tipoPeriodoGuia = horas. */
  duracaoHoras?: number | null
}

/** Normaliza TIME do Postgres (HH:MM:SS) para exibição HH:MM. */
export function formatarHorarioTabelado(raw: string | null | undefined): string {
  if (!raw) return ''
  const m = String(raw).match(/^(\d{1,2}):(\d{2})/)
  if (!m) return String(raw)
  return `${m[1].padStart(2, '0')}:${m[2]}`
}

export function labelTipoPeriodoGuia(tipo: TipoPeriodoGuia): string {
  if (tipo === 'acompanhamento') return 'Acompanhamento (média padrão)'
  if (tipo === 'horas') return 'Por horas'
  return 'Diária'
}

function formatarDuracaoHoras(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return ''
  const arred = Math.round(n * 10) / 10
  const texto = Number.isInteger(arred) ? String(arred) : String(arred).replace('.', ',')
  return `${texto} h`
}

/** Texto do período/horário conforme categoria da rota. */
export function descricaoPeriodoRota(rota: RotaTabelada): string | null {
  if (rota.categoria === 'guia') {
    if (rota.tipoPeriodoGuia === 'horas' && rota.duracaoHoras != null) {
      return `${labelTipoPeriodoGuia('horas')}: ${formatarDuracaoHoras(rota.duracaoHoras)}`
    }
    if (rota.tipoPeriodoGuia && rota.horaInicio && rota.horaFim) {
      const ini = formatarHorarioTabelado(rota.horaInicio)
      const fim = formatarHorarioTabelado(rota.horaFim)
      return `${labelTipoPeriodoGuia(rota.tipoPeriodoGuia)}: das ${ini} às ${fim}`
    }
  }
  if (rota.categoria === 'van' && rota.horaSaida) {
    const saida = formatarHorarioTabelado(rota.horaSaida)
    if (rota.idaVolta === false) {
      return `Somente ida: saída às ${saida}`
    }
    if (rota.horaRetorno) {
      const retorno = formatarHorarioTabelado(rota.horaRetorno)
      return `Ida e volta: saída às ${saida} / retorno às ${retorno}`
    }
    return `Saída às ${saida}`
  }
  if (rota.categoria === 'taxista') {
    const partes: string[] = []
    if (rota.duracaoEstimadaMin != null && rota.duracaoEstimadaMin > 0) {
      partes.push(`~${rota.duracaoEstimadaMin} min`)
    }
    if (rota.usarEtaMapbox !== false) {
      partes.push('ETA Mapbox (ruas)')
    }
    return partes.length > 0 ? `Deslocamento: ${partes.join(' · ')}` : null
  }
  return null
}

/** Liga o destino da corrida à rota tabelada cadastrada (exibição no drawer). */
export function encontrarRotaTabeladaPorDestino(
  rotas: RotaTabelada[],
  categoria: string | null | undefined,
  destinoTexto: string | null | undefined,
): RotaTabelada | null {
  const cat = String(categoria ?? '').trim().toLowerCase()
  const dest = String(destinoTexto ?? '').trim().toLowerCase()
  if (!cat || !dest) return null
  const daCat = rotas.filter((r) => r.categoria === cat && r.ativo !== false)
  if (daCat.length === 0) return null
  const exact = daCat.find((r) => r.destinoFinal.trim().toLowerCase() === dest)
  if (exact) return exact
  return (
    daCat.find((r) => {
      const df = r.destinoFinal.trim().toLowerCase()
      return df.includes(dest) || dest.includes(df)
    }) ?? null
  )
}

export const CATEGORIAS_TABELADOS: {
  id: CategoriaTabeladoId
  label: string
  Icon: LucideIcon
  cidades: CidadeOrigemTabeladoId[]
}[] = [
  {
    id: 'guia',
    label: 'Guias de Turismo',
    Icon: MapPin,
    cidades: ['cde', 'foz', 'puerto_iguazu'],
  },
  {
    id: 'van',
    label: 'Motoristas de Vans',
    Icon: Users,
    cidades: ['cde', 'foz', 'puerto_iguazu'],
  },
  {
    id: 'taxista',
    label: 'Taxistas',
    Icon: Car,
    cidades: ['cde', 'foz', 'puerto_iguazu'],
  },
  {
    id: 'motorista_app',
    label: 'Motoristas de APP',
    Icon: Smartphone,
    cidades: ['cde'],
  },
]

export const CIDADES_ORIGEM_TABELADO: Record<
  CidadeOrigemTabeladoId,
  { label: string; pontoPartida: string }
> = {
  cde: { label: 'Rotas de CDE', pontoPartida: 'Ciudad del Este' },
  foz: { label: 'Rotas de Foz do Iguaçu', pontoPartida: 'Foz do Iguaçu' },
  puerto_iguazu: { label: 'Rotas de Puerto Iguazú', pontoPartida: 'Puerto Iguazú' },
}

const TRIPLICE_PARA_TABELADO: Record<CidadeTriplice, CidadeOrigemTabeladoId> = {
  'Foz do Iguaçu': 'foz',
  'Ciudad del Este': 'cde',
  'Puerto Iguazu': 'puerto_iguazu',
}

export const ORDEM_CIDADES_TABELADO: CidadeOrigemTabeladoId[] = ['cde', 'foz', 'puerto_iguazu']

export function mapCidadeAtuacaoParaTabelado(
  raw: string | null | undefined,
): CidadeOrigemTabeladoId | null {
  const triplice = normalizarCidadeTriplice(raw)
  return triplice ? TRIPLICE_PARA_TABELADO[triplice] : null
}

export function ordenarCidadesTabeladas(
  ids: CidadeOrigemTabeladoId[],
  cidadeCadastro: CidadeOrigemTabeladoId | null,
): CidadeOrigemTabeladoId[] {
  const set = new Set(ids)
  const regionais = ORDEM_CIDADES_TABELADO.filter((id) => set.has(id))
  if (!cidadeCadastro || !set.has(cidadeCadastro)) return regionais
  return [cidadeCadastro, ...regionais.filter((id) => id !== cidadeCadastro)]
}

export function labelCategoriaTabelado(id: CategoriaTabeladoId): string {
  return CATEGORIAS_TABELADOS.find((c) => c.id === id)?.label ?? id
}

export function mapCategoriaProfissionalParaTabelado(
  categorias: string[] | string | null | undefined,
): CategoriaTabeladoId | null {
  const lista = Array.isArray(categorias)
    ? categorias
    : categorias
      ? [categorias]
      : []

  for (const raw of lista) {
    const c = String(raw ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
    if (c.includes('guia')) return 'guia'
    if (c === 'van' || c.includes('van')) return 'van'
    if (c.includes('taxista')) return 'taxista'
    if (c.includes('motorista') && c.includes('app')) return 'motorista_app'
    if (c === 'motorista_app' || c === 'motorista de app') return 'motorista_app'
  }
  return null
}

export function mapRotaTabeladaRow(row: Record<string, unknown>): RotaTabelada {
  const tipoRaw = row.tipo_periodo_guia
  const tipoPeriodoGuia =
    tipoRaw === 'acompanhamento' || tipoRaw === 'diaria' || tipoRaw === 'horas' ? tipoRaw : null

  const duracaoMin =
    row.duracao_estimada_min != null && Number.isFinite(Number(row.duracao_estimada_min))
      ? Number(row.duracao_estimada_min)
      : null
  const duracaoHoras =
    row.duracao_horas != null && Number.isFinite(Number(row.duracao_horas))
      ? Number(row.duracao_horas)
      : null

  return {
    id: String(row.id ?? ''),
    categoria: String(row.categoria ?? 'guia') as CategoriaTabeladoId,
    cidadeOrigem: String(row.cidade_origem ?? 'cde') as CidadeOrigemTabeladoId,
    pontoPartida: String(row.ponto_partida ?? ''),
    destinoFinal: String(row.destino_final ?? ''),
    valorRota: Number(row.valor_rota ?? 0),
    ativo: row.ativo !== false,
    createdAt: String(row.created_at ?? ''),
    tipoPeriodoGuia,
    horaInicio: row.hora_inicio != null ? String(row.hora_inicio) : null,
    horaFim: row.hora_fim != null ? String(row.hora_fim) : null,
    horaSaida: row.hora_saida != null ? String(row.hora_saida) : null,
    horaRetorno: row.hora_retorno != null ? String(row.hora_retorno) : null,
    idaVolta: row.ida_volta == null ? null : row.ida_volta === true,
    duracaoEstimadaMin: duracaoMin != null && duracaoMin > 0 ? duracaoMin : null,
    usarEtaMapbox: row.usar_eta_mapbox == null ? null : row.usar_eta_mapbox === true,
    duracaoHoras: duracaoHoras != null && duracaoHoras > 0 ? duracaoHoras : null,
  }
}
