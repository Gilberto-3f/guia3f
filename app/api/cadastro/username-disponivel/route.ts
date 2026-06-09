import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'

const usernameRegex = /^[a-z0-9._]{3,20}$/

export async function GET(req: NextRequest) {
  try {
    const username = String(req.nextUrl.searchParams.get('username') || '')
      .trim()
      .toLowerCase()
      .replace(/^@+/, '')

    if (!username) {
      return NextResponse.json({ available: false, reason: 'empty' })
    }

    if (!usernameRegex.test(username)) {
      return NextResponse.json({ available: false, reason: 'invalid' })
    }

    const admin = createSupabaseAdmin()
    const [turistasResp, profissionaisResp, empresasResp] = await Promise.all([
      admin.from('turistas').select('id').eq('nome_usuario', username).limit(1),
      admin.from('profissionais').select('id').eq('nome_usuario', username).limit(1),
      admin.from('empresas').select('id').eq('nome_usuario', username).limit(1),
    ])

    if (turistasResp.error || profissionaisResp.error || empresasResp.error) {
      return NextResponse.json({ available: false, reason: 'error' }, { status: 500 })
    }

    const indisponivel =
      (turistasResp.data?.length ?? 0) > 0 ||
      (profissionaisResp.data?.length ?? 0) > 0 ||
      (empresasResp.data?.length ?? 0) > 0

    return NextResponse.json({ available: !indisponivel })
  } catch {
    return NextResponse.json({ available: false, reason: 'error' }, { status: 500 })
  }
}
