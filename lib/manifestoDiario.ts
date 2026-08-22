import type { SupabaseClient } from '@supabase/supabase-js'
import { inserirNotificacaoCanalFinanceiroProfissional } from '@/lib/canalFinanceiroProfissional'
import {
  confirmarCheckInItinerario,
  inserirParadasItinerario,
} from '@/lib/itinerarioParadas'
import { profissionalEhGuia } from '@/lib/profissionalCategoriaManifesto'

export type ManifestoDiarioStatus =
  | 'rascunho'
  | 'confirmado'
  | 'em_andamento'
  | 'concluido'
  | 'cancelado'

export type ContratacaoTipo = 'indicacao' | 'contratacao_direta' | 'agendamento' | 'algoritmo'

export type MetodoValidacaoCheckin = 'gps' | 'qr_code' | 'manual'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function filtrarEmpresaIds(ids: string[]): string[] {
  return [...new Set(ids.filter((id) => UUID_RE.test(id)))]
}

const ROTULO_CONTRATACAO: Record<ContratacaoTipo, string> = {
  indicacao: 'Indicação',
  contratacao_direta: 'Contratação direta',
  agendamento: 'Agendamento',
  algoritmo: 'Algoritmo',
}

export function rotuloContratacao(tipo: string): string {
  return ROTULO_CONTRATACAO[tipo as ContratacaoTipo] ?? tipo
}

export async function buscarProfissionalPlacaVermelha(
  supabase: SupabaseClient,
  usuarioId: string,
): Promise<{ id: string; placa_vermelha: boolean; categorias: unknown } | null> {
  const { data } = await supabase
    .from('profissionais')
    .select('id, placa_vermelha, categorias')
    .eq('usuario_id', usuarioId)
    .maybeSingle()

  if (!data?.id) return null
  return {
    id: String(data.id),
    placa_vermelha: Boolean(data.placa_vermelha),
    categorias: data.categorias,
  }
}

export async function obterOuCriarManifestoDiario(
  supabase: SupabaseClient,
  profissionalId: string,
  dataManifesto: string,
  statusInicial: ManifestoDiarioStatus = 'em_andamento',
): Promise<{ id: string; created: boolean } | { error: string }> {
  const { data: existente } = await supabase
    .from('manifesto_diario')
    .select('id, status')
    .eq('profissional_id', profissionalId)
    .eq('data_manifesto', dataManifesto)
    .not('status', 'in', '("cancelado","concluido")')
    .maybeSingle()

  if (existente?.id) return { id: String(existente.id), created: false }

  const { data: novo, error } = await supabase
    .from('manifesto_diario')
    .insert({
      profissional_id: profissionalId,
      data_manifesto: dataManifesto,
      status: statusInicial,
    })
    .select('id')
    .maybeSingle()

  if (error) return { error: error.message }
  return { id: String(novo!.id), created: true }
}

export type DadosPaxManifesto = {
  nome: string
  documento?: string | null
  username?: string | null
  nome_social?: string | null
  data_nascimento?: string | null
  foto_url?: string | null
  validada?: boolean
}

export type InserirPassageiroParams = {
  manifestoId: string
  turistaUsuarioId: string
  nome: string
  documento?: string | null
  username?: string | null
  nome_social?: string | null
  data_nascimento?: string | null
  foto_url?: string | null
  contratacaoTipo: ContratacaoTipo
  profissionalIndiretoId?: string | null
  legacyManifestoId?: string | null
  contratacaoValidada?: boolean
  solicitacaoId?: string | null
}

