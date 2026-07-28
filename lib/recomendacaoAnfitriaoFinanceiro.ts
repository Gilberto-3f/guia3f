import type { SupabaseClient } from '@supabase/supabase-js'
import { categoriasIncluemAnfitriao } from '@/lib/anfitriaoDualMode'
import { categoriaProfissionalParaSlug } from '@/lib/canaisProfissionalSlugs'
import { inserirNotificacaoCanalFinanceiroProfissional } from '@/lib/canalFinanceiroProfissional'
import {
  isStatusOfertaAtiva,
  type BeneficiosOfertaRecord,
} from '@/lib/comissoesBeneficiosInfo'
import { joinSupabaseRow } from '@/lib/supabaseJoinRow'

/** Labels de `comissao_oferta.categoria_profissional` (cadastro empresa). */
const SLUG_PARA_LABEL_COMISSAO: Record<string, string> = {
  motorista_app: 'Motorista de APP',
  guia: 'Guia de Turismo',
  van: 'Motorista de Van',
  taxista: 'Taxista',
  anfitriao: 'Anfitrião',
}

export type ParceiroFinanceiroMeta = {
  usuario_id: string
  profissional_id: string
  nome: string
  username: string
  foto_url: string | null
  categorias: string[]
}

export type ComissaoHospedagemMeta = {
  modelo: 'valor_fixo_diaria' | 'percentual_diaria'
  valor_unitario: number
  noites: number
  valor_diaria: number
  valor_total: number
  oferta_id: string | null
  categoria_profissional: string
  texto: string
}

function pickFotoProf(p: Record<string, unknown> | null | undefined): string | null {
  if (!p) return null
  if (p.foto_perfil_url != null && String(p.foto_perfil_url).trim()) return String(p.foto_perfil_url)
  if (p.foto_url != null && String(p.foto_url).trim()) return String(p.foto_url)
  return null
}

function usernameHandle(raw: unknown): string {
  const u = String(raw ?? '')
    .replace(/^@+/, '')
    .trim()
  return u ? `@${u}` : '—'
}

export function labelsComissaoParaCategoriasProfissional(
  categorias: string[] | null | undefined,
): string[] {
  const labels = new Set<string>()
  for (const c of categorias ?? []) {
    const slug = categoriaProfissionalParaSlug(c)
    const label = SLUG_PARA_LABEL_COMISSAO[slug]
    if (label) labels.add(label)
    const raw = String(c ?? '').trim()
    if (raw) labels.add(raw)
  }
  return [...labels]
}

/**
 * Calcula comissão de hospedagem (um modelo ativo: fixo/diária ou % da diária).
 * % = percentual informado × valor da diária × noites.
 */
export function calcularComissaoDiariasHospedagem(
  beneficios: BeneficiosOfertaRecord | null | undefined,
  valorDiaria: number,
  noites: number,
): Omit<ComissaoHospedagemMeta, 'oferta_id' | 'categoria_profissional'> | null {
  if (!beneficios || typeof beneficios !== 'object') return null
  const n = Math.max(0, Math.floor(Number(noites) || 0))
  const diaria = Number(valorDiaria) || 0
  if (n <= 0 || diaria < 0) return null

  const fixo = beneficios.valor_fixo_diaria
  const pct = beneficios.percentual_diaria

  const fixoObj =
    fixo && typeof fixo === 'object' && !Array.isArray(fixo)
      ? (fixo as { ativo?: boolean; valor?: number })
      : null
  const pctObj =
    pct && typeof pct === 'object' && !Array.isArray(pct)
      ? (pct as { ativo?: boolean; valor?: number })
      : null

  if (fixoObj?.ativo === true) {
    const unit = Number(fixoObj.valor) || 0
    const total = unit * n
    return {
      modelo: 'valor_fixo_diaria',
      valor_unitario: unit,
      noites: n,
      valor_diaria: diaria,
      valor_total: total,
      texto: `R$ ${total.toFixed(2)} (referente a ${n} diária${n === 1 ? '' : 's'} vendida${n === 1 ? '' : 's'}) a ser pago ao colega.`,
    }
  }

  if (pctObj?.ativo === true) {
    const unitPct = Number(pctObj.valor) || 0
    const total = (unitPct / 100) * diaria * n
    return {
      modelo: 'percentual_diaria',
      valor_unitario: unitPct,
      noites: n,
      valor_diaria: diaria,
      valor_total: total,
      texto: `R$ ${total.toFixed(2)} (${unitPct}% da diária × ${n} diária${n === 1 ? '' : 's'}) a ser pago ao colega.`,
    }
  }

  return null
}

