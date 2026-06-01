import { NextResponse } from 'next/server'
import { assertAdminSession } from '@/lib/adminApiAuth'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { extrairPathBucketDocumentos } from '@/lib/documentosStorageUrl'

/** URLs assinadas para ADM visualizar documentos (service role — bucket privado). */
export async function POST(req: Request) {
  try {
    const session = await assertAdminSession()
    if (!session.ok) return session.error

    const body = (await req.json()) as { urls?: unknown }
    const urls = Array.isArray(body.urls)
      ? body.urls.map((u) => String(u).trim()).filter(Boolean)
      : []
    if (!urls.length) {
      return NextResponse.json({ urls: {} })
    }

    const admin = createSupabaseAdmin()
    const map: Record<string, string> = {}

    await Promise.all(
      [...new Set(urls)].map(async (original) => {
        const path = extrairPathBucketDocumentos(original)
        if (!path) {
          map[original] = original
          return
        }
        const { data, error } = await admin.storage.from('documentos').createSignedUrl(path, 60 * 60)
        map[original] = !error && data?.signedUrl ? data.signedUrl : original
      }),
    )

    return NextResponse.json({ urls: map })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    if (msg.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return NextResponse.json({ error: 'Serviço indisponível (configuração do servidor).' }, { status: 503 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