export async function inserirPassageiroManifesto(
  supabase: SupabaseClient,
  params: InserirPassageiroParams,
): Promise<{ id: string } | { error: string }> {
  const { data: dup } = await supabase
    .from('manifesto_passageiros')
    .select('id')
    .eq('manifesto_id', params.manifestoId)
    .eq('turista_id', params.turistaUsuarioId)
    .maybeSingle()

  if (dup?.id) {
    if (params.contratacaoValidada || params.solicitacaoId) {
      await supabase
        .from('manifesto_passageiros')
        .update({
          ...(params.contratacaoValidada
            ? {
                nome: params.nome,
                documento: params.documento ?? null,
                data_nascimento: params.data_nascimento ?? null,
                nome_social: params.nome_social ?? null,
                contratacao_validada_em: new Date().toISOString(),
              }
            : {}),
          ...(params.solicitacaoId ? { solicitacao_id: params.solicitacaoId } : {}),
        })
        .eq('id', dup.id)
    }
    return { id: String(dup.id) }
  }

  const { count } = await supabase
    .from('manifesto_passageiros')
    .select('id', { count: 'exact', head: true })
    .eq('manifesto_id', params.manifestoId)

  const agora = params.contratacaoValidada ? new Date().toISOString() : null

  const { data, error } = await supabase
    .from('manifesto_passageiros')
    .insert({
      manifesto_id: params.manifestoId,
      turista_id: params.turistaUsuarioId,
      ordem: (count ?? 0) + 1,
      nome: params.nome,
      documento: params.documento ?? null,
      username: params.username ?? null,
      nome_social: params.nome_social ?? null,
      data_nascimento: params.data_nascimento ?? null,
      foto_url: params.foto_url ?? null,
      contratacao_tipo: params.contratacaoTipo,
      profissional_indireto_id: params.profissionalIndiretoId ?? null,
      legacy_manifesto_id: params.legacyManifestoId ?? null,
      contratacao_validada_em: agora,
      solicitacao_id: params.solicitacaoId ?? null,
    })
    .select('id')
    .maybeSingle()

  if (error) return { error: error.message }
  return { id: String(data!.id) }
}

/** Registra turista no manifesto diário (PAX) e opcionalmente paradas no itinerário. */
export async function registrarTuristaNoManifesto(
  supabase: SupabaseClient,
  params: {
    profissionalId: string
    turistaUsuarioId: string
    contratacaoTipo: ContratacaoTipo
    profissionalIndiretoId?: string | null
    dataManifesto?: string
    paradasEmpresaIds?: string[]
    legacyManifestoId?: string | null
    dadosPax?: DadosPaxManifesto
    solicitacaoId?: string | null
  },
): Promise<{ manifestoId: string; passageiroId: string } | { error: string }> {
  const dataManifesto = params.dataManifesto ?? new Date().toISOString().slice(0, 10)

  const diario = await obterOuCriarManifestoDiario(supabase, params.profissionalId, dataManifesto, 'em_andamento')
  if ('error' in diario) return { error: diario.error }

  let nome = params.dadosPax?.nome ?? 'Turista'
  let documento = params.dadosPax?.documento ?? null
  let username = params.dadosPax?.username ?? null
  let nome_social = params.dadosPax?.nome_social ?? null
  let data_nascimento = params.dadosPax?.data_nascimento ?? null
  let foto_url = params.dadosPax?.foto_url ?? null
  let validada = params.dadosPax?.validada === true

  // Sempre completa a partir do cadastro do turista (campos faltantes / fluxo automático).
  {
    const { data: tur } = await supabase
      .from('turistas')
      .select('nome_completo, nome_usuario, documento_identidade, foto_url, foto_perfil_url')
      .eq('usuario_id', params.turistaUsuarioId)
      .maybeSingle()
    if (tur) {
      if (!params.dadosPax?.nome?.trim()) {
        nome = String(tur.nome_completo ?? nome)
      }
      if (!documento && tur.documento_identidade != null) {
        documento = String(tur.documento_identidade)
      }
      const un = tur.nome_usuario != null ? String(tur.nome_usuario).replace(/^@+/, '') : ''
      if (!username && un) username = `@${un}`
      if (!nome_social && un) nome_social = un
      if (!foto_url) {
        foto_url =
          tur.foto_perfil_url != null
            ? String(tur.foto_perfil_url)
            : tur.foto_url != null
              ? String(tur.foto_url)
              : null
      }
    }
  }

  // Cadastro com nome + documento = dados prontos para o manifesto (sem popup manual).
  if (!validada && nome.trim() && documento?.trim()) {
    validada = true
  }

  const passageiro = await inserirPassageiroManifesto(supabase, {
    manifestoId: diario.id,
    turistaUsuarioId: params.turistaUsuarioId,
    nome,
    documento,
    username,
    nome_social,
    data_nascimento,
    foto_url,
    contratacaoTipo: params.contratacaoTipo,
    profissionalIndiretoId: params.profissionalIndiretoId ?? null,
    legacyManifestoId: params.legacyManifestoId ?? null,
    contratacaoValidada: validada,
    solicitacaoId: params.solicitacaoId ?? null,
  })

  if ('error' in passageiro) return { error: passageiro.error }

  if (params.paradasEmpresaIds?.length) {
    await inserirParadasItinerario(supabase, {
      manifestoId: diario.id,
      turistaUsuarioId: params.turistaUsuarioId,
      empresaIds: params.paradasEmpresaIds,
      profissionalIndiretoId: params.profissionalIndiretoId ?? null,
    })
  }

  return { manifestoId: diario.id, passageiroId: passageiro.id }
}

