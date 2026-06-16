import { NextResponse } from 'next/server'
import { assertAdminSession } from '@/lib/adminApiAuth'
import {
  atribuirAdmResponsavel,
  buscarPerfisMembroEcossistema,
  listarConversasAbertasAdmEcossistema,
  listarHistoricoConversasAdmEcossistema,
  type MembroTipoEcossistema,
} from '@/lib/ecossistemaConversas'

function parseMembroTipo(raw: string | null): MembroTipoEcossistema | undefined {
  if (raw === 'turista' || raw === 'profissional' || raw === 'empresa') return raw
  return undefined
}

export async function GET(req: Request) {
  const auth = await assertAdminSession()
  if (!auth.ok) return auth.error

  const url = new URL(req.url)
  const status = url.searchParams.get('status')
  const membroTipo = parseMembroTipo(url.searchParams.get('membro_tipo'))

  if (status === 'aberta') {
    const conversas = await listarConversasAbertasAdmEcossistema(auth.supabase, { membroTipo })
    const perfis = await buscarPerfisMembroEcossistema(
      auth.supabase,
      conversas.map((c) => c.membro_usuario_id),
    )

    return NextResponse.json({
      ok: true,
      conversas: conversas.map((c) => {
        const membro = perfis.get(c.membro_usuario_id)
        return {
          ...c,
          membro: membro ?? {
            usuarioId: c.membro_usuario_id,
            nome: 'Usuário',
            username: '@—',
            fotoUrl: null,
            subtitulo: '',
            tipo: c.membro_tipo,
          },
        }
      }),
    })
  }

  const conversas = await listarHistoricoConversasAdmEcossistema(auth.supabase, { membroTipo })
  const perfis = await buscarPerfisMembroEcossistema(
    auth.supabase,
    conversas.map((c) => c.membro_usuario_id),
  )

  return NextResponse.json({
    ok: true,
    conversas: conversas.map((c) => {
      const membro = perfis.get(c.membro_usuario_id)
      return {
        ...c,
        membro: {
          nome: membro?.nome ?? 'Usuário',
          username: membro?.username ?? '@—',
          fotoUrl: membro?.fotoUrl ?? null,
        },
      }
    }),
  })
}

export async function POST(req: Request) {
  const auth = await assertAdminSession()
  if (!auth.ok) return auth.error

  const body = (await req.json()) as Record<string, unknown>
  const conversaId = String(body.conversa_id ?? '').trim()
  if (!conversaId) {
    return NextResponse.json({ error: 'conversa_id obrigatório.' }, { status: 400 })
  }

  const res = await atribuirAdmResponsavel(auth.supabase, conversaId, auth.userId)
  if (!res.ok) {
    return NextResponse.json({ error: res.error ?? 'Erro ao atribuir.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
