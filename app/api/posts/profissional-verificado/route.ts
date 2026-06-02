import { NextResponse } from 'next/server'

/**
 * Post de «novo profissional verificado» no feed foi descontinuado.
 * Mantido para compatibilidade com chamadas antigas do dashboard.
 */
export async function POST() {
  return NextResponse.json({ ok: true, skipped: true })
}
