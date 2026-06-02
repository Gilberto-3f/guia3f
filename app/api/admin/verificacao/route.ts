import { NextResponse } from 'next/server'
import {
  assertAdminSession,
  adminPodeRecurso,
  jsonAdminError,
  loadAdminUsuarioRow,
} from '@/lib/adminApiAuth'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { enviarMensagemAprovacaoCanalFinanceiro } from '@/lib/canalFinanceiroAprovacaoCadastro'
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

    const { userId: authUserId, email: authEmail } = session

    let adminDb
    try {
      adminDb = createSupabaseAdmin()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'service_role_missing'
      console.error('[api/admin/verificacao] createSupabaseAdmin', msg)
      return jsonAdminError(
        503,
        'service_role',
        'Serviço indisponível: configure SUPABASE_SERVICE_ROLE_KEY no servidor (Vercel).',
      )
    }

    const { row: adminRow, actorId, dbError } = await loadAdminUsuarioRow(authUserId, authEmail)
    if (dbError) {
      return jsonAdminError(503, 'load_admin', `Falha ao carregar admin: ${dbError}`)
    }
    if (!adminRow) {
      return jsonAdminError(
        403,
        'admin_not_found',
        'Administrador não encontrado em usuarios. Confira se o e-mail do login existe na tabela com role=admin.',
        { authUserId },
      )
    }

    const body = (await req.json()) as Record<string, unknown>
    const acao = String(body.acao ?? '').trim()
    const tipo = String(body.tipo ?? '').trim() as PerfilVerificacao
    const id = String(body.id ?? '').trim()
    const motivo = body.motivo != null ? String(body.motivo).trim() : ''

    if (!id || !['turistas', 'profissionais', 'empresas'].includes(tipo)) {
      return jsonAdminError(400, 'params', 'Parâmetros inválidos (tipo ou id).')
    }

    const role = String(adminRow.role ?? '')
    const nivel = Number(adminRow.admin_level ?? 0)

    if (acao === 'aprovar' && !adminPodeRecurso(adminRow.admin_permissoes, nivel, role, 'aprovar')) {
      console.error('[api/admin/verificacao] sem recurso aprovar', { actorId, role, nivel })
      return jsonAdminError(403, 'permission', 'Sem permissão para aprovar (admin_permissoes.recursos).')
    }
    if (acao === 'reprovar') {
      if (!motivo) return jsonAdminError(400, 'params', 'Motivo da reprovação é obrigatório.')
      if (!adminPodeRecurso(adminRow.admin_permissoes, nivel, role, 'reprovar')) {
        return jsonAdminError(403, 'permission', 'Sem permissão para reprovar (admin_permissoes.recursos).')
      }
    }
    if (acao !== 'aprovar' && acao !== 'reprovar') {
      return jsonAdminError(400, 'params', 'Ação inválida. Use aprovar ou reprovar.')
    }

    const table = getTableByTipo(tipo)

    const { data: perfil, error: perfilErr } = await adminDb.from(table).select('usuario_id').eq('id', id).single()
    if (perfilErr) {
      console.error('[api/admin/verificacao] perfil', perfilErr.message)
      return jsonAdminError(400, 'load_perfil', perfilErr.message)
    }

    const nowIso = new Date().toISOString()
    const adminEmail = String(adminRow.email ?? authEmail ?? 'admin')

    if (acao === 'aprovar') {
      const extraProf =
        tipo === 'profissionais'
          ? {
              docs_verificado: true,
              docs_verificado_por: actorId,
              docs_verificado_em: nowIso,
              ultima_revisao_docs_em: nowIso,
              proxima_revisao_docs_em: proximaRevisaoDepoisDeAprovacao(),
            }
          : {}
      const extraEmpresa =
        tipo === 'empresas'
          ? {
              docs_verificado: true,
              docs_verificado_por: actorId,
              docs_verificado_em: nowIso,
              verificado_por: actorId,
              verificado_em: nowIso,
            }
          : {}

      const { error: updErr } = await adminDb
        .from(table)
        .update({
          status: 'aprovado',
          aprovado_por: actorId,
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
        console.error('[api/admin/verificacao] update aprovar', updErr.message)
        return jsonAdminError(400, 'update_perfil', updErr.message)
      }

      if (perfil?.usuario_id) {
        const { error: userErr } = await adminDb
          .from('usuarios')
          .update({ status: 'ativo' })
          .eq('id', perfil.usuario_id)
        if (userErr) {
          console.error('[api/admin/verificacao] update usuario', userErr.message)
          return jsonAdminError(400, 'update_usuario', userErr.message)
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
            const msgFin = await enviarMensagemAprovacaoCanalFinanceiro(adminDb, {
              tipo: 'profissional',
              usuarioId: String(prof.usuario_id),
              nomeUsuario,
            })
            if (!msgFin.ok) {
              console.error('[api/admin/verificacao] canal financeiro profissional:', msgFin.error)
            }
          }
        } catch (e) {
          console.warn('[api/admin/verificacao] profissional pós-aprovação', e)
        }
      }

      if (tipo === 'empresas') {
        try {
          const { data: emp } = await adminDb
            .from('empresas')
            .select('usuario_id, nome_usuario')
            .eq('id', id)
            .maybeSingle()
          if (emp?.usuario_id) {
            const nomeUsuario = String(emp.nome_usuario ?? '').trim().replace(/^@+/, '')
            const msgFin = await enviarMensagemAprovacaoCanalFinanceiro(adminDb, {
              tipo: 'empresa',
              usuarioId: String(emp.usuario_id),
              nomeUsuario,
            })
            if (!msgFin.ok) {
              console.error('[api/admin/verificacao] canal financeiro empresa:', msgFin.error)
            }
          }
        } catch (e) {
          console.warn('[api/admin/verificacao] empresa pós-aprovação', e)
        }
      }

      const { error: logErr } = await adminDb.from('logs_verificacao').insert({
        tipo,
        perfil_id: id,
        acao: 'aprovado',
        admin_id: actorId,
        admin_email: adminEmail,
        admin_nivel: nivel,
        alvo_id: null,
        detalhes: { status_final: 'aprovado', modulo: 'verificacao_perfil', auth_user_id: authUserId },
      })
      if (logErr) {
        console.warn('[api/admin/verificacao] log insert', logErr.message)
      }

      return NextResponse.json({ ok: true })
    }

    const { error: reprovErr } = await adminDb
      .from(table)
      .update({
        status: 'reprovado',
        motivo_reprovacao: motivo,
        prazo_reenvio_dias: 7,
        reprovado_em: nowIso,
        reprovado_por: actorId,
      })
      .eq('id', id)
    if (reprovErr) {
      console.error('[api/admin/verificacao] reprovar', reprovErr.message)
      return jsonAdminError(400, 'update_perfil', reprovErr.message)
    }

    if (perfil?.usuario_id) {
      await adminDb.from('usuarios').update({ status: 'reprovado' }).eq('id', perfil.usuario_id)
    }

    await adminDb.from('logs_verificacao').insert({
      tipo,
      perfil_id: id,
      acao: 'reprovado',
      admin_id: actorId,
      admin_email: adminEmail,
      admin_nivel: nivel,
      alvo_id: null,
      detalhes: { status_final: 'reprovado', modulo: 'verificacao_perfil', motivo, auth_user_id: authUserId },
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    console.error('[api/admin/verificacao] unhandled', msg)
    if (msg.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return jsonAdminError(
        503,
        'service_role',
        'Serviço temporariamente indisponível (SUPABASE_SERVICE_ROLE_KEY).',
      )
    }
    return jsonAdminError(500, 'internal', msg)
  }
}
