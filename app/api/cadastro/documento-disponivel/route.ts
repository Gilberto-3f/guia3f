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
    const empresaId = String(req.nextUrl.searchParams.get('empresaId') || '').trim()
    const tipo = String(req.nextUrl.searchParams.get('tipo') || 'identidade').trim()

    if (!documentoIdentidadeValido(documento)) {
      return NextResponse.json({ available: false, reason: 'invalid' })
    }

    const norm = normalizarDocumentoIdentidade(documento)
    const admin = createSupabaseAdmin()

    if (tipo === 'fiscal') {
      const empResp = await admin.from('empresas').select('id, usuario_id, documento_fiscal')
      if (empResp.error) {
        return NextResponse.json({ available: false, reason: 'error' }, { status: 500 })
      }

      const emUso = (empResp.data ?? []).some((row) => {
        const rowNorm = normalizarDocumentoIdentidade(row.documento_fiscal)
        if (!rowNorm || rowNorm !== norm) return false
        if (empresaId && String(row.id) === empresaId) return false
        if (usuarioId && String(row.usuario_id) === usuarioId) return false
        return true
      })

      return NextResponse.json({ available: !emUso })
    }

    const [profResp, turResp, empResp] = await Promise.all([
      admin.from('profissionais').select('id, usuario_id, documento_identidade'),
      admin.from('turistas').select('id, usuario_id, documento_identidade'),
      admin.from('empresas').select('id, usuario_id, documento_fiscal'),
    ])

    if (profResp.error || turResp.error || empResp.error) {
      return NextResponse.json({ available: false, reason: 'error' }, { status: 500 })
    }

    const emUso = [...(profResp.data ?? []), ...(turResp.data ?? [])].some((row) => {
      const rowNorm = normalizarDocumentoIdentidade(row.documento_identidade)
      if (!rowNorm || rowNorm !== norm) return false
      if (usuarioId && String(row.usuario_id) === usuarioId) return false
      return true
    })

    const fiscalEmUso = (empResp.data ?? []).some((row) => {
      const rowNorm = normalizarDocumentoIdentidade(row.documento_fiscal)
      if (!rowNorm || rowNorm !== norm) return false
      if (empresaId && String(row.id) === empresaId) return false
      if (usuarioId && String(row.usuario_id) === usuarioId) return false
      return true
    })

    return NextResponse.json({ available: !emUso && !fiscalEmUso })
  } catch {
    return NextResponse.json({ available: false, reason: 'error' }, { status: 500 })
  }
}
