import { NextResponse } from 'next/server'
import { assertAdminSession } from '@/lib/adminApiAuth'
import {
  abrirConversaFinanceiroAdm,
  listarHistoricoConversasAdm,
  type AlvoTipoFinanceiro,
} from '@/lib/financeiroConversas'
import { inserirNotificacaoCanalFinanceiroProfissional } from '@/lib/canalFinanceiroProfissional'
import { inserirNotificacaoCanalFinanceiroEmpresa } from '@/lib/canalFinanceiroEmpresa'

export async function GET() {
  const auth = await assertAdminSession()
  if (!auth.ok) return auth.error

  const conversas = await listarHistoricoConversasAdm(auth.supabase, auth.userId)
  const alvoIds = [...new Set(conversas.map((c) => c.alvo_usuario_id))]

  const perfis = new Map<string, { nome: string; username: string; fotoUrl: string | null }>()
  if (alvoIds.length > 0) {
    const [{ data: profs }, { data: emps }] = await Promise.all([
      auth.supabase
        .from('profissionais')
        .select('usuario_id, nome_completo, nome_usuario, foto_url, foto_perfil_url')
        .in('usuario_id', alvoIds),
      auth.supabase
        .from('empresas')
        .select('usuario_id, nome_fantasia, nome_usuario, foto_url')
        .in('usuario_id', alvoIds),
    ])
    for (const p of profs ?? []) {
      const uid = String(p.usuario_id)
      const nu = String(p.nome_usuario ?? '').trim()
      perfis.set(uid, {
        nome: String(p.nome_completo ?? 'Profissional'),
        username: nu ? `@${nu}` : '@—',
        fotoUrl:
          p.foto_perfil_url != null
            ? String(p.foto_perfil_url)
            : p.foto_url != null
              ? String(p.foto_url)
              : null,
      })
    }
    for (const e of emps ?? []) {
      const uid = String(e.usuario_id)
      const nu = String(e.nome_usuario ?? '').trim()
      perfis.set(uid, {
        nome: String(e.nome_fantasia ?? 'Empresa'),
        username: nu ? `@${nu}` : '@—',
        fotoUrl: e.foto_url != null ? String(e.foto_url) : null,
      })
    }
  }

  return NextResponse.json({
    ok: true,
    conversas: conversas.map((c) => ({
      ...c,
      alvo: perfis.get(c.alvo_usuario_id) ?? { nome: 'Usuário', username: '@—', fotoUrl: null },
    })),
  })
}

export async function POST(req: Request) {
  const auth = await assertAdminSession()
  if (!auth.ok) return auth.error

  const body = (await req.json()) as Record<string, unknown>
  const alvoUsuarioId = String(body.alvo_usuario_id ?? '').trim()
  const alvoTipo = body.alvo_tipo === 'empresa' ? 'empresa' : 'profissional'
  const assunto = body.assunto != null ? String(body.assunto) : null
  const notificar = body.notificar !== false

  if (!alvoUsuarioId) {
    return NextResponse.json({ error: 'alvo_usuario_id obrigatório.' }, { status: 400 })
  }

  const res = await abrirConversaFinanceiroAdm(auth.supabase, {
    admUsuarioId: auth.userId,
    alvoUsuarioId,
    alvoTipo: alvoTipo as AlvoTipoFinanceiro,
    assunto,
  })

  if (!res.ok || !res.conversa) {
    return NextResponse.json({ error: res.error ?? 'Erro ao abrir conversa.' }, { status: 500 })
  }

  if (notificar) {
    const titulo = assunto?.trim() || 'Nova conversa com a administração'
    const mensagem = 'Abra o Canal Financeiro para responder à equipe administrativa.'
    if (alvoTipo === 'profissional') {
      await inserirNotificacaoCanalFinanceiroProfissional(auth.supabase, {
        profissionalUsuarioId: alvoUsuarioId,
        tipo: 'mensagem_adm',
        titulo,
        mensagem,
      })
    } else {
      await inserirNotificacaoCanalFinanceiroEmpresa(auth.supabase, {
        empresaUsuarioId: alvoUsuarioId,
        tipo: 'mensagem_adm',
        titulo,
        mensagem,
      })
    }
  }

  return NextResponse.json({ ok: true, conversa: res.conversa })
}
