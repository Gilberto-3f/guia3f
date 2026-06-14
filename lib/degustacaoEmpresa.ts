import type { SupabaseClient } from '@supabase/supabase-js'
import type { ServicoPlanoId } from '@/lib/planosEmpresaCatalogo'
import { empresaRecursosLiberados } from '@/lib/verificacao-documentos'
import { inserirNotificacaoCanalFinanceiroEmpresa } from '@/lib/canalFinanceiroEmpresa'
import { normalizarPlanoSlug } from '@/lib/planosEmpresaServicosGate'

export const TITULO_DEGUSTACAO_CANAL = 'Degustação do aplicativo'

export type DegustacaoEmpresaRow = {
  id: string
  empresa_id: string
  dias: number
  status: 'aguardando_aceite' | 'ativa' | 'expirada' | 'cancelada'
  canal_financeiro_id: string | null
  aceito_em: string | null
  inicio_em: string | null
  expira_em: string | null
}

export function labelStatusEmpresaDegustacao(status: string, docsVerificado: boolean): string {
  const s = String(status ?? '').toLowerCase()
  if (s === 'aprovado' && docsVerificado) return 'Verificado'
  if (s === 'reprovado' || s === 'revogado' || s === 'expirado') return 'Recusado'
  return 'Pendente'
}

export function montarMensagemDegustacao(username: string, dias: number): string {
  const handle = username.trim().replace(/^@+/, '')
  const user = handle ? `@${handle}` : '@usuario'
  return `Parabéns ${user}, você foi bonificado com ${dias} dias de degustação do nosso aplicativo. Bem-vindo ao nosso ecossistema e torcemos para que faça bons negócios.

OBS: Após o período de degustação sua conta será bloqueada e voltará funcionar após a escolha de um novo plano.`
}

export async function buscarServicosPlanoBasico(supabase: SupabaseClient): Promise<ServicoPlanoId[]> {
  const { data } = await supabase
    .from('planos')
    .select('nome, titulo, servicos')
    .eq('ativo', true)

  const rows = data ?? []
  const basico =
    rows.find((r) => {
      const row = r as Record<string, unknown>
      const nome = normalizarPlanoSlug(String(row.nome ?? ''))
      const titulo = normalizarPlanoSlug(String(row.titulo ?? ''))
      return nome === 'basico' || titulo === 'basico'
    }) ?? rows[0]

  if (!basico) return ['pagina_rede_social']

  const servicosRaw = (basico as Record<string, unknown>).servicos
  if (!Array.isArray(servicosRaw)) return ['pagina_rede_social']
  return servicosRaw.filter((s): s is ServicoPlanoId => typeof s === 'string')
}

export async function empresaDegustacaoAtiva(
  supabase: SupabaseClient,
  empresaId: string,
): Promise<DegustacaoEmpresaRow | null> {
  const agora = new Date().toISOString()
  const { data } = await supabase
    .from('empresa_degustacoes')
    .select('id, empresa_id, dias, status, canal_financeiro_id, aceito_em, inicio_em, expira_em')
    .eq('empresa_id', empresaId)
    .eq('status', 'ativa')
    .gt('expira_em', agora)
    .order('expira_em', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data?.id) return null
  return {
    id: String(data.id),
    empresa_id: String(data.empresa_id),
    dias: Number(data.dias),
    status: 'ativa',
    canal_financeiro_id: data.canal_financeiro_id != null ? String(data.canal_financeiro_id) : null,
    aceito_em: data.aceito_em != null ? String(data.aceito_em) : null,
    inicio_em: data.inicio_em != null ? String(data.inicio_em) : null,
    expira_em: data.expira_em != null ? String(data.expira_em) : null,
  }
}

