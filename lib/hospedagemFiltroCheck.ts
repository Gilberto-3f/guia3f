import type { SupabaseClient } from '@supabase/supabase-js'
import {
  COMODIDADES_EXTRAS_LISTA,
  ITENS_PARTICULARES,
  REFEICOES_EXTRAS,
  parseComodidadesExtras,
  parseComodidadesPadrao,
  type ComodidadesExtras,
  type ComodidadesPadrao,
} from '@/lib/hospedagemAcomodacoesCatalogo'
import {
  adicionarDias,
  dataNoPeriodoOcupado,
  type PeriodoOcupacao,
} from '@/lib/hospedagemCalendario'

/** Opções do questionário (padrão + extras) para checkboxes. */
export const COMODIDADES_FILTRO_CHECK: ReadonlyArray<{ value: string; label: string; grupo: string }> = [
  { value: 'padrao:cafe_manha', label: 'Café da manhã', grupo: 'Padrão' },
  { value: 'padrao:ar_condicionado', label: 'Ar-condicionado', grupo: 'Padrão' },
  { value: 'padrao:wifi', label: 'Wi-Fi', grupo: 'Padrão' },
  { value: 'padrao:estacionamento', label: 'Estacionamento', grupo: 'Padrão' },
  { value: 'padrao:banheiro_particular', label: 'Banheiro particular', grupo: 'Padrão' },
  { value: 'padrao:banheiro_compartilhado', label: 'Banheiro compartilhado', grupo: 'Padrão' },
  { value: 'padrao:fumantes_livre', label: 'Fumantes (livre)', grupo: 'Padrão' },
  { value: 'padrao:fumantes_proibido', label: 'Proibido fumar', grupo: 'Padrão' },
  { value: 'padrao:lavanderia', label: 'Lavanderia', grupo: 'Padrão' },
  { value: 'padrao:maleiro', label: 'Maleiro', grupo: 'Padrão' },
  { value: 'padrao:guarda_volumes', label: 'Guarda Volumes', grupo: 'Padrão' },
  { value: 'padrao:servico_limpeza', label: 'Serviço de Limpeza', grupo: 'Padrão' },
  { value: 'padrao:pet_friendly', label: 'Pet Friendly', grupo: 'Padrão' },
  ...COMODIDADES_EXTRAS_LISTA.map((c) => ({
    value: `extra:${c.value}`,
    label: c.label,
    grupo: 'Extras',
  })),
  ...ITENS_PARTICULARES.map((c) => ({
    value: `item:${c.value}`,
    label: c.label,
    grupo: 'Itens particulares',
  })),
  ...REFEICOES_EXTRAS.map((c) => ({
    value: `refeicao:${c.value}`,
    label: c.label,
    grupo: 'Refeições extras',
  })),
]

export type CriteriosFiltroHospedagemCheck = {
  data: string
  pessoas: number
  comodidades: string[]
  ordenarPorPreco: boolean
}

export type ResultadoFiltroHospedagemCheck = {
  empresaIds: string[]
  /** Menor diária entre acomodações que bateram o filtro (para ordenar). */
  precoMinPorEmpresa: Record<string, number>
}

function acomodacaoTemComodidade(
  padrao: ComodidadesPadrao,
  extras: ComodidadesExtras,
  chave: string,
): boolean {
  if (chave.startsWith('padrao:')) {
    const k = chave.slice('padrao:'.length)
    if (k === 'banheiro_particular') return padrao.banheiro === 'particular'
    if (k === 'banheiro_compartilhado') return padrao.banheiro === 'compartilhado'
    if (k === 'fumantes_livre') return padrao.fumantes === 'livre'
    if (k === 'fumantes_proibido') return padrao.fumantes === 'proibido'
    if (k === 'pet_friendly') return padrao.pet_friendly === true
    const v = padrao[k as keyof ComodidadesPadrao]
    return v === true
  }
  if (chave.startsWith('extra:')) {
    return extras.selecionados.includes(chave.slice('extra:'.length))
  }
  if (chave.startsWith('item:')) {
    return extras.itens_particulares.includes(chave.slice('item:'.length))
  }
  if (chave.startsWith('refeicao:')) {
    return extras.refeicoes_extras.includes(chave.slice('refeicao:'.length))
  }
  return false
}

