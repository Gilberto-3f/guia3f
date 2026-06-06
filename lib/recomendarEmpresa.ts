import type { SupabaseClient } from '@supabase/supabase-js'
import { categoriaDbParaSlug } from '@/lib/segmentosEmpresaGuia'
import { digitsWhatsapp } from '@/lib/whatsapp-empresa'

export function parseWhatsappTuristaRecomendacao(raw: string | null | undefined): {
  ddd: string | null
  final4: string | null
} {
  let digits = digitsWhatsapp(raw)
  if (digits.length < 10) return { ddd: null, final4: null }

  if (!digits.startsWith('55') && digits.length >= 10 && digits.length <= 11) {
    digits = `55${digits}`
  }

  if (digits.length < 12) return { ddd: null, final4: null }

  const final4 = digits.slice(-4)
  const ddd = digits.slice(2, 4)

  if (final4.length !== 4 || ddd.length !== 2) return { ddd: null, final4: null }
  return { ddd, final4 }
}

/** Ex.: + 55 (45) * ****-1234 */
export function formatarWhatsappTuristaMascarado(
  ddd: string | null | undefined,
  final4: string | null | undefined,
): string | null {
  const f = final4 != null ? String(final4).replace(/\D/g, '').trim().slice(-4) : ''
  if (f.length !== 4) return null

  const d = ddd != null ? String(ddd).replace(/\D/g, '').trim().slice(0, 2) : ''
  const dddFmt = d.length === 2 ? d : '**'
  return `+ 55 (${dddFmt}) * ****-${f}`
}

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
    whatsappTurista?: string | null
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

  const { ddd, final4 } = parseWhatsappTuristaRecomendacao(params.whatsappTurista)

  const payloadCompleto: Record<string, string> = {
    profissional_id: profissionalId,
    empresa_id: params.empresaId,
  }
  if (final4) payloadCompleto.turista_whatsapp_final = final4
  if (ddd) payloadCompleto.turista_whatsapp_ddd = ddd

  let recErr = (await supabase.from('recomendacoes').insert(payloadCompleto)).error

  if (recErr && String(recErr.message ?? '').toLowerCase().includes('turista_whatsapp_ddd')) {
    const semDdd = { ...payloadCompleto }
    delete semDdd.turista_whatsapp_ddd
    recErr = (await supabase.from('recomendacoes').insert(semDdd)).error
  }

  if (recErr && String(recErr.message ?? '').toLowerCase().includes('turista_whatsapp_final')) {
    recErr = (
      await supabase.from('recomendacoes').insert({
        profissional_id: profissionalId,
        empresa_id: params.empresaId,
      })
    ).error
  }
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
