import { NextResponse } from 'next/server'
import { assertAdminSession, adminPodeRecurso } from '@/lib/adminApiAuth'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { proximaRevisaoDepoisDeAprovacao } from '@/lib/verificacao-documentos'
import { formatProfissionalCategorias } from '@/app/[locale]/(admin)/dashboard/admin/components/verificacao/verificacaoFormatters'

type PerfilVerificacao = 'turistas' | 'profissionais' | 'empresas'

function getTableByTipo(tipo: PerfilVerificacao): 'turistas' | 'profissionais' | 'empresas' {
  return tipo
}

/** Aprovar ou reprovar cadastro (service role — RLS não permite UPDATE admin no client). */
export async function POST(req: Request) {
  try {
    const session = await assertAdminSession()
    if (!session.ok) return session.error

    const { userId } = session
    const adminDb = createSupabaseAdmin()

    const { data: adminRow, error: adminErr } = await adminDb
      .from('usuarios')
      .select('id, email, role, admin_level, admin_permissoes')
      .eq('id', userId)
      .maybeSingle()

    if (adminErr) {
      return NextResponse.json({ error: adminErr.message }, { status: 400 })
    }
    if (!adminRow) {
      return NextResponse.json(
        { error: 'Usuário autenticado sem registro em usuarios. Peça suporte para vincular o perfil ADM.' },
        { status: 403 },
      )
    }

    const body = (await req.json()) as Record<string, unknown>
    const acao = String(body.acao ?? '').trim()
    const tipo = String(body.tipo ?? '').trim() as PerfilVerificacao
    const id = String(body.id ?? '').trim()
    const motivo = body.motivo != null ? String(body.motivo).trim() : ''

    if (!id || !['turistas', 'profissionais', 'empresas'].includes(tipo)) {
      return NextResponse.json({ error: 'Parâmetros inválidos.' }, { status: 400 })
    }

    const role = String(adminRow.role ?? '')
    const nivel = Number(adminRow.admin_level ?? 0)

    if (acao === 'aprovar' && !adminPodeRecurso(adminRow.admin_permissoes, nivel, role, 'aprovar')) {
      return NextResponse.json({ error: 'Sem permissão para aprovar.' }, { status: 403 })
    }
    if (acao === 'reprovar') {
      if (!motivo) return NextResponse.json({ error: 'Motivo obrigatório.' }, { status: 400 })
      if (!adminPodeRecurso(adminRow.admin_permissoes, nivel, role, 'reprovar')) {
        return NextResponse.json({ error: 'Sem permissão para reprovar.' }, { status: 403 })
      }
    }
    if (acao !== 'aprovar' && acao !== 'reprovar') {
      return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
    }

    const table = getTableByTipo(tipo)

    const { data: perfil, error: perfilErr } = await adminDb.from(table).select('usuario_id').eq('id', id).single()
    if (perfilErr) {
      return NextResponse.json({ error: perfilErr.message }, { status: 400 })
    }

    const nowIso = new Date().toISOString()
    const adminEmail = String(adminRow.email ?? 'admin')

    if (acao === 'aprovar') {
      const extraProf =
        tipo === 'profissionais'
          ? {
              docs_verificado: true,
              docs_verificado_por: userId,
              docs_verificado_em: nowIso,
              ultima_revisao_docs_em: nowIso,
              proxima_revisao_docs_em: proximaRevisaoDepoisDeAprovacao(),
            }
          : {}
      const extraEmpresa =
        tipo === 'empresas'
          ? {
              docs_verificado: true,
              docs_verificado_por: userId,
              docs_verificado_em: nowIso,
              verificado_por: userId,
              verificado_em: nowIso,
            }
          : {}

      const { error: updErr } = await adminDb
        .from(table)
        .update({
          status: 'aprovado',
          aprovado_por: userId,
          aprovado_em: nowIso,
          motivo_reprovacao: null,
          prazo_reenvio_dias: null,
          reprovado_em: null,
          reprovado_por: null,
          ...extraProf,
          ...extraEmpresa,
        })
        .eq('id', id)
      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 400 })
      }

      if (perfil?.usuario_id) {
        const { error: userErr } = await adminDb.from('usuarios').update({ status: 'ativo' }).eq('id', perfil.usuario_id)
        if (userErr) {
          return NextResponse.json({ error: userErr.message }, { status: 400 })
        }
      }

      if (tipo === 'profissionais') {
        try {
          const { data: prof } = await adminDb
            .from('profissionais')
            .select('usuario_id, nome_usuario, categorias')
            .eq('id', id)
            .maybeSingle()
          if (prof?.usuario_id) {
            const nomeUsuario = String(prof.nome_usuario ?? '').trim().replace(/^@+/, '')
            const categoriaRotulo = formatProfissionalCategorias(prof.categorias)
            await adminDb.from('posts').insert({
              autor_id: String(prof.usuario_id),
              tipo: 'verificacao_profissional',
              texto: `@${nomeUsuario || 'usuario'} agora é um profissional verificado da plataforma`,
              avaliacao_meta: {
                verificacao_profissional: true,
                categoria_rotulo: categoriaRotulo,
                categorias: prof.categorias,
              },
            })
          }
        } catch {
          /* post no feed é best-effort */
        }
      }

      await adminDb.from('logs_verificacao').insert({
        tipo,
        perfil_id: id,
        acao: 'aprovado',
        admin_id: userId,
        admin_email: adminEmail,
        admin_nivel: nivel,
        alvo_id: null,
        detalhes: { status_final: 'aprovado', modulo: 'verificacao_perfil' },
      })

      return NextResponse.json({ ok: true })
    }

    const { error: reprovErr } = await adminDb
      .from(table)
      .update({
        status: 'reprovado',
        motivo_reprovacao: motivo,
        prazo_reenvio_dias: 7,
        reprovado_em: nowIso,
        reprovado_por: userId,
      })
      .eq('id', id)
    if (reprovErr) {
      return NextResponse.json({ error: reprovErr.message }, { status: 400 })
    }

    if (perfil?.usuario_id) {
      await adminDb.from('usuarios').update({ status: 'reprovado' }).eq('id', perfil.usuario_id)
    }

    await adminDb.from('logs_verificacao').insert({
      tipo,
      perfil_id: id,
      acao: 'reprovado',
      admin_id: userId,
      admin_email: adminEmail,
      admin_nivel: nivel,
      alvo_id: null,
      detalhes: { status_final: 'reprovado', modulo: 'verificacao_perfil', motivo },
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    if (msg.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return NextResponse.json({ error: 'Serviço temporariamente indisponível (configuração do servidor).' }, { status: 503 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
