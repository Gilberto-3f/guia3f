import type { SupabaseClient } from '@supabase/supabase-js'
import { categoriaDbParaSlug } from '@/lib/segmentosEmpresaGuia'
import { profissionalRecursosLiberados } from '@/lib/verificacao-documentos'
import { digitsWhatsapp } from '@/lib/whatsapp-empresa'

export function parseWhatsappTuristaRecomendacao(raw: string | null | undefined): {
  ddd: string | null
  final4: string | null
} {
  const digits = digitsWhatsapp(raw)
  if (digits.length < 8) return { ddd: null, final4: null }

  const final4 = digits.slice(-4)
  if (final4.length !== 4) return { ddd: null, final4: null }

  if (digits.startsWith('55') && digits.length >= 12) {
    const ddd = digits.slice(2, 4)
    if (ddd.length === 2) return { ddd, final4 }
  }

  return { ddd: null, final4 }
}

/** Extrai as 5 primeiras letras/números do local-part do e-mail. */
export function extrairEmailPrefix(email: string | null | undefined): string | null {
  const local = String(email ?? '')
    .trim()
    .toLowerCase()
    .split('@')[0]
    ?.replace(/[^a-z0-9]/g, '')
  if (!local || local.length < 1) return null
  return local.slice(0, 5)
}

/** Ex.: abcde*******.com */
export function formatarEmailTuristaMascarado(prefix: string | null | undefined): string | null {
  const p =
    prefix != null
      ? String(prefix)
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .slice(0, 5)
      : ''
  if (!p) return null
  return `${p}*******.com`
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
    emailTurista?: string | null
  },
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

  const payloadCompleto: Record<string, string> = {
    profissional_id: profissionalId,
    empresa_id: params.empresaId,
  }

  if (emailPrefix) {
    payloadCompleto.turista_canal = 'email'
    payloadCompleto.turista_email_prefix = emailPrefix
  } else {
    payloadCompleto.turista_canal = 'whatsapp'
    if (final4) payloadCompleto.turista_whatsapp_final = final4
    if (ddd) payloadCompleto.turista_whatsapp_ddd = ddd
  }

  let recErr = (await supabase.from('recomendacoes').insert(payloadCompleto)).error

  if (recErr && emailPrefix && String(recErr.message ?? '').toLowerCase().includes('turista_email')) {
    recErr = (
      await supabase.from('recomendacoes').insert({
        profissional_id: profissionalId,
        empresa_id: params.empresaId,
      })
    ).error
  }

  if (recErr && String(recErr.message ?? '').toLowerCase().includes('turista_whatsapp_ddd')) {
    const semDdd = { ...payloadCompleto }
    delete semDdd.turista_whatsapp_ddd
    recErr = (await supabase.from('recomendacoes').insert(semDdd)).error
  }

  if (recErr && String(recErr.message ?? '').toLowerCase().includes('turista_whatsapp_final')) {
    const minimo: Record<string, string> = {
      profissional_id: profissionalId,
      empresa_id: params.empresaId,
    }
    if (emailPrefix) {
      minimo.turista_canal = 'email'
      minimo.turista_email_prefix = emailPrefix
    }
    recErr = (await supabase.from('recomendacoes').insert(minimo)).error
  }

  if (recErr && String(recErr.message ?? '').toLowerCase().includes('turista_canal')) {
    const legado: Record<string, string> = {
      profissional_id: profissionalId,
      empresa_id: params.empresaId,
    }
    if (final4) legado.turista_whatsapp_final = final4
    if (ddd) legado.turista_whatsapp_ddd = ddd
    recErr = (await supabase.from('recomendacoes').insert(legado)).error
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
  const categorias = Array.isArray(prof.categorias)
    ? prof.categorias.map((c) => String(c).trim()).filter(Boolean)
    : []
  return { profissionalUsername: username, profissionalCategorias: categorias }
}

export function montarEnderecoEmpresa(empresa: EmpresaRecomendacaoInfo): string {
  return [empresa.endereco, empresa.bairro, empresa.cidade].filter(Boolean).map(String).join(', ')
}
