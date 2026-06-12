import type { SupabaseClient } from '@supabase/supabase-js'

const CONTEUDO_SOCIAL = new Set(['post', 'comentario', 'story', 'avaliacao'])

export type AcaoDecisaoDenuncia =
  | 'mensagem'
  | 'bloqueio'
  | 'excluir_conteudo'
  | 'excluir_cadastro'
  | 'advertencia'
  | 'suspensao'
  | 'banimento'
  | 'arquivada'

type DenunciaRow = {
  id: string
  denunciante_id: string
  denunciado_usuario_id?: string | null
  conteudo_tipo?: string | null
  motivo?: string | null
}

function isConteudoSocial(conteudoTipo: string | null | undefined): boolean {
  return Boolean(conteudoTipo && CONTEUDO_SOCIAL.has(conteudoTipo))
}

function labelConteudo(conteudoTipo: string | null | undefined): string {
  const map: Record<string, string> = {
    post: 'publicação',
    comentario: 'comentário',
    story: 'story',
    avaliacao: 'avaliação',
  }
  return conteudoTipo ? map[conteudoTipo] ?? 'conteúdo' : 'conteúdo da plataforma'
}

function resultadoAcao(acao: AcaoDecisaoDenuncia, texto?: string | null, dias?: number): string {
  switch (acao) {
    case 'mensagem':
      return texto?.trim()
        ? `Mensagem da moderação: ${texto.trim()}`
        : 'A moderação enviou uma mensagem sobre sua conta.'
    case 'bloqueio':
      return 'Bloqueio temporário de acesso às funções da conta até conclusão da investigação.'
    case 'excluir_conteudo':
      return texto?.trim()
        ? `Publicação denunciada removida. Motivo: ${texto.trim()}`
        : 'A publicação denunciada foi removida pela moderação.'
    case 'excluir_cadastro':
      return 'Solicitação de exclusão do cadastro aprovada. Você perderá acesso aos recursos do app. Entre em contato com a administração via e-mail ou WhatsApp para orientações.'
    case 'advertencia':
      return texto?.trim()
        ? `Advertência aplicada. Motivo: ${texto.trim()}`
        : 'Advertência aplicada à sua conta.'
    case 'suspensao':
      return texto?.trim()
        ? `Suspensão temporária${dias ? ` (${dias} dias)` : ''}. Motivo: ${texto.trim()}`
        : `Suspensão temporária${dias ? ` de ${dias} dias` : ''} aplicada à sua conta.`
    case 'banimento':
      return texto?.trim()
        ? `Banimento permanente. Motivo: ${texto.trim()}`
        : 'Banimento permanente aplicado à sua conta.'
    case 'arquivada':
      return texto?.trim()
        ? `Denúncia arquivada após análise. ${texto.trim()}`
        : 'Denúncia arquivada após análise — nenhuma penalidade adicional.'
    default:
      return 'Decisão registrada pela moderação.'
  }
}

function tituloDenunciado(acao: AcaoDecisaoDenuncia): string {
  if (acao === 'mensagem') return 'Mensagem da moderação'
  if (acao === 'bloqueio') return 'Bloqueio temporário'
  if (acao === 'excluir_conteudo') return 'Publicação removida'
  if (acao === 'excluir_cadastro') return 'Exclusão de cadastro'
  if (acao === 'advertencia') return 'Advertência'
  if (acao === 'suspensao') return 'Suspensão'
  if (acao === 'banimento') return 'Banimento'
  return 'Decisão de moderação'
}

function tituloDenunciante(acao: AcaoDecisaoDenuncia): string {
  if (acao === 'arquivada') return 'Denúncia concluída'
  return 'Decisão sobre sua denúncia'
}

function tipoHistorico(acao: AcaoDecisaoDenuncia): string {
  if (acao === 'advertencia') return 'advertencia'
  if (acao === 'suspensao' || acao === 'bloqueio') return 'suspensao'
  if (acao === 'banimento' || acao === 'excluir_cadastro') return 'banimento'
  return 'decisao_denuncia'
}

function statusHistorico(acao: AcaoDecisaoDenuncia): 'ativo' | 'cumprido' {
  if (acao === 'suspensao' || acao === 'bloqueio') return 'ativo'
  return 'cumprido'
}

async function inserirHistorico(
  supabase: SupabaseClient,
  payload: {
    usuarioId: string
    denunciaId: string
    acao: AcaoDecisaoDenuncia
    titulo: string
    descricao: string
    dias?: number
  },
) {
  const agora = new Date().toISOString()
  const expiracao =
    payload.acao === 'suspensao' && payload.dias
      ? new Date(Date.now() + payload.dias * 24 * 60 * 60 * 1000).toISOString()
      : payload.acao === 'bloqueio'
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        : null

  const { error } = await supabase.from('historico_decisoes').insert({
    usuario_id: payload.usuarioId,
    denuncia_id: payload.denunciaId,
    tipo: tipoHistorico(payload.acao),
    titulo: payload.titulo.slice(0, 100),
    descricao: payload.descricao,
    penalidade_aplicada: payload.acao,
    duracao_dias: payload.dias ?? null,
    data_aplicacao: agora,
    data_conclusao: agora,
    data_expiracao: expiracao,
    status: statusHistorico(payload.acao),
    justificativa: payload.descricao,
    visualizado: false,
  })

  if (error) {
    console.error('[notificarDecisaoDenuncia]', error.message, payload)
  }
}

/** Notifica denunciante e denunciado sobre decisão de moderação (in-app, aba Decisões). */
export async function notificarDecisaoDenuncia(
  supabase: SupabaseClient,
  denuncia: DenunciaRow,
  acao: AcaoDecisaoDenuncia,
  opts?: { texto?: string | null; dias?: number },
): Promise<void> {
  const conteudoTipo = denuncia.conteudo_tipo ?? null
  const anonimo = isConteudoSocial(conteudoTipo)
  const conteudoLabel = labelConteudo(conteudoTipo)
  const resultado = resultadoAcao(acao, opts?.texto, opts?.dias)
  const denunciadoId = denuncia.denunciado_usuario_id?.trim() || null
  const denuncianteId = denuncia.denunciante_id?.trim()

  if (denuncianteId) {
    const descDenunciante = anonimo
      ? `Sua denúncia sobre ${conteudoLabel} foi analisada. Resultado: ${resultado}`
      : `Sua denúncia (motivo: ${denuncia.motivo ?? '—'}) foi analisada. Resultado: ${resultado}`

    await inserirHistorico(supabase, {
      usuarioId: denuncianteId,
      denunciaId: denuncia.id,
      acao,
      titulo: tituloDenunciante(acao),
      descricao: descDenunciante,
      dias: opts?.dias,
    })
  }

  if (denunciadoId && denunciadoId !== denuncianteId) {
    const descDenunciado = anonimo
      ? `Uma denúncia anônima sobre sua ${conteudoLabel} resultou em: ${resultado}`
      : `Uma denúncia sobre sua conta resultou em: ${resultado}`

    await inserirHistorico(supabase, {
      usuarioId: denunciadoId,
      denunciaId: denuncia.id,
      acao,
      titulo: tituloDenunciado(acao),
      descricao: descDenunciado,
      dias: opts?.dias,
    })
  }
}