export async function confirmarCheckInManifesto(
  supabase: SupabaseClient,
  params: {
    manifestoId: string
    empresaId: string
    turistaUsuarioId?: string | null
    metodo: MetodoValidacaoCheckin
  },
): Promise<{ ok: boolean; error?: string }> {
  return confirmarCheckInItinerario(supabase, params)
}

export async function concluirManifestoDiario(
  supabase: SupabaseClient,
  manifestoId: string,
  profissionalId: string,
  opts?: { pularCheckin?: boolean },
): Promise<{ ok: boolean; error?: string }> {
  const { data: md, error: mdErr } = await supabase
    .from('manifesto_diario')
    .select('id, status, profissional_id')
    .eq('id', manifestoId)
    .eq('profissional_id', profissionalId)
    .maybeSingle()

  if (mdErr || !md) return { ok: false, error: 'Manifesto não encontrado.' }
  if (String(md.status) === 'concluido') return { ok: true }

  const { data: prof } = await supabase
    .from('profissionais')
    .select('usuario_id, nome_completo, categorias')
    .eq('id', profissionalId)
    .maybeSingle()

  const ehGuia = profissionalEhGuia(prof?.categorias)

  const { data: paradas } = await supabase
    .from('itinerario_paradas')
    .select('id, visitado')
    .eq('manifesto_id', manifestoId)

  const qtdParadas = paradas?.length ?? 0
  if (ehGuia && qtdParadas > 0 && opts?.pularCheckin !== true) {
    const pendentes = (paradas ?? []).filter((a) => !a.visitado)
    if (pendentes.length > 0) {
      return { ok: false, error: 'Confirme check-in em todas as paradas do itinerário antes de concluir.' }
    }
  }

  const agora = new Date().toISOString()
  const { error: updErr } = await supabase
    .from('manifesto_diario')
    .update({ status: 'concluido', concluido_em: agora, updated_at: agora })
    .eq('id', manifestoId)

  if (updErr) return { ok: false, error: updErr.message }

  const { data: passageiros } = await supabase
    .from('manifesto_passageiros')
    .select('nome, profissional_indireto_id, turista_id')
    .eq('manifesto_id', manifestoId)

  const qtdPax = passageiros?.length ?? 0

  if (prof?.usuario_id) {
    await inserirNotificacaoCanalFinanceiroProfissional(supabase, {
      profissionalUsuarioId: String(prof.usuario_id),
      tipo: 'extrato_comissao',
      titulo: 'Manifesto concluído — resumo do dia',
      mensagem: `Manifesto concluído com ${qtdPax} passageiro(s) e ${qtdParadas} parada(s) no itinerário.`,
      comprovanteDetalhes: {
        manifesto_id: manifestoId,
        qtd_passageiros: qtdPax,
        qtd_paradas: qtdParadas,
      },
    })
  }

  const indiretosVistos = new Set<string>()
  for (const p of passageiros ?? []) {
    const indId = p.profissional_indireto_id != null ? String(p.profissional_indireto_id) : ''
    if (!indId || indiretosVistos.has(indId)) continue
    indiretosVistos.add(indId)

    const { data: pi } = await supabase
      .from('profissionais')
      .select('usuario_id')
      .eq('id', indId)
      .maybeSingle()

    if (pi?.usuario_id) {
      await inserirNotificacaoCanalFinanceiroProfissional(supabase, {
        profissionalUsuarioId: String(pi.usuario_id),
        tipo: 'manifesto_indicacao',
        titulo: 'Manifesto concluído — benefícios de parceria',
        mensagem: `O manifesto com turista ${String(p.nome)} foi concluído. Consulte o Canal Financeiro para os benefícios da parceria 50/50.`,
        comprovanteDetalhes: { manifesto_id: manifestoId, turista_nome: p.nome },
      })
    }
  }

  const turistaIds = (passageiros ?? [])
    .map((p) => (p.turista_id != null ? String(p.turista_id) : ''))
    .filter(Boolean)

  if (turistaIds.length > 0) {
    await supabase
      .from('parcerias_profissionais')
      .update({ status: 'concluida' })
      .in('turista_usuario_id', turistaIds)
      .eq('status', 'em_andamento')
  }

  return { ok: true }
}

// Re-export itinerário para compatibilidade
export { inserirParadasItinerario, inserirParadasItinerario as inserirAtrativosManifesto } from '@/lib/itinerarioParadas'
