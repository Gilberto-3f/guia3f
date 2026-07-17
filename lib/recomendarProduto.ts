import type { SupabaseClient } from '@supabase/supabase-js'
import { profissionalRecursosLiberados } from '@/lib/verificacao-documentos'
import {
  extrairEmailPrefix,
  parseWhatsappTuristaRecomendacao,
} from '@/lib/recomendarEmpresa'

export type ProdutoRecomendacaoPersistencia = {
  produtoId: string
  empresaId: string
  categoriaId?: string | null
  subcategoriaId?: string | null
  marcaId?: string | null
  whatsappTurista?: string | null
  emailTurista?: string | null
}

/**
 * Registra indicação de produto do Compras CDE.
 * Usa `recomendacoes_produto` — NÃO grava em `recomendacoes` (funil de conversão).
 */
export async function registrarRecomendacaoProduto(
  supabase: SupabaseClient,
  params: ProdutoRecomendacaoPersistencia,
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
    produto_id: params.produtoId,
    empresa_id: params.empresaId,
  }

  if (params.categoriaId) payload.categoria_id = params.categoriaId
  if (params.subcategoriaId) payload.subcategoria_id = params.subcategoriaId
  if (params.marcaId) payload.marca_id = params.marcaId

  if (emailPrefix) {
    payload.turista_canal = 'email'
    payload.turista_email_prefix = emailPrefix
  } else {
    payload.turista_canal = 'whatsapp'
    if (final4) payload.turista_whatsapp_final = final4
    if (ddd) payload.turista_whatsapp_ddd = ddd
  }

  let { error } = await supabase.from('recomendacoes_produto').insert(payload)

  // Fallbacks se colunas de privacidade ainda não existirem no remoto
  if (error && String(error.message ?? '').toLowerCase().includes('turista_')) {
    const minimo: Record<string, string> = {
      profissional_id: profissionalId,
      produto_id: params.produtoId,
      empresa_id: params.empresaId,
    }
    if (params.categoriaId) minimo.categoria_id = params.categoriaId
    if (params.subcategoriaId) minimo.subcategoria_id = params.subcategoriaId
    if (params.marcaId) minimo.marca_id = params.marcaId
    ;({ error } = await supabase.from('recomendacoes_produto').insert(minimo))
  }

  if (error) throw error

  const username =
    prof.nome_usuario != null ? String(prof.nome_usuario).replace(/^@+/, '').trim() : null
  const categorias = Array.isArray(prof.categorias)
    ? prof.categorias.map((c) => String(c).trim()).filter(Boolean)
    : []

  return { profissionalUsername: username, profissionalCategorias: categorias }
}
