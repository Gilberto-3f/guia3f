import {
  normalizarCategoriaMobilidade,
  normalizarCidadeTriplice,
  type CategoriaMobilidade,
  type CidadeTriplice,
} from '@/lib/mobilidadeRegional'

export const MESES_LABEL = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
] as const

export type PeriodoProjecao = '7d' | '30d' | '90d'
export type ModoMapaCalor = 'regiao' | 'geral'
export type TipoServicoProjecao = 'mobilidade' | 'hospedagem' | 'todos'

/** Capacidade diária de referência até termos inventário real por empresa. */
export const CAPACIDADE_DIARIA_REFERENCIA = 100

export interface ReservaHospedagemRow {
  dataCheckin: string
  dataCheckout: string
  status: string
}

export interface AtendimentoProjecaoRow {
  categoria: string
  cidades: string[]
  createdAt: string
  status: string
  tipoServico: string
  dataAgendada: string | null
  latOrigem: number | null
  lngOrigem: number | null
  latDestino: number | null
  lngDestino: number | null
  regiao: string | null
}

export interface SerieMensalComparativa {
  mes: number
  mesLabel: string
  anoAtual: number
  anoAnterior: number
}

export interface PontoCalorMapa {
  id: string
  lat: number
  lng: number
  intensidade: number
  label: string
  total: number
}

export interface AgendamentoMensal {
  mes: number
  mesLabel: string
  confirmados: number
  pendentes: number
  projecao: number
}

export function dataLimiteProjecao(periodo: PeriodoProjecao): Date {
  const d = new Date()
  const dias = periodo === '7d' ? 7 : periodo === '30d' ? 30 : 90
  d.setDate(d.getDate() - dias)
  d.setHours(0, 0, 0, 0)
  return d
}

function parseDateOnly(s: string): Date | null {
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

function diasNoMes(ano: number, mes: number): number {
  return new Date(ano, mes + 1, 0).getDate()
}

function noitesEntre(checkin: Date, checkout: Date): number {
  const ms = checkout.getTime() - checkin.getTime()
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)))
}

function noitesNoMes(checkin: Date, checkout: Date, ano: number, mes: number): number {
  const inicioMes = new Date(ano, mes, 1)
  const fimMes = new Date(ano, mes + 1, 0, 23, 59, 59)
  const ini = checkin > inicioMes ? checkin : inicioMes
  const fim = checkout < fimMes ? checkout : fimMes
  if (ini > fim) return 0
  return Math.max(1, Math.ceil((fim.getTime() - ini.getTime()) / (1000 * 60 * 60 * 24)))
}

/** Últimos 12 meses com taxa de ocupação (%) — ano atual vs anterior. */
export function agregarOcupacaoHospedagem(
  reservas: ReservaHospedagemRow[],
  capacidadeDiaria = CAPACIDADE_DIARIA_REFERENCIA,
): SerieMensalComparativa[] {
  const hoje = new Date()
  const anoAtual = hoje.getFullYear()
  const anoAnterior = anoAtual - 1

  const reservadas: Record<string, number> = {}
  const chave = (ano: number, mes: number) => `${ano}-${mes}`

  for (const r of reservas) {
    if (r.status === 'cancelada') continue
    const checkin = parseDateOnly(r.dataCheckin)
    const checkout = parseDateOnly(r.dataCheckout)
    if (!checkin || !checkout) continue

    for (const ano of [anoAtual, anoAnterior]) {
      for (let mes = 0; mes < 12; mes++) {
        const n = noitesNoMes(checkin, checkout, ano, mes)
        if (n > 0) {
          const k = chave(ano, mes)
          reservadas[k] = (reservadas[k] ?? 0) + n
        }
      }
    }
  }

  const resultado: SerieMensalComparativa[] = []
  for (let i = 11; i >= 0; i--) {
    const dt = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
    const mes = dt.getMonth()
    const ano = dt.getFullYear()
    const anoAnt = ano - 1
    const disponiveis = diasNoMes(ano, mes) * capacidadeDiaria
    const disponiveisAnt = diasNoMes(anoAnt, mes) * capacidadeDiaria
    const res = reservadas[chave(ano, mes)] ?? 0
    const resAnt = reservadas[chave(anoAnt, mes)] ?? 0
    resultado.push({
      mes,
      mesLabel: MESES_LABEL[mes],
      anoAtual: disponiveis > 0 ? Math.min(100, (res / disponiveis) * 100) : 0,
      anoAnterior: disponiveisAnt > 0 ? Math.min(100, (resAnt / disponiveisAnt) * 100) : 0,
    })
  }

  return resultado
}

