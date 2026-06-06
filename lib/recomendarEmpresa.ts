import type { SupabaseClient } from '@supabase/supabase-js'
import { categoriaDbParaSlug } from '@/lib/segmentosEmpresaGuia'

export type EmpresaRecomendacaoInfo = {
  id: string
  nome_fantasia: string
  nome_usuario?: string | null
  categoria?: string | null
  nota_media?: number | null
  total_avaliacoes?: number | null
  endereco?: string | null
  bairro?: string | null
  cidade?: string | null
}

export function urlEmpresaRecomendacao(empresaId: string): string {
  if (typeof window === 'undefined') return `/empresa/${empresaId}?ref=recomendacao`
  return `${window.location.origin}/empresa/${empresaId}?ref=recomendacao`
}

export async function registrarRecomendacaoEmpresa(
  supabase: SupabaseClient,
  params: {
    empresaId: string
    segmentoGuiaSlug?: string | null
    categoriaEmpresa?: string | null
  },
): Promise<{ profissionalUsername: string | null }> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const uid = session?.user?.id
  if (!uid) throw new Error('Faça login como profissional para recomendar.')

  const { data: prof, error: profErr } = await supabase
    .from('profissionais')
    .select('id, nome_usuario')
    .eq('usuario_id', uid)
    .maybeSingle()

  if (profErr) throw profErr
  if (!prof?.id) throw new Error('Perfil profissional não encontrado.')

  const profissionalId = String(prof.id)

  const { error: recErr } = await supabase.from('recomendacoes').insert({
    profissional_id: profissionalId,
    empresa_id: params.empresaId,
  })
  if (recErr) throw recErr

  const segmento =
    params.segmentoGuiaSlug?.trim() ||
    categoriaDbParaSlug(params.categoriaEmpresa) ||
    String(params.categoriaEmpresa ?? 'outros').trim()

  const { error: logErr } = await supabase.from('logs_recomendacoes_segmento').insert({
    profissional_id: profissionalId,
    empresa_id: params.empresaId,
    segmento,
  })
  if (logErr) throw logErr

  const username = prof.nome_usuario != null ? String(prof.nome_usuario).replace(/^@+/, '').trim() : null
  return { profissionalUsername: username }
}

export function montarEnderecoEmpresa(empresa: EmpresaRecomendacaoInfo): string {
  return [empresa.endereco, empresa.bairro, empresa.cidade].filter(Boolean).map(String).join(', ')
}
