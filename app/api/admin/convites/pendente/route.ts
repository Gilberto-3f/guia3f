import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { rotuloComunidadeModerador, rotuloFuncaoAdmin, rotuloPaisModerador } from '@/lib/adminConvites'

export async function GET() {
  try {
    const session = await assertUserSession()
    if (!session.ok) return session.error

    let adminDb
    try {
      adminDb = createSupabaseAdmin()
    } catch {
      return NextResponse.json({ error: 'server_config' }, { status: 503 })
    }

    const { data: convite } = await adminDb
      .from('convites_admin')
      .select('id, nivel, comunidade, pais, convidado_em, expira_em, convidado_por')
      .eq('usuario_id', session.userId)
      .eq('status', 'pendente')
      .gt('expira_em', new Date().toISOString())
      .order('convidado_em', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!convite?.id) {
      return NextResponse.json({ convite: null })
    }

    let convidadoPorNome = 'ADM GERAL'
    if (convite.convidado_por) {
      const convidadoPor = String(convite.convidado_por)
      const [{ data: conv }, { data: prof }, { data: tur }] = await Promise.all([
        adminDb.from('usuarios').select('username, email').eq('id', convidadoPor).maybeSingle(),
        adminDb
          .from('profissionais')
          .select('nome_completo, nome_usuario')
          .eq('usuario_id', convidadoPor)
          .maybeSingle(),
        adminDb
          .from('turistas')
          .select('nome_completo, nome_usuario')
          .eq('usuario_id', convidadoPor)
          .maybeSingle(),
      ])
      convidadoPorNome =
        String(prof?.nome_completo ?? '').trim() ||
        String(tur?.nome_completo ?? '').trim() ||
        String(prof?.nome_usuario ?? tur?.nome_usuario ?? conv?.username ?? '')
          .replace(/^@+/, '')
          .trim() ||
        String(conv?.email ?? '').split('@')[0] ||
        'ADM GERAL'
    }

    return NextResponse.json({
      convite: {
        id: convite.id,
        nivel: convite.nivel,
        funcao: rotuloFuncaoAdmin(Number(convite.nivel)),
        comunidade: rotuloComunidadeModerador(convite.comunidade),
        pais: rotuloPaisModerador(convite.pais),
        convidado_por: convidadoPorNome,
        expira_em: convite.expira_em,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