export function agregarHistoricoSazonalidade(
  rows: AtendimentoProjecaoRow[],
  opts?: {
    cidade?: CidadeTriplice | null
    categoria?: CategoriaMobilidade | null
    tipoServico?: TipoServicoProjecao
  },
): (SerieMensalComparativa & { diffPercentual: number })[] {
  const hoje = new Date()
  const anoAtual = hoje.getFullYear()
  const anoAnterior = anoAtual - 1
  const contagem: Record<string, number> = {}
  const chave = (ano: number, mes: number) => `${ano}-${mes}`

  for (const row of rows) {
    if (opts?.tipoServico && opts.tipoServico !== 'todos' && row.tipoServico !== opts.tipoServico) continue
    if (opts?.cidade) {
      const match = row.cidades.some((c) => normalizarCidadeTriplice(c) === opts.cidade)
      if (!match) continue
    }
    if (opts?.categoria) {
      const cat = normalizarCategoriaMobilidade(row.categoria)
      if (cat !== opts.categoria) continue
    }
    if (row.status !== 'concluida') continue
    const dt = new Date(row.createdAt)
    if (Number.isNaN(dt.getTime())) continue
    const k = chave(dt.getFullYear(), dt.getMonth())
    contagem[k] = (contagem[k] ?? 0) + 1
  }

  return MESES_LABEL.map((mesLabel, mes) => {
    const atual = contagem[chave(anoAtual, mes)] ?? 0
    const anterior = contagem[chave(anoAnterior, mes)] ?? 0
    const diff =
      anterior > 0 ? ((atual - anterior) / anterior) * 100 : atual > 0 ? 100 : 0
    return { mes, mesLabel, anoAtual: atual, anoAnterior: anterior, diffPercentual: diff }
  })
}

const REGIOES_TRIPLICE: { label: string; lat: number; lng: number }[] = [
  { label: 'Centro — Foz', lat: -25.5478, lng: -54.5882 },
  { label: 'Parque Nacional', lat: -25.6826, lng: -54.4367 },
  { label: 'Aeroporto Foz', lat: -25.5963, lng: -54.4872 },
  { label: 'Centro — CDE', lat: -25.5097, lng: -54.6111 },
  { label: 'Shopping CDE', lat: -25.5042, lng: -54.625 },
  { label: 'Centro — Puerto', lat: -25.5991, lng: -54.5735 },
  { label: 'Cataratas AR', lat: -25.6923, lng: -54.4387 },
]

function distanciaKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function regiaoMaisProxima(lat: number, lng: number): string {
  let melhor = REGIOES_TRIPLICE[0]
  let min = Infinity
  for (const r of REGIOES_TRIPLICE) {
    const d = distanciaKm(lat, lng, r.lat, r.lng)
    if (d < min) {
      min = d
      melhor = r
    }
  }
  return melhor.label
}