export async function concederDegustacaoEmpresa(
  supabase: SupabaseClient,
  params: {
    empresaId: string
    empresaUsuarioId: string
    username: string
    dias: number
    admUsuarioId: string
  },
): Promise<{ ok: boolean; error?: string; degustacaoId?: string }> {
  const dias = Math.floor(Number(params.dias))
  if (!Number.isFinite(dias) || dias < 1 || dias > 365) {
    return { ok: false, error: 'Período inválido (1 a 365 dias).' }
  }

  const { data: emp, error: empErr } = await supabase
    .from('empresas')
    .select('id, usuario_id, nome_usuario, status, docs_verificado, aprovado_em, verificado_em')
    .eq('id', params.empresaId)
    .maybeSingle()

  if (empErr || !emp?.id) return { ok: false, error: 'Empresa não encontrada.' }

  const { data: userRow } = await supabase
    .from('usuarios')
    .select('status')
    .eq('id', emp.usuario_id)
    .maybeSingle()

  if (
    !empresaRecursosLiberados(
      userRow?.status != null ? String(userRow.status) : null,
      {
        status: emp.status != null ? String(emp.status) : null,
        docs_verificado: Boolean(emp.docs_verificado),
        aprovado_em: emp.aprovado_em != null ? String(emp.aprovado_em) : null,
        verificado_em: emp.verificado_em != null ? String(emp.verificado_em) : null,
      },
    )
  ) {
    return { ok: false, error: 'Empresa precisa estar verificada e com cadastro liberado.' }
  }

  const { count: pendentes } = await supabase
    .from('empresa_degustacoes')
    .select('id', { count: 'exact', head: true })
    .eq('empresa_id', params.empresaId)
    .in('status', ['aguardando_aceite', 'ativa'])

  if (pendentes && pendentes > 0) {
    return { ok: false, error: 'Esta empresa já possui degustação pendente ou ativa.' }
  }

  const username = String(params.username || emp.nome_usuario || '').trim()
  const mensagem = montarMensagemDegustacao(username, dias)

  const { data: degRow, error: degErr } = await supabase
    .from('empresa_degustacoes')
    .insert({
      empresa_id: params.empresaId,
      dias,
      status: 'aguardando_aceite',
      concedido_por: params.admUsuarioId,
    })
    .select('id')
    .maybeSingle()

  if (degErr || !degRow?.id) {
    return { ok: false, error: degErr?.message ?? 'Falha ao registrar degustação.' }
  }

  const canal = await inserirNotificacaoCanalFinanceiroEmpresa(supabase, {
    empresaUsuarioId: params.empresaUsuarioId,
    tipo: 'degustacao_plano',
    titulo: TITULO_DEGUSTACAO_CANAL,
    mensagem,
    metadata: {
      variant: 'degustacao',
      degustacao_id: String(degRow.id),
      dias,
      aceito: false,
    },
  })

  if (!canal.ok || !canal.id) {
    await supabase.from('empresa_degustacoes').delete().eq('id', degRow.id)
    return { ok: false, error: canal.error ?? 'Falha ao enviar convite no canal financeiro.' }
  }

  await supabase
    .from('empresa_degustacoes')
    .update({ canal_financeiro_id: canal.id, updated_at: new Date().toISOString() })
    .eq('id', degRow.id)

  return { ok: true, degustacaoId: String(degRow.id) }
}

export async function aceitarDegustacaoEmpresa(
  supabase: SupabaseClient,
  params: { degustacaoId: string; empresaUsuarioId: string },
): Promise<{ ok: boolean; error?: string }> {
  const { data: emp } = await supabase
    .from('empresas')
    .select('id, status, docs_verificado, aprovado_em, verificado_em')
    .eq('usuario_id', params.empresaUsuarioId)
    .maybeSingle()

  if (!emp?.id) return { ok: false, error: 'Empresa não encontrada.' }

  const { data: userRow } = await supabase
    .from('usuarios')
    .select('status')
    .eq('id', params.empresaUsuarioId)
    .maybeSingle()

  if (
    !empresaRecursosLiberados(
      userRow?.status != null ? String(userRow.status) : null,
      {
        status: emp.status != null ? String(emp.status) : null,
        docs_verificado: Boolean(emp.docs_verificado),
        aprovado_em: emp.aprovado_em != null ? String(emp.aprovado_em) : null,
        verificado_em: emp.verificado_em != null ? String(emp.verificado_em) : null,
      },
    )
  ) {
    return { ok: false, error: 'Cadastro precisa estar verificado e liberado para aceitar a degustação.' }
  }

  const { data: deg, error: degErr } = await supabase
    .from('empresa_degustacoes')
    .select('id, empresa_id, dias, status, canal_financeiro_id')
    .eq('id', params.degustacaoId)
    .eq('empresa_id', emp.id)
    .maybeSingle()

  if (degErr || !deg?.id) return { ok: false, error: 'Degustação não encontrada.' }
  if (String(deg.status) !== 'aguardando_aceite') {
    return { ok: false, error: 'Esta degustação já foi respondida.' }
  }

  const agora = new Date()
  const expira = new Date(agora)
  expira.setDate(expira.getDate() + Number(deg.dias))

  const { error: upErr } = await supabase
    .from('empresa_degustacoes')
    .update({
      status: 'ativa',
      aceito_em: agora.toISOString(),
      inicio_em: agora.toISOString(),
      expira_em: expira.toISOString(),
      updated_at: agora.toISOString(),
    })
    .eq('id', deg.id)
    .eq('status', 'aguardando_aceite')

  if (upErr) return { ok: false, error: upErr.message }

  if (deg.canal_financeiro_id) {
    await supabase
      .from('canal_financeiro')
      .update({
        metadata: {
          variant: 'degustacao',
          degustacao_id: String(deg.id),
          dias: Number(deg.dias),
          aceito: true,
          aceito_em: agora.toISOString(),
          expira_em: expira.toISOString(),
        },
        lida_por_empresa: true,
      })
      .eq('id', deg.canal_financeiro_id)
  }

  return { ok: true }
}
