import { createSupabaseAdmin } from '@/lib/supabaseAdmin'

export type CampoLegal = 'politicas_privacidade' | 'regras_ecossistema' | 'termos_uso'

const FALLBACK: Record<CampoLegal, string> = {
  politicas_privacidade:
    'Políticas de privacidade em atualização. Entre em contato com a administração do Guia 3F para mais informações.',
  regras_ecossistema:
    'Regras do ecossistema em atualização. Entre em contato com a administração do Guia 3F para mais informações.',
  termos_uso: 'Termos de uso em atualização. Entre em contato com a administração do Guia 3F para mais informações.',
}

/** Lê texto institucional no servidor (service role — página pública de cadastro). */
export async function buscarTextoLegal(campo: CampoLegal): Promise<string> {
  try {
    const admin = createSupabaseAdmin()
    const { data, error } = await admin.from('config_geral').select(campo).limit(1).maybeSingle()
    if (error) return FALLBACK[campo]
    const row = data as Partial<Record<CampoLegal, unknown>> | null
    const raw = row?.[campo]
    const texto = typeof raw === 'string' ? raw.trim() : ''
    return texto || FALLBACK[campo]
  } catch {
    return FALLBACK[campo]
  }
}
