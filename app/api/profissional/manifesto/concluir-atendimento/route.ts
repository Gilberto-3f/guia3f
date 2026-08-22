import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { buscarProfissionalPlacaVermelha } from '@/lib/manifestoDiario'
import { concluirAtendimentoManifesto } from '@/lib/manifestoLista'

/** CONCLUIR ATENDIMENTO no fim da aba LISTA (guia/van). */
export async function POST(req: Request) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  const prof = await buscarProfissionalPlacaVermelha(auth.supabase, auth.userId)
  if (!prof?.placa_vermelha) {
    return NextResponse.json({ error: 'Acesso restrito a profissionais com placa vermelha.' }, { status: 403 })
  }

  const body = (await req.json()) as Record<string, unknown>
  const manifestoId = String(body.manifesto_id ?? '').trim()
  if (!manifestoId) {
    return NextResponse.json({ error: 'manifesto_id obrigatório.' }, { status: 400 })
  }

  const res = await concluirAtendimentoManifesto(auth.supabase, {
    manifestoId,
    profissionalId: prof.id,
    profissionalUsuarioId: auth.userId,
    pagamentoConfirmado: body.pagamento_confirmado === true,
  })
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
