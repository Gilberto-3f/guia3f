import type { SupabaseClient } from '@supabase/supabase-js'
import { profissionalRecursosLiberados } from '@/lib/verificacao-documentos'
import {
  extrairEmailPrefix,
  parseWhatsappTuristaRecomendacao,
} from '@/lib/recomendarEmpresa'

export type PratoRecomendacaoPersistencia = {
  pratoId: string
  empresaId: string
  categoriaId?: string | null
  whatsappTurista?: string | null
  emailTurista?: string | null
}

/**
 * Registra indicação de prato do cardápio digital em `recomendacoes_prato`.
 * Conta no funil de conversão da empresa (recomendação indireta), aba CARDÁPIO.
 */
export async function registrarRecomendacaoPrato(
  supabase: SupabaseClient,
  params: PratoRecomendacaoPersistencia,
): Promise<{ profissionalUsername: string | null; profissionalCategorias: string[] }> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const uid = session?.user?.id
  if (!uid) throw new Error('Faça login como profissional para recomendar.')

  const [{ data: usuario }, { data: prof, error: profErr }] = await Promise.all([
    supabase.from('usuarios').select('status').eq('id', uid).maybeSingle(),
    supabase
      .from('profissionais')
      .select('id, nome_usuario, categorias, status, docs_verificado, proxima_revisao_docs_em')
      .eq('usuario_id', uid)
      .maybeSingle(),
  ])

  if (profErr) throw profErr
  if (!prof?.id) throw new Error('Perfil profissional não encontrado.')

  if (!profissionalRecursosLiberados(usuario?.status, prof)) {
    throw new Error(
      'Sua conta profissional ainda não foi verificada. Anexe seus documentos e aguarde aprovação do administrador.',
    )
  }

  const profissionalId = String(prof.id)
  const emailPrefix = params.emailTurista ? extrairEmailPrefix(params.emailTurista) : null
  const { ddd, final4 } = parseWhatsappTuristaRecomendacao(params.whatsappTurista)

  const payload: Record<string, string> = {
    profissional_id: profissionalId,
    prato_id: params.pratoId,
    empresa_id: params.empresaId,
  }

  if (params.categoriaId) payload.categoria_id = params.categoriaId

  if (emailPrefix) {
    payload.turista_canal = 'email'
    payload.turista_email_prefix = emailPrefix
  } else {
    payload.turista_canal = 'whatsapp'
    if (final4) payload.turista_whatsapp_final = final4
    if (ddd) payload.turista_whatsapp_ddd = ddd
  }

  let { error } = await supabase.from('recomendacoes_prato').insert(payload)

  // Fallbacks se colunas de privacidade ainda não existirem no remoto
  if (error && String(error.message ?? '').toLowerCase().includes('turista_')) {
    const minimo: Record<string, string> = {
      profissional_id: profissionalId,
      prato_id: params.pratoId,
      empresa_id: params.empresaId,
    }
    if (params.categoriaId) minimo.categoria_id = params.categoriaId
    ;({ error } = await supabase.from('recomendacoes_prato').insert(minimo))
  }

  if (error) throw error

  const username =
    prof.nome_usuario != null ? String(prof.nome_usuario).replace(/^@+/, '').trim() : null
  const categorias = Array.isArray(prof.categorias)
    ? prof.categorias.map((c) => String(c).trim()).filter(Boolean)
    : []

  return { profissionalUsername: username, profissionalCategorias: categorias }
}
