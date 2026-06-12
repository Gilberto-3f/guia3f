import type { SupabaseClient } from '@supabase/supabase-js'

export const MOTIVOS_DENUNCIA_CONTEUDO = [
  { id: 'informacao_falsa', label: 'Informação falsa' },
  { id: 'odio', label: 'Símbolos ou discurso de ódio' },
  { id: 'ilicitio', label: 'Conteúdo ilícito' },
  { id: 'outro', label: 'Outro motivo (detalhar)' },
] as const

export type MotivoDenunciaId = (typeof MOTIVOS_DENUNCIA_CONTEUDO)[number]['id']
export type ConteudoDenunciaTipo = 'post' | 'comentario' | 'story' | 'avaliacao'

export type PerfilDenunciado = {
  tipo: 'turista' | 'profissional' | 'empresa'
  perfilId: string
  usuarioId: string
}

/** Resolve perfil de cadastro do autor para roteamento na dashboard ADM. */
export async function resolverPerfilDenunciado(
  supabase: SupabaseClient,
  usuarioId: string,
): Promise<PerfilDenunciado | null> {
  const uid = usuarioId.trim()
  if (!uid) return null

  const [{ data: emp }, { data: prof }, { data: tur }] = await Promise.all([
    supabase.from('empresas').select('id').eq('usuario_id', uid).maybeSingle(),
    supabase.from('profissionais').select('id').eq('usuario_id', uid).maybeSingle(),
    supabase.from('turistas').select('id').eq('usuario_id', uid).maybeSingle(),
  ])

  if (emp?.id) return { tipo: 'empresa', perfilId: String(emp.id), usuarioId: uid }
  if (prof?.id) return { tipo: 'profissional', perfilId: String(prof.id), usuarioId: uid }
  if (tur?.id) return { tipo: 'turista', perfilId: String(tur.id), usuarioId: uid }
  return null
}

export function labelMotivoDenuncia(motivoId: string, detalhe?: string | null): string {
  const found = MOTIVOS_DENUNCIA_CONTEUDO.find((m) => m.id === motivoId)
  if (motivoId === 'outro' && detalhe?.trim()) return detalhe.trim().slice(0, 350)
  return found?.label ?? motivoId
}

export async function enviarDenunciaConteudo(
  supabase: SupabaseClient,
  params: {
    denuncianteId: string
    denunciadoUsuarioId: string
    conteudoTipo: ConteudoDenunciaTipo
    conteudoId: string
    motivoId: MotivoDenunciaId
    detalheOutro?: string
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const perfil = await resolverPerfilDenunciado(supabase, params.denunciadoUsuarioId)
  if (!perfil) {
    return { ok: false, error: 'Não foi possível identificar o perfil do usuário denunciado.' }
  }

  if (params.denuncianteId === params.denunciadoUsuarioId) {
    return { ok: false, error: 'Você não pode denunciar seu próprio conteúdo.' }
  }

  const motivoLabel = labelMotivoDenuncia(params.motivoId, params.detalheOutro)
  const descricao =
    params.motivoId === 'outro' ? null : params.detalheOutro?.trim().slice(0, 350) ?? null

  const { error } = await supabase.from('denuncias').insert({
    denunciante_id: params.denuncianteId,
    denunciado_id: perfil.perfilId,
    denunciado_tipo: perfil.tipo,
    denunciado_usuario_id: perfil.usuarioId,
    conteudo_tipo: params.conteudoTipo,
    conteudo_id: params.conteudoId,
    motivo: motivoLabel,
    descricao,
    status: 'pendente',
    evidencias: [],
  })

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
