import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { concluirAtendimentoManifesto } from '@/lib/manifestoLista'
import { registrarConfirmacaoTuristaSemCheckin } from '@/lib/manifestoFinalizacaoSemCheckin'

type Ctx = { params: Promise<{ id: string }> }

/** Turista confirma (ou registra OUTRO) a finalização sem check-in. */
export async function POST(req: Request, ctx: Ctx) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  const { id } = await ctx.params
  const solicitacaoId = String(id ?? '').trim()
  if (!solicitacaoId) {
    return NextResponse.json({ error: 'id obrigatório.' }, { status: 400 })
  }

  let body: Record<string, unknown> = {}
  try {
    const raw = await req.text()
    if (raw.trim()) body = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  let admin
  try {
    admin = createSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })
  }

  const confirma = body.confirma === true
  const outro = body.outro != null ? String(body.outro) : null

  const res = await registrarConfirmacaoTuristaSemCheckin(admin, {
    solicitacaoId,
    turistaUsuarioId: auth.userId,
    confirma,
    outroTexto: outro,
  })
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })

  if (res.todosConfirmaram) {
    const { data: md } = await admin
      .from('manifesto_diario')
      .select('profissional_id')
      .eq('id', res.manifestoId)
      .maybeSingle()
    const profId = md?.profissional_id != null ? String(md.profissional_id) : ''
    const { data: prof } = profId
      ? await admin.from('profissionais').select('id, usuario_id').eq('id', profId).maybeSingle()
      : { data: null }
    if (!prof?.id || !prof.usuario_id) {
      return NextResponse.json({ error: 'Profissional do manifesto não encontrado.' }, { status: 400 })
    }
    const fim = await concluirAtendimentoManifesto(admin, {
      manifestoId: res.manifestoId,
      profissionalId: String(prof.id),
      profissionalUsuarioId: String(prof.usuario_id),
      pularCheckin: true,
    })
    if (!fim.ok) return NextResponse.json({ error: fim.error }, { status: 400 })
    return NextResponse.json({ ok: true, concluido: true })
  }

  return NextResponse.json({ ok: true, concluido: false })
}