export async function buscarOfertaComissaoAtivaHospedagem(
  supabase: SupabaseClient,
  empresaId: string,
  categoriasIndicador: string[] | null | undefined,
): Promise<{
  ofertaId: string
  categoria: string
  beneficios: BeneficiosOfertaRecord
} | null> {
  const empId = String(empresaId ?? '').trim()
  if (!empId) return null

  const labels = labelsComissaoParaCategoriasProfissional(categoriasIndicador)
  if (labels.length === 0) return null

  const { data: rows } = await supabase
    .from('comissao_oferta')
    .select('id, categoria_profissional, beneficios, status, created_at')
    .eq('empresa_id', empId)
    .in('categoria_profissional', labels)
    .order('created_at', { ascending: false })

  for (const row of rows ?? []) {
    if (!isStatusOfertaAtiva(String(row.status ?? ''))) continue
    const beneficios =
      row.beneficios && typeof row.beneficios === 'object' && !Array.isArray(row.beneficios)
        ? (row.beneficios as BeneficiosOfertaRecord)
        : null
    if (!beneficios) continue
    return {
      ofertaId: String(row.id),
      categoria: String(row.categoria_profissional ?? ''),
      beneficios,
    }
  }
  return null
}

export function mapParceiroFinanceiroMeta(
  p: Record<string, unknown> | null | undefined,
): ParceiroFinanceiroMeta | null {
  if (!p?.id || !p?.usuario_id) return null
  const cats = Array.isArray(p.categorias) ? p.categorias.map(String) : []
  return {
    usuario_id: String(p.usuario_id),
    profissional_id: String(p.id),
    nome: String(p.nome_completo ?? 'Profissional'),
    username: usernameHandle(p.nome_usuario),
    foto_url: pickFotoProf(p),
    categorias: cats,
  }
}

/** Ao criar recomendação: anfitrião indicado recebe “Você foi recomendado!”. */
export async function notificarAnfitriaoFoiRecomendado(
  supabase: SupabaseClient,
  params: {
    recomendacaoId: string
    indicadoUsuarioId: string
    indicador: ParceiroFinanceiroMeta
    recomendadoEm?: string
  },
): Promise<void> {
  const indicadoUid = String(params.indicadoUsuarioId ?? '').trim()
  if (!indicadoUid || !params.recomendacaoId) return

  await inserirNotificacaoCanalFinanceiroProfissional(supabase, {
    profissionalUsuarioId: indicadoUid,
    tipo: 'extrato_parceria',
    titulo: 'Você foi recomendado!',
    mensagem:
      'Um colega do ecossistema recomendou você para um turista, quando o novo cliente iniciar sua contratação você será notificado. Aguarde a confirmação por gentileza!',
    comprovanteDetalhes: {
      kind: 'anfitriao_foi_recomendado',
      recomendacao_id: params.recomendacaoId,
      parceiro: params.indicador,
      recomendado_em: params.recomendadoEm ?? new Date().toISOString(),
    },
  })
}

