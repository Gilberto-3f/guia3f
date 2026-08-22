import { NextResponse } from 'next/server'
import { assertUserSessionLight } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import {
  canalParceiroPorCidade,
  CONFIG_APIS_MOBILIDADE_SELECT,
  resolverLinkAppParceiro,
  resolverUrlApiMobilidadeParceiro,
  type CanalParceiroMobilidade,
} from '@/lib/mobilidadeParceiroApi'

/**
 * Config pública do app/API parceiro (URL + link de loja).
 * Nunca devolve `api_mobilidade_key*`.
 */
export async function GET(request: Request) {
  const auth = await assertUserSessionLight()
  if (!auth.ok) return auth.error

  const url = new URL(request.url)
  const canalParam = String(url.searchParams.get('canal') ?? '').trim()
  const cidade = url.searchParams.get('cidade')
  let canal: CanalParceiroMobilidade | null = null
  if (canalParam === 'foz' || canalParam === 'cde') canal = canalParam
  else if (cidade) canal = canalParceiroPorCidade(cidade)

  let admin
  try {
    admin = createSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })
  }

  const { data: cfg } = await admin
    .from('config_apis')
    .select(CONFIG_APIS_MOBILIDADE_SELECT)
    .limit(1)
    .maybeSingle()

  return NextResponse.json(
    {
      url: resolverUrlApiMobilidadeParceiro(cfg, canal),
      app_parceiro_link: resolverLinkAppParceiro(cfg, canal),
      canal,
    },
    { headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=300' } },
  )
}
