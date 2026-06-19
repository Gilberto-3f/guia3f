import type { SupabaseClient } from '@supabase/supabase-js'
import { formatProfissionalCategorias } from '@/app/[locale]/(admin)/dashboard/admin/components/verificacao/verificacaoFormatters'
import {
  extrairEmailPrefix,
  parseWhatsappTuristaRecomendacao,
} from '@/lib/recomendarEmpresa'
import { profissionalRecursosLiberados } from '@/lib/verificacao-documentos'

export type ProfissionalRecomendacaoInfo = {
  id: string
  usuarioId: string
  nome: string
  nomeUsuario?: string | null
  categorias?: string[] | null
  notaMedia?: number | null
  totalAvaliacoes?: number | null
  paisBandeira?: string | null
}

export function urlProfissionalRecomendacao(usuarioId: string, recomendacaoId?: string | null): string {
  const qs = recomendacaoId ? `?ref=recomendacao&rec=${encodeURIComponent(recomendacaoId)}` : '?ref=recomendacao'
  if (typeof window === 'undefined') return `/perfil/${usuarioId}${qs}`
  return `${window.location.origin}/perfil/${usuarioId}${qs}`
}

export async function registrarRecomendacaoProfissional(
  supabase: SupabaseClient,
  params: {
    profissionalIndicadoId: string
    whatsappTurista?: string | null
    emailTurista?: string | null
  },
): Promise<{ profissionalUsername: string | null; profissionalCategorias: string[]; recomendacaoId: string }> {
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

  const profissionalIndicadorId = String(prof.id)
  const emailPrefix = params.emailTurista ? extrairEmailPrefix(params.emailTurista) : null
  const { ddd, final4 } = parseWhatsappTuristaRecomendacao(params.whatsappTurista)

  const payload: Record<string, string> = {
    profissional_indicador_id: profissionalIndicadorId,
    profissional_indicado_id: params.profissionalIndicadoId,
  }

  if (emailPrefix) {
    payload.turista_canal = 'email'
    payload.turista_email_prefix = emailPrefix
  } else {
    payload.turista_canal = 'whatsapp'
    if (final4) payload.turista_whatsapp_final = final4
    if (ddd) payload.turista_whatsapp_ddd = ddd
  }

  const tryInsert = async (payloadInsert: Record<string, string>) => {
    const res = await supabase.from('recomendacoes_profissional').insert(payloadInsert).select('id').maybeSingle()
    return res
  }

  let insertRes = await tryInsert(payload)
  let recErr = insertRes.error
  let recomendacaoId = insertRes.data?.id != null ? String(insertRes.data.id) : ''

  if (recErr && emailPrefix && String(recErr.message ?? '').toLowerCase().includes('turista_email')) {
    insertRes = await tryInsert({
      profissional_indicador_id: profissionalIndicadorId,
      profissional_indicado_id: params.profissionalIndicadoId,
    })
    recErr = insertRes.error
    recomendacaoId = insertRes.data?.id != null ? String(insertRes.data.id) : recomendacaoId
  }

  if (recErr && String(recErr.message ?? '').toLowerCase().includes('turista_whatsapp_ddd')) {
    const semDdd = { ...payload }
    delete semDdd.turista_whatsapp_ddd
    insertRes = await tryInsert(semDdd)
    recErr = insertRes.error
    recomendacaoId = insertRes.data?.id != null ? String(insertRes.data.id) : recomendacaoId
  }

  if (recErr && String(recErr.message ?? '').toLowerCase().includes('turista_whatsapp_final')) {
    const minimo: Record<string, string> = {
      profissional_indicador_id: profissionalIndicadorId,
      profissional_indicado_id: params.profissionalIndicadoId,
    }
    if (emailPrefix) {
      minimo.turista_canal = 'email'
      minimo.turista_email_prefix = emailPrefix
    }
    insertRes = await tryInsert(minimo)
    recErr = insertRes.error
    recomendacaoId = insertRes.data?.id != null ? String(insertRes.data.id) : recomendacaoId
  }

  if (recErr && String(recErr.message ?? '').toLowerCase().includes('turista_canal')) {
    insertRes = await tryInsert({
      profissional_indicador_id: profissionalIndicadorId,
      profissional_indicado_id: params.profissionalIndicadoId,
    })
    recErr = insertRes.error
    recomendacaoId = insertRes.data?.id != null ? String(insertRes.data.id) : recomendacaoId
  }

  if (recErr) throw recErr
  if (!recomendacaoId) throw new Error('Não foi possível registrar a recomendação.')

  const username = prof.nome_usuario != null ? String(prof.nome_usuario).replace(/^@+/, '').trim() : null
  const categorias = Array.isArray(prof.categorias)
    ? prof.categorias.map((c) => String(c).trim()).filter(Boolean)
    : []
  return { profissionalUsername: username, profissionalCategorias: categorias, recomendacaoId }
}

export function rotuloCategoriaProfissionalRecomendacao(categorias: string[] | null | undefined): string {
  return formatProfissionalCategorias(categorias)
}
