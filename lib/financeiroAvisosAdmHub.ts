import type { SupabaseClient } from '@supabase/supabase-js'
import type { ModalidadePlanoEmpresa } from '@/lib/contratarPlanoEmpresa'

export type VisivelAvisoAdmHub = 'adm_geral' | 'adm_financeiro'

const VISIVEL_AVISO_ADM_HUB = new Set<VisivelAvisoAdmHub>(['adm_geral', 'adm_financeiro'])

/** Normaliza valores do banco para o union tipado. */
export function parseVisivelParaAvisoAdmHub(raw: unknown): VisivelAvisoAdmHub[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map(String)
    .filter((v): v is VisivelAvisoAdmHub => VISIVEL_AVISO_ADM_HUB.has(v as VisivelAvisoAdmHub))
}

export type FinanceiroAvisoAdmHubRow = {
  id: string
  tipo: string
  titulo: string
  mensagem: string
  visivel_para: VisivelAvisoAdmHub[]
  metadata: Record<string, unknown>
  lido_por: string[]
  created_at: string
}

export type EmpresaPerfilAvisoHub = {
  empresaId: string
  empresaUsername: string
  empresaNomeSocial: string
  empresaFotoUrl: string | null
}

export function adminPodeVerAvisosFinanceiroHub(admin: {
  admin_level?: number | null
  admin_permissoes?: unknown
} | null): boolean {
  if (!admin) return false
  const nivel = Number(admin.admin_level ?? 0)
  const cargo = (admin.admin_permissoes as { cargo?: string } | null)?.cargo
  return nivel === 1 || nivel === 3 || cargo === 'FINANCEIRO'
}

export function filtrarAvisosFinanceiroHubPorAdmin<T extends { visivel_para: string[] }>(
  avisos: T[],
  admin: { admin_level?: number | null; admin_permissoes?: unknown },
): T[] {
  const nivel = Number(admin.admin_level ?? 0)
  const cargo = (admin.admin_permissoes as { cargo?: string } | null)?.cargo
  const ehGeral = nivel === 1
  const ehFinanceiro = nivel === 3 || cargo === 'FINANCEIRO'

  return avisos.filter((a) => {
    const tags = Array.isArray(a.visivel_para) ? a.visivel_para : []
    if (ehGeral && tags.includes('adm_geral')) return true
    if (ehFinanceiro && tags.includes('adm_financeiro')) return true
    return false
  })
}

export function formatarDataCurtaAgendamento(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  } catch {
    return iso
  }
}

/** Texto de validade do plano para cards do hub (ex.: "1 mês", "3 meses"). */
export function textoValidadeModalidadePlano(modalidade: ModalidadePlanoEmpresa): string {
  if (modalidade === 'trimestral') return '3 meses'
  if (modalidade === 'anual') return '12 meses'
  return '1 mês'
}

export function montarMensagemNovaAssinaturaHub(params: {
  planoTitulo: string
  assinadoEm: string
  modalidade: ModalidadePlanoEmpresa
}): string {
  const dataCurta = formatarDataCurtaAgendamento(params.assinadoEm)
  const validade = textoValidadeModalidadePlano(params.modalidade)
  const plano = params.planoTitulo.trim() || 'Plano'
  return `Usuário assinou o Plano ${plano} no dia ${dataCurta} com validade para ${validade}.`
}

export function montarMensagemAgendamentoAssinaturaHub(params: {
  planoTitulo: string
  assinadoEm: string
  modalidade: ModalidadePlanoEmpresa
  visitaAgendadaEm: string
}): string {
  const dataCurta = formatarDataCurtaAgendamento(params.assinadoEm)
  const dataVisita = formatarDataCurtaAgendamento(params.visitaAgendadaEm)
  const validade = textoValidadeModalidadePlano(params.modalidade)
  const plano = params.planoTitulo.trim() || 'Plano'
  return `Usuário assinou o Plano ${plano} no dia ${dataCurta} com validade para ${validade} e agendou o pagamento para o dia do trabalho fotográfico, no dia ${dataVisita} (mais informações na página do ESPAÇO ADM).`
}

