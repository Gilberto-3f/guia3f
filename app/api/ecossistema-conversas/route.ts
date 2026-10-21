import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import {
  abrirConversaEcossistemaMembro,
  buscarConversaAbertaMembro,
  listarConversasEcossistemaMembro,
  roleParaMembroTipo,
} from '@/lib/ecossistemaConversas'

export async function GET(req: Request) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  const membroTipo = roleParaMembroTipo(auth.role)
  if (!membroTipo) {
    return NextResponse.json({ error: 'Perfil não autorizado.' }, { status: 403 })
  }

  const url = new URL(req.url)
  const eco = url.searchParams.get('ecossistema_id')
  const ecossistemaId = eco != null && String(eco).trim() ? String(eco).trim() : null

  const [aberta, todas] = await Promise.all([
    buscarConversaAbertaMembro(auth.supabase, auth.userId, ecossistemaId),
    listarConversasEcossistemaMembro(auth.supabase, auth.userId, { ecossistemaId }),
  ])

  const arquivadas = todas.filter((c) => c.status === 'encerrada')

  return NextResponse.json({
    ok: true,
    membroTipo,
    conversaAberta: aberta,
    arquivadas,
  })
}

export async function POST(req: Request) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  const membroTipo = roleParaMembroTipo(auth.role)
  if (!membroTipo) {
    return NextResponse.json({ error: 'Perfil não autorizado.' }, { status: 403 })
  }

  const body = (await req.json()) as Record<string, unknown>
  const assunto = body.assunto != null ? String(body.assunto) : null
  const motivoRaw = String(body.motivo_emergencia ?? body.motivo ?? '').trim()
  const motivoEmergencia =
    motivoRaw === 'socorro' || motivoRaw === 'item_esquecido' ? motivoRaw : null
  const ecossistemaId = body.ecossistema_id != null ? String(body.ecossistema_id).trim() : ''

  const res = await abrirConversaEcossistemaMembro(auth.supabase, {
    membroUsuarioId: auth.userId,
    membroTipo,
    assunto,
    motivoEmergencia,
    ecossistemaId: ecossistemaId || null,
  })

  if (!res.ok || !res.conversa) {
    return NextResponse.json({ error: res.error ?? 'Erro ao abrir chat.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, conversa: res.conversa, criada: res.criada === true })
}