async function carregarPeriodosEmLote(
  supabase: SupabaseClient,
  acomodacaoIds: string[],
): Promise<Record<string, PeriodoOcupacao[]>> {
  const map: Record<string, PeriodoOcupacao[]> = {}
  for (const id of acomodacaoIds) map[id] = []
  if (acomodacaoIds.length === 0) return map

  const { data: reservas } = await supabase
    .from('reservas_hospedagem')
    .select('id, acomodacao_id, data_checkin, data_checkout, status')
    .in('acomodacao_id', acomodacaoIds)
    .in('status', ['pendente', 'confirmada'])

  for (const r of reservas ?? []) {
    const aid = r.acomodacao_id != null ? String(r.acomodacao_id) : ''
    if (!aid || !map[aid]) continue
    map[aid].push({
      inicio: String(r.data_checkin).slice(0, 10),
      fim: String(r.data_checkout).slice(0, 10),
      origem: 'reserva',
      reservaId: String(r.id),
      status: String(r.status),
    })
  }

  const { data: bloqueios } = await supabase
    .from('hospedagem_bloqueios_calendario')
    .select('acomodacao_id, data_inicio, data_fim')
    .in('acomodacao_id', acomodacaoIds)

  for (const b of bloqueios ?? []) {
    const aid = b.acomodacao_id != null ? String(b.acomodacao_id) : ''
    if (!aid || !map[aid]) continue
    map[aid].push({
      inicio: String(b.data_inicio).slice(0, 10),
      fim: adicionarDias(String(b.data_fim).slice(0, 10), 1),
      origem: 'bloqueio',
    })
  }

  return map
}

/**
 * Filtra empresas de hospedagem cujas acomodações batem com o questionário do Check.
 * Retorna IDs de empresa (não cards de quarto).
 */
export async function filtrarEmpresasPorQuestionarioHospedagem(
  supabase: SupabaseClient,
  empresaIds: string[],
  criterios: CriteriosFiltroHospedagemCheck,
): Promise<ResultadoFiltroHospedagemCheck> {
  const ids = [...new Set(empresaIds.map(String).filter(Boolean))]
  if (ids.length === 0) return { empresaIds: [], precoMinPorEmpresa: {} }

  const data = String(criterios.data ?? '').slice(0, 10)
  const pessoas = Math.max(1, Math.floor(Number(criterios.pessoas) || 1))
  const comodidades = Array.isArray(criterios.comodidades) ? criterios.comodidades : []

  if (!data) return { empresaIds: [], precoMinPorEmpresa: {} }

  const { data: acoms, error } = await supabase
    .from('hospedagem_acomodacoes')
    .select('id, empresa_id, capacidade_pessoas, valor_diaria, comodidades_padrao, comodidades_extras')
    .in('empresa_id', ids)

  if (error || !acoms?.length) return { empresaIds: [], precoMinPorEmpresa: {} }

  const acomodacaoIds = acoms.map((a) => String(a.id))
  const periodosMap = await carregarPeriodosEmLote(supabase, acomodacaoIds)

  const precoMinPorEmpresa: Record<string, number> = {}
  const empresasOk = new Set<string>()

  for (const raw of acoms) {
    const empresaId = String(raw.empresa_id)
    const acomodacaoId = String(raw.id)
    const capacidade = Number(raw.capacidade_pessoas) || 0
    const valor = Number(raw.valor_diaria) || 0
    const periodos = periodosMap[acomodacaoId] ?? []

    if (capacidade < pessoas) continue
    if (periodos.some((p) => dataNoPeriodoOcupado(data, p.inicio, p.fim))) continue

    const padrao = parseComodidadesPadrao(raw.comodidades_padrao)
    const extras = parseComodidadesExtras(raw.comodidades_extras)

    if (comodidades.length > 0) {
      const ok = comodidades.every((c) => acomodacaoTemComodidade(padrao, extras, c))
      if (!ok) continue
    }

    empresasOk.add(empresaId)
    const atual = precoMinPorEmpresa[empresaId]
    if (atual == null || valor < atual) precoMinPorEmpresa[empresaId] = valor
  }

  let resultado = [...empresasOk]

  if (criterios.ordenarPorPreco) {
    resultado.sort((a, b) => {
      const pa = precoMinPorEmpresa[a] ?? Infinity
      const pb = precoMinPorEmpresa[b] ?? Infinity
      return pa - pb
    })
  }

  return { empresaIds: resultado, precoMinPorEmpresa }
}
