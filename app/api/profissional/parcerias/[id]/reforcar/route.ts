import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { reforcarParceriaCederFatiaEmpresa } from '@/lib/parceriaComissaoEmpresaRecibo'

/**
 * POST — indicado cede sua fatia 50/50 das comissões de empresa ao indicador (REFORÇAR PARCERIA).
 * Não altera o recibo/split da rota tabelada.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  if (auth.role !== 'profissional' && auth.role !== 'admin') {
    return NextResponse.json({ error: 'Apenas profissionais podem reforçar parceria.' }, { status: 403 })
  }

  const { id: parceriaId } = await ctx.params
  if (!parceriaId) {
    return NextResponse.json({ error: 'id obrigatório.' }, { status: 400 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    body = {}
  }

  const canalItemId =
    body.canal_item_id != null && String(body.canal_item_id).trim()
      ? String(body.canal_item_id).trim()
      : null

  let admin
  try {
    admin = createSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })
  }

  const res = await reforcarParceriaCederFatiaEmpresa(admin, {
    parceriaId,
    indicadoUsuarioId: auth.userId,
    canalItemId,
  })

  if (!res.ok) {
    return NextResponse.json({ error: res.error ?? 'Falha ao reforçar parceria.' }, { status: 400 })
  }

  return NextResponse.json({ ok: true, ja_cedido: Boolean(res.jaCedido) })
}
