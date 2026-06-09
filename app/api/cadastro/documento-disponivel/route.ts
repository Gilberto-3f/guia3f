import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import {
  documentoIdentidadeValido,
  normalizarDocumentoIdentidade,
} from '@/lib/documentoIdentidade'

export async function GET(req: NextRequest) {
  try {
    const documento = String(req.nextUrl.searchParams.get('documento') || '')
    const usuarioId = String(req.nextUrl.searchParams.get('usuarioId') || '').trim()

    if (!documentoIdentidadeValido(documento)) {
      return NextResponse.json({ available: false, reason: 'invalid' })
    }

    const norm = normalizarDocumentoIdentidade(documento)
    const admin = createSupabaseAdmin()

    const [profResp, turResp] = await Promise.all([
      admin.from('profissionais').select('id, usuario_id, documento_identidade'),
      admin.from('turistas').select('id, usuario_id, documento_identidade'),
    ])

    if (profResp.error || turResp.error) {
      return NextResponse.json({ available: false, reason: 'error' }, { status: 500 })
    }

    const emUso = [...(profResp.data ?? []), ...(turResp.data ?? [])].some((row) => {
      const rowNorm = normalizarDocumentoIdentidade(row.documento_identidade)
      if (!rowNorm || rowNorm !== norm) return false
      if (usuarioId && String(row.usuario_id) === usuarioId) return false
      return true
    })

    return NextResponse.json({ available: !emUso })
  } catch {
    return NextResponse.json({ available: false, reason: 'error' }, { status: 500 })
  }
}