/** Parceiro indicador: turista contratou hospedagem via sua recomendação. */
export async function notificarIndicadorContratacaoHospedagem(
  supabase: SupabaseClient,
  params: {
    indicadorUsuarioId: string
    recomendacaoId: string
    reservaId: string
    indicado: ParceiroFinanceiroMeta | null
    comissao: ComissaoHospedagemMeta | null
  },
): Promise<void> {
  const uid = String(params.indicadorUsuarioId ?? '').trim()
  if (!uid) return

  await inserirNotificacaoCanalFinanceiroProfissional(supabase, {
    profissionalUsuarioId: uid,
    tipo: 'extrato_comissao',
    titulo: 'Contratação (sua recomendação)',
    mensagem:
      'O turista que você recomendou contratou os serviços do seu colega do ecossistema, aguarde o contato para pagamento da sua bonificação!',
    valor: params.comissao?.valor_total ?? null,
    comprovanteDetalhes: {
      kind: 'indicador_contratacao_hospedagem',
      recomendacao_id: params.recomendacaoId,
      reserva_id: params.reservaId,
      colega: params.indicado,
      comissao: params.comissao,
    },
  })
}

/**
 * Base pronta: anfitrião recomendou profissional e houve contratação.
 * Lapidar no módulo manifesto/mobilidade (comissões 50/50, rota, etc.).
 */
export async function notificarAnfitriaoPropostaParceriaBase(
  supabase: SupabaseClient,
  params: {
    anfitriaoUsuarioId: string
    recomendacaoId: string
    parceriaId?: string | null
    colega: ParceiroFinanceiroMeta | null
  },
): Promise<void> {
  const uid = String(params.anfitriaoUsuarioId ?? '').trim()
  if (!uid) return

  await inserirNotificacaoCanalFinanceiroProfissional(supabase, {
    profissionalUsuarioId: uid,
    tipo: 'extrato_parceria',
    titulo: 'Proposta de parceria!',
    mensagem:
      'O colega do ecossistema que você recomendou teve seus serviços contratado e ele aceitou a parceria 50/50 contigo, acompanhe o andamento da parceria pelo menu lateral!',
    comprovanteDetalhes: {
      kind: 'proposta_parceria_base',
      recomendacao_id: params.recomendacaoId,
      parceria_id: params.parceriaId ?? null,
      colega: params.colega,
      // Flags para lapidar no módulo de mobilidade:
      bonificacao_venda_servico_regular: true,
      bonificacao_parceria_empresas_50_50: true,
      pendente_modulo_mobilidade: true,
    },
  })
}

export async function carregarParceiroDeRecomendacao(
  supabase: SupabaseClient,
  recomendacaoId: string,
): Promise<{
  recomendacaoId: string
  indicador: ParceiroFinanceiroMeta | null
  indicado: ParceiroFinanceiroMeta | null
  indicadorEhAnfitriao: boolean
  indicadoEhAnfitriao: boolean
  indicadoEmpresaHospedagemId: string | null
  contratadoEm: string | null
} | null> {
  const recId = String(recomendacaoId ?? '').trim()
  if (!recId) return null

  const { data: rec } = await supabase
    .from('recomendacoes_profissional')
    .select(
      `
      id,
      contratado_em,
      profissional_indicador:profissional_indicador_id (
        id, usuario_id, nome_completo, nome_usuario, foto_perfil_url, foto_url, categorias
      ),
      profissional_indicado:profissional_indicado_id (
        id, usuario_id, nome_completo, nome_usuario, foto_perfil_url, foto_url, categorias, empresa_hospedagem_id
      )
    `,
    )
    .eq('id', recId)
    .maybeSingle()

  if (!rec) return null

  const indicadorRaw = joinSupabaseRow(rec.profissional_indicador)
  const indicadoRaw = joinSupabaseRow(rec.profissional_indicado)
  const indicador = mapParceiroFinanceiroMeta(indicadorRaw)
  const indicado = mapParceiroFinanceiroMeta(indicadoRaw)
  const catsIndicador = indicador?.categorias ?? []
  const catsIndicado = indicado?.categorias ?? []

  return {
    recomendacaoId: recId,
    indicador,
    indicado,
    indicadorEhAnfitriao: categoriasIncluemAnfitriao(catsIndicador),
    indicadoEhAnfitriao: categoriasIncluemAnfitriao(catsIndicado),
    indicadoEmpresaHospedagemId:
      indicadoRaw?.empresa_hospedagem_id != null
        ? String(indicadoRaw.empresa_hospedagem_id)
        : null,
    contratadoEm: rec.contratado_em != null ? String(rec.contratado_em) : null,
  }
}
