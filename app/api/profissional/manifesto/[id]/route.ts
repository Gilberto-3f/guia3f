import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { buscarProfissionalPlacaVermelha, filtrarEmpresaIds, inserirAtrativosManifesto, inserirPassageiroManifesto } from '@/lib/manifestoDiario'

type RouteCtx = { params: Promise<{ id: string }> }

/** Atualiza manifesto (apenas rascunho). */
export async function PATCH(req: Request, ctx: RouteCtx) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  const prof = await buscarProfissionalPlacaVermelha(auth.supabase, auth.userId)
  if (!prof?.placa_vermelha) {
    return NextResponse.json({ error: 'Acesso restrito a profissionais com placa vermelha.' }, { status: 403 })
  }

  const { id } = await ctx.params
  const body = (await req.json()) as Record<string, unknown>

  const { data: md } = await auth.supabase
    .from('manifesto_diario')
    .select('id, status')
    .eq('id', id)
    .eq('profissional_id', prof.id)
    .maybeSingle()

  if (!md) return NextResponse.json({ error: 'Manifesto não encontrado.' }, { status: 404 })
  if (String(md.status) !== 'rascunho') {
    return NextResponse.json({ error: 'Só é possível editar manifestos em rascunho.' }, { status: 400 })
  }

  if (body.confirmar === true) {
    const agora = new Date().toISOString()
    await auth.supabase
      .from('manifesto_diario')
      .update({ status: 'confirmado', confirmado_em: agora, updated_at: agora })
      .eq('id', id)
  }

  if (Array.isArray(body.passageiros)) {
    for (const p of body.passageiros) {
      if (typeof p !== 'object' || !p) continue
      const pb = p as Record<string, unknown>
      const turistaId = String(pb.turista_id ?? '').trim()
      if (!turistaId) continue
      await inserirPassageiroManifesto(auth.supabase, {
        manifestoId: id,
        turistaUsuarioId: turistaId,
        nome: String(pb.nome ?? 'Turista'),
        documento: pb.documento != null ? String(pb.documento) : null,
        username: pb.username != null ? String(pb.username) : null,
        contratacaoTipo: String(pb.contratacao_tipo ?? 'contratacao_direta') as 'indicacao',
      })
    }
  }

  if (Array.isArray(body.atrativos)) {
    for (const a of body.atrativos) {
      if (typeof a !== 'object' || !a) continue
      const ab = a as Record<string, unknown>
      const empresaId = String(ab.empresa_id ?? '').trim()
      const turistaId = String(ab.turista_id ?? '').trim()
      if (!empresaId || !turistaId) continue
      await inserirAtrativosManifesto(auth.supabase, {
        manifestoId: id,
        turistaUsuarioId: turistaId,
        empresaIds: filtrarEmpresaIds([empresaId]),
      })
    }
  }

  return NextResponse.json({ ok: true })
}