export function agregarMapaCalor(
  rows: AtendimentoProjecaoRow[],
  opts?: {
    desde?: Date | null
    cidade?: CidadeTriplice | null
    categoria?: CategoriaMobilidade | null
    modo?: ModoMapaCalor
  },
): PontoCalorMapa[] {
  const modo = opts?.modo ?? 'regiao'
  const filtrados: { lat: number; lng: number; regiao: string }[] = []

  for (const row of rows) {
    if (row.status !== 'concluida') continue
    if (opts?.desde) {
      const dt = new Date(row.createdAt)
      if (Number.isNaN(dt.getTime()) || dt < opts.desde) continue
    }
    if (opts?.categoria) {
      const cat = normalizarCategoriaMobilidade(row.categoria)
      if (cat !== opts.categoria) continue
    }
    const lat = row.latOrigem ?? row.latDestino
    const lng = row.lngOrigem ?? row.lngDestino
    if (lat == null || lng == null) continue
    if (opts?.cidade) {
      const match = row.cidades.some((c) => normalizarCidadeTriplice(c) === opts.cidade)
      if (!match) continue
    }
    const regiao = row.regiao?.trim() || regiaoMaisProxima(lat, lng)
    filtrados.push({ lat, lng, regiao })
  }

  if (modo === 'geral') {
    const map = new Map<string, PontoCalorMapa>()
    for (const p of filtrados) {
      const k = `${p.lat.toFixed(3)}-${p.lng.toFixed(3)}`
      const hit = map.get(k)
      if (hit) {
        hit.total += 1
        hit.intensidade = hit.total
      } else {
        map.set(k, {
          id: k,
          lat: p.lat,
          lng: p.lng,
          intensidade: 1,
          label: `${p.lat.toFixed(2)}, ${p.lng.toFixed(2)}`,
          total: 1,
        })
      }
    }
    return Array.from(map.values())
  }

  const porRegiao: Record<string, number> = {}
  for (const p of filtrados) {
    porRegiao[p.regiao] = (porRegiao[p.regiao] ?? 0) + 1
  }

  return REGIOES_TRIPLICE.map((r) => ({
    id: r.label,
    lat: r.lat,
    lng: r.lng,
    intensidade: porRegiao[r.label] ?? 0,
    label: r.label,
    total: porRegiao[r.label] ?? 0,
  })).filter((p) => p.total > 0 || filtrados.length === 0)
}

const ANTECEDENCIA_MINIMA_DIAS = 7

export function agregarAgendamentosAntecipados(
  rows: AtendimentoProjecaoRow[],
  opts?: {
    cidade?: CidadeTriplice | null
    categoria?: CategoriaMobilidade | null
  },
): AgendamentoMensal[] {
  const contagem: Record<string, { confirmados: number; pendentes: number }> = {}
  const chave = (mes: number) => `m-${mes}`

  for (const row of rows) {
    if (!row.dataAgendada) continue
    const agendada = new Date(row.dataAgendada)
    const criada = new Date(row.createdAt)
    if (Number.isNaN(agendada.getTime()) || Number.isNaN(criada.getTime())) continue
    const diffDias = (agendada.getTime() - criada.getTime()) / (1000 * 60 * 60 * 24)
    if (diffDias < ANTECEDENCIA_MINIMA_DIAS) continue
    if (opts?.cidade) {
      const match = row.cidades.some((c) => normalizarCidadeTriplice(c) === opts.cidade)
      if (!match) continue
    }
    if (opts?.categoria) {
      const cat = normalizarCategoriaMobilidade(row.categoria)
      if (cat !== opts.categoria) continue
    }
    const mes = agendada.getMonth()
    const k = chave(mes)
    if (!contagem[k]) contagem[k] = { confirmados: 0, pendentes: 0 }
    if (row.status === 'concluida' || row.status === 'aceita') {
      contagem[k].confirmados += 1
    } else if (row.status === 'pendente') {
      contagem[k].pendentes += 1
    }
  }

  const serie = MESES_LABEL.map((mesLabel, mes) => {
    const hit = contagem[chave(mes)] ?? { confirmados: 0, pendentes: 0 }
    return { mes, mesLabel, confirmados: hit.confirmados, pendentes: hit.pendentes, projecao: 0 }
  })

  const ultimos3 = serie.slice(-3).map((s) => s.confirmados + s.pendentes)
  const media =
    ultimos3.length > 0 ? ultimos3.reduce((a, b) => a + b, 0) / ultimos3.length : 0
  const hojeMes = new Date().getMonth()
  return serie.map((s, i) => ({
    ...s,
    projecao: i > hojeMes ? Math.round(media * (1 + (i - hojeMes) * 0.05)) : 0,
  }))
}

/** Converte linha legada de reservas (só check-in) para formato hospedagem. */
export function reservaLegadaParaHospedagem(dataCheckin: string): ReservaHospedagemRow {
  const checkin = parseDateOnly(dataCheckin)
  if (!checkin) {
    return { dataCheckin, dataCheckout: dataCheckin, status: 'confirmada' }
  }
  const checkout = new Date(checkin)
  checkout.setDate(checkout.getDate() + 1)
  return {
    dataCheckin: checkin.toISOString().slice(0, 10),
    dataCheckout: checkout.toISOString().slice(0, 10),
    status: 'confirmada',
  }
}
