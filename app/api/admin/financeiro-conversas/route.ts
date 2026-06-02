import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { assertAdminSession } from '@/lib/adminApiAuth'
import { resolverHandleAdmFinanceiro } from '@/lib/financeiroConversaAuditoria'
import {
  abrirConversaFinanceiroAdm,
  listarConversasAbertasAdm,
  listarHistoricoConversasAdm,
  type AlvoTipoFinanceiro,
} from '@/lib/financeiroConversas'
import { inserirNotificacaoCanalFinanceiroProfissional } from '@/lib/canalFinanceiroProfissional'
import { inserirNotificacaoCanalFinanceiroEmpresa } from '@/lib/canalFinanceiroEmpresa'

async function perfisAlvoConversas(
  supabase: SupabaseClient,
  conversas: Array<{ alvo_usuario_id: string; alvo_tipo: AlvoTipoFinanceiro }>,
) {
  const alvoIds = [...new Set(conversas.map((c) => c.alvo_usuario_id))]

  const perfis = new Map<
    string,
    { nome: string; username: string; fotoUrl: string | null; subtitulo: string }
  >()
  if (alvoIds.length === 0) return perfis

  const [{ data: profs }, { data: emps }] = await Promise.all([
    supabase
      .from('profissionais')
      .select('usuario_id, nome_completo, nome_usuario, foto_url, foto_perfil_url, categorias')
      .in('usuario_id', alvoIds),
    supabase
      .from('empresas')
      .select('usuario_id, nome_fantasia, nome_usuario, foto_url, categoria')
      .in('usuario_id', alvoIds),
  ])

  for (const p of profs ?? []) {
    const uid = String(p.usuario_id)
    const nu = String(p.nome_usuario ?? '').trim()
    const cats = Array.isArray(p.categorias) ? p.categorias.join(', ') : ''
    perfis.set(uid, {
      nome: String(p.nome_completo ?? 'Profissional'),
      username: nu ? `@${nu}` : '@—',
      fotoUrl:
        p.foto_perfil_url != null
          ? String(p.foto_perfil_url)
          : p.foto_url != null
            ? String(p.foto_url)
            : null,
      subtitulo: cats,
    })
  }
  for (const e of emps ?? []) {
    const uid = String(e.usuario_id)
    const nu = String(e.nome_usuario ?? '').trim()
    perfis.set(uid, {
      nome: String(e.nome_fantasia ?? 'Empresa'),
      username: nu ? `@${nu}` : '@—',
      fotoUrl: e.foto_url != null ? String(e.foto_url) : null,
      subtitulo: String(e.categoria ?? ''),
    })
  }

  return perfis
}

export async function GET(req: Request) {
  const auth = await assertAdminSession()
  if (!auth.ok) return auth.error

  const url = new URL(req.url)
  const status = url.searchParams.get('status')

  if (status === 'aberta') {
    const conversas = await listarConversasAbertasAdm(auth.supabase, auth.userId)
    const perfis = await perfisAlvoConversas(auth.supabase, conversas)

    return NextResponse.json({
      ok: true,
      conversas: conversas.map((c) => {
        const alvo = perfis.get(c.alvo_usuario_id) ?? {
          nome: 'Usuário',
          username: '@—',
          fotoUrl: null,
          subtitulo: '',
        }
        return {
          ...c,
          alvo: {
            usuarioId: c.alvo_usuario_id,
            nome: alvo.nome,
            username: alvo.username,
            fotoUrl: alvo.fotoUrl,
            subtitulo: alvo.subtitulo,
          },
        }
      }),
    })
  }

  const conversas = await listarHistoricoConversasAdm(auth.supabase, auth.userId)
  const perfis = await perfisAlvoConversas(auth.supabase, conversas)

  return NextResponse.json({
    ok: true,
    conversas: conversas.map((c) => {
      const alvo = perfis.get(c.alvo_usuario_id) ?? {
        nome: 'Usuário',
        username: '@—',
        fotoUrl: null,
        subtitulo: '',
      }
      return {
        ...c,
        alvo: {
          nome: alvo.nome,
          username: alvo.username,
          fotoUrl: alvo.fotoUrl,
        },
      }
    }),
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

  const admHandle = await resolverHandleAdmFinanceiro(auth.supabase, auth.userId)

  const res = await abrirConversaFinanceiroAdm(auth.supabase, {
    admUsuarioId: auth.userId,
    alvoUsuarioId,
    alvoTipo: alvoTipo as AlvoTipoFinanceiro,
    assunto,
    admHandle,
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