function metadataEmpresaHub(
  perfil: EmpresaPerfilAvisoHub,
  extra: Record<string, unknown>,
): Record<string, unknown> {
  return {
    empresa_id: perfil.empresaId,
    empresa_username: perfil.empresaUsername,
    empresa_nome_social: perfil.empresaNomeSocial,
    empresa_foto_url: perfil.empresaFotoUrl,
    ...extra,
  }
}

async function inserirAvisoHub(
  supabase: SupabaseClient,
  row: {
    tipo: string
    titulo: string
    mensagem: string
    metadata: Record<string, unknown>
  },
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const { data, error } = await supabase
    .from('financeiro_avisos_adm_hub')
    .insert({
      tipo: row.tipo,
      titulo: row.titulo,
      mensagem: row.mensagem,
      visivel_para: ['adm_geral', 'adm_financeiro'],
      metadata: row.metadata,
    })
    .select('id')
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  return { ok: true, id: data?.id != null ? String(data.id) : undefined }
}

/** Card no Canal Financeiro ADM — assinatura imediata (PIX/cartão) ou qualquer plano ativo. */
export async function inserirAvisoNovaAssinaturaHub(
  supabase: SupabaseClient,
  params: {
    assinaturaId: string
    planoTitulo: string
    modalidade: ModalidadePlanoEmpresa
    assinadoEm: string
    empresa: EmpresaPerfilAvisoHub
  },
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const mensagem = montarMensagemNovaAssinaturaHub({
    planoTitulo: params.planoTitulo,
    assinadoEm: params.assinadoEm,
    modalidade: params.modalidade,
  })

  return inserirAvisoHub(supabase, {
    tipo: 'nova_assinatura',
    titulo: 'Nova Assinatura',
    mensagem,
    metadata: metadataEmpresaHub(params.empresa, {
      assinatura_id: params.assinaturaId,
      plano_titulo: params.planoTitulo,
      modalidade: params.modalidade,
      assinado_em: params.assinadoEm,
      validade_texto: textoValidadeModalidadePlano(params.modalidade),
    }),
  })
}

/** Card no Canal Financeiro ADM — pagamento em dinheiro + visita fotográfica agendada. */
export async function inserirAvisoAgendamentoAssinaturaDinheiroHub(
  supabase: SupabaseClient,
  params: {
    assinaturaId: string
    planoTitulo: string
    modalidade: ModalidadePlanoEmpresa
    assinadoEm: string
    visitaAgendadaEm: string
    empresa: EmpresaPerfilAvisoHub
  },
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const mensagem = montarMensagemAgendamentoAssinaturaHub({
    planoTitulo: params.planoTitulo,
    assinadoEm: params.assinadoEm,
    modalidade: params.modalidade,
    visitaAgendadaEm: params.visitaAgendadaEm,
  })

  return inserirAvisoHub(supabase, {
    tipo: 'agendamento_assinatura_dinheiro',
    titulo: 'Agendamento',
    mensagem,
    metadata: metadataEmpresaHub(params.empresa, {
      assinatura_id: params.assinaturaId,
      plano_titulo: params.planoTitulo,
      modalidade: params.modalidade,
      assinado_em: params.assinadoEm,
      visita_agendada_em: params.visitaAgendadaEm,
      validade_texto: textoValidadeModalidadePlano(params.modalidade),
    }),
  })
}

/** Contagem de cards não lidos no hub (badge do canal Financeiro ADM). */
export async function contarAvisosFinanceiroHubNaoLidos(
  supabase: SupabaseClient,
  adminUserId: string,
  admin: { admin_level?: number | null; admin_permissoes?: unknown },
): Promise<number> {
  if (!adminUserId || !adminPodeVerAvisosFinanceiroHub(admin)) return 0

  const { data, error } = await supabase.rpc('contar_financeiro_avisos_hub_nao_lidos', {
    p_limite: 50,
  })

  if (error) {
    console.error('contarAvisosFinanceiroHubNaoLidos:', error)
    return 0
  }

  const n = Number(data)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}
