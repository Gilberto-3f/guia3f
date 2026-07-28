import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { categoriasIncluemAnfitriao } from '@/lib/anfitriaoDualMode'
import {
  mapParceiroFinanceiroMeta,
  notificarAnfitriaoFoiRecomendado,
} from '@/lib/recomendacaoAnfitriaoFinanceiro'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { joinSupabaseRow } from '@/lib/supabaseJoinRow'

/** Após criar recomendação: notifica anfitrião indicado (“Você foi recomendado!”). */
export async function POST(req: Request) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  if (auth.role !== 'profissional') {
    return NextResponse.json({ error: 'Apenas profissionais podem notificar recomendação.' }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const recomendacaoId = String(body.recomendacao_id ?? '').trim()
  if (!recomendacaoId) {
    return NextResponse.json({ error: 'recomendacao_id obrigatório.' }, { status: 400 })
  }

  let admin
  try {
    admin = createSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })
  }

  const { data: rec } = await admin
    .from('recomendacoes_profissional')
    .select(
      `
      id,
      profissional_indicador:profissional_indicador_id (
        id, usuario_id, nome_completo, nome_usuario, foto_perfil_url, foto_url, categorias
      ),
      profissional_indicado:profissional_indicado_id (
        id, usuario_id, categorias
      )
    `,
    )
    .eq('id', recomendacaoId)
    .maybeSingle()

  if (!rec) {
    return NextResponse.json({ error: 'Recomendação não encontrada.' }, { status: 404 })
  }

  const indicador = joinSupabaseRow(rec.profissional_indicador)
  const indicado = joinSupabaseRow(rec.profissional_indicado)

  if (!indicador?.usuario_id || String(indicador.usuario_id) !== auth.userId) {
    return NextResponse.json({ error: 'Sem permissão nesta recomendação.' }, { status: 403 })
  }

  const catsIndicado = Array.isArray(indicado?.categorias) ? indicado.categorias.map(String) : []
  if (!categoriasIncluemAnfitriao(catsIndicado) || !indicado?.usuario_id) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const parceiro = mapParceiroFinanceiroMeta(indicador)
  if (!parceiro) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  await notificarAnfitriaoFoiRecomendado(admin, {
    recomendacaoId,
    indicadoUsuarioId: String(indicado.usuario_id),
    indicador: parceiro,
  })

  return NextResponse.json({ ok: true })
}
