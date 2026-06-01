import { NextResponse } from 'next/server'
import { assertAdminSession } from '@/lib/adminApiAuth'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { proximaRevisaoDepoisDeAprovacao } from '@/lib/verificacao-documentos'
import { formatProfissionalCategorias } from '@/app/[locale]/(admin)/dashboard/admin/components/verificacao/verificacaoFormatters'

type PerfilVerificacao = 'turistas' | 'profissionais' | 'empresas'

function adminTemRecurso(adminPermissoes: unknown, recurso: string): boolean {
  const raw = adminPermissoes as { recursos?: string[] } | null
  const recursos = Array.isArray(raw?.recursos) ? raw.recursos : []
  return recursos.includes('*') || recursos.includes(recurso)
}

function getTableByTipo(tipo: PerfilVerificacao): 'turistas' | 'profissionais' | 'empresas' {
  return tipo
}

/** Aprovar ou reprovar cadastro (service role — RLS não permite UPDATE admin no client). */
export async function POST(req: Request) {
  try {
    const session = await assertAdminSession()
    if (!session.ok) return session.error

    const { supabase: supabaseUser, userId } = session

    const { data: adminRow, error: adminErr } = await supabaseUser
      .from('usuarios')
      .select('id, email, username, admin_level, admin_permissoes')
      .eq('id', userId)
      .maybeSingle()
    if (adminErr || !adminRow) {
      return NextResponse.json({ error: 'Admin não encontrado.' }, { status: 403 })
    }

    const body = (await req.json()) as Record<string, unknown>
    const acao = String(body.acao ?? '').trim()
    const tipo = String(body.tipo ?? '').trim() as PerfilVerificacao
    const id = String(body.id ?? '').trim()
    const motivo = body.motivo != null ? String(body.motivo).trim() : ''

    if (!id || !['turistas', 'profissionais', 'empresas'].includes(tipo)) {
      return NextResponse.json({ error: 'Parâmetros inválidos.' }, { status: 400 })
    }

    if (acao === 'aprovar' && !adminTemRecurso(adminRow.admin_permissoes, 'aprovar')) {
      return NextResponse.json({ error: 'Sem permissão para aprovar.' }, { status: 403 })
    }
    if (acao === 'reprovar') {
      if (!motivo) return NextResponse.json({ error: 'Motivo obrigatório.' }, { status: 400 })
      if (!adminTemRecurso(adminRow.admin_permissoes, 'reprovar')) {
        return NextResponse.json({ error: 'Sem permissão para reprovar.' }, { status: 403 })
      }
    }
    if (acao !== 'aprovar' && acao !== 'reprovar') {
      return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
    }

    const admin = createSupabaseAdmin()
    const table = getTableByTipo(tipo)

    const { data: perfil, error: perfilErr } = await admin.from(table).select('usuario_id').eq('id', id).single()
    if (perfilErr) {
      return NextResponse.json({ error: perfilErr.message }, { status: 400 })
    }

    const nowIso = new Date().toISOString()

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

      const { error: updErr } = await admin
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
        const { error: userErr } = await admin.from('usuarios').update({ status: 'ativo' }).eq('id', perfil.usuario_id)
        if (userErr) {
          return NextResponse.json({ error: userErr.message }, { status: 400 })
        }
      }

      if (tipo === 'profissionais') {
        try {
          const { data: prof } = await admin
            .from('profissionais')
            .select('usuario_id, nome_usuario, categorias')
            .eq('id', id)
            .maybeSingle()
          if (prof?.usuario_id) {
            const nomeUsuario = String(prof.nome_usuario ?? '').trim().replace(/^@+/, '')
            const categoriaRotulo = formatProfissionalCategorias(prof.categorias)
            await admin.from('posts').insert({
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

      await admin.from('logs_verificacao').insert({
        tipo,
        perfil_id: id,
        acao: 'aprovado',
        admin_id: userId,
        admin_email: adminRow.email ?? adminRow.username ?? 'admin',
        admin_nivel: adminRow.admin_level ?? 0,
        alvo_id: null,
        detalhes: { status_final: 'aprovado', modulo: 'verificacao_perfil' },
      })

      return NextResponse.json({ ok: true })
    }

    const { error: reprovErr } = await admin
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
      await admin.from('usuarios').update({ status: 'reprovado' }).eq('id', perfil.usuario_id)
    }

    await admin.from('logs_verificacao').insert({
      tipo,
      perfil_id: id,
      acao: 'reprovado',
      admin_id: userId,
      admin_email: adminRow.email ?? adminRow.username ?? 'admin',
      admin_nivel: adminRow.admin_level ?? 0,
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
