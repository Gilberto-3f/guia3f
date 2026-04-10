import { NextRequest, NextResponse } from 'next/server'
import { enviarMagicLinkAposCadastro, resolveAuthCallbackUrl } from '@/lib/cadastroMagicLinkServer'

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Dispara magic link para e-mail já registado no Auth (ex.: após cadastro com sessão ou reenvio).
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as {
      email?: string
      redirectOrigin?: string
    } | null
    const email = String(body?.email || '')
      .trim()
      .toLowerCase()
    const redirectOrigin = String(body?.redirectOrigin || '')

    if (!emailRegex.test(email)) {
      return NextResponse.json({ ok: false, magicLinkSent: false, error: 'invalid_email' }, { status: 400 })
    }

    const callbackUrl = resolveAuthCallbackUrl(req, redirectOrigin)
    const { error } = await enviarMagicLinkAposCadastro(email, callbackUrl)

    if (error) {
      return NextResponse.json({
        ok: false,
        magicLinkSent: false,
        error: error.message,
      })
    }

    return NextResponse.json({ ok: true, magicLinkSent: true })
  } catch {
    return NextResponse.json({ ok: false, magicLinkSent: false, error: 'bad_request' }, { status: 400 })
  }
}
