import { NextResponse } from 'next/server'
import { assertAdminSession, jsonAdminError, loadAdminUsuarioRow } from '@/lib/adminApiAuth'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { validarAssinaturaDinheiroEmpresa } from '@/lib/empresaAssinatura'
import { labelModalidadePlano } from '@/lib/contratarPlanoEmpresa'
import { labelFormaPagamentoPlano, statusExibicaoAssinante, diasParaVencimento } from '@/lib/empresaAssinatura'

function isAdminFinanceiro(adminRow: { admin_level?: number | null; admin_permissoes?: unknown } | null) {
  const nivel = Number(adminRow?.admin_level ?? 0)
  const cargo = (adminRow?.admin_permissoes as { cargo?: string })?.cargo
  return nivel === 1 || cargo === 'FINANCEIRO'
}

type EmpresaJoin = {
  id: string
  nome_fantasia: string | null
  nome_usuario: string | null
  foto_url: string | null
  docs_verificado_em: string | null
  docs_verificado_por: string | null
  usuario_id: string | null
}

async function mapVerificador(
  adminDb: ReturnType<typeof createSupabaseAdmin>,
  verificadorId: string | null,
) {
  if (!verificadorId) return { id: null, email: null, username: null }
  const { data } = await adminDb
    .from('usuarios')
    .select('id, email, username')
    .eq('id', verificadorId)
    .maybeSingle()
  return {
    id: data?.id != null ? String(data.id) : null,
    email: data?.email != null ? String(data.email) : null,
    username: data?.username != null ? String(data.username) : null,
  }
}

async function mapEmpresaCard(adminDb: ReturnType<typeof createSupabaseAdmin>, emp: EmpresaJoin) {
  const verificador = await mapVerificador(adminDb, emp.docs_verificado_por)
  return {
    empresa_id: emp.id,
    usuario_id: emp.usuario_id,
    nome: emp.nome_fantasia ?? 'Empresa',
    username: emp.nome_usuario ?? '',
    foto_url: emp.foto_url,
    verificado_em: emp.docs_verificado_em,
    verificado_por: verificador,
  }
}

/** Lista solicitações ou assinantes (ADM Financeiro). */
export async function GET(req: Request) {
  try {
    const auth = await assertAdminSession()
    if (!auth.ok) return auth.error

    const { row: adminRow } = await loadAdminUsuarioRow(auth.userId, auth.email)
    if (!isAdminFinanceiro(adminRow)) {
      return jsonAdminError(403, 'forbidden', 'Apenas ADM Geral ou ADM Financeiro.')
    }

    const url = new URL(req.url)
    const aba = url.searchParams.get('aba') === 'assinantes' ? 'assinantes' : 'solicitacoes'

    const adminDb = createSupabaseAdmin()
    const agora = new Date()

    if (aba === 'solicitacoes') {
      const { data, error } = await adminDb
        .from('empresa_assinaturas')
        .select(
          `
          id, empresa_id, plano_titulo, plano_nome, modalidade, forma_pagamento, valor, status, assinado_em, vencimento_em,
          empresas ( id, nome_fantasia, nome_usuario, foto_url, docs_verificado_em, docs_verificado_por, usuario_id )
        `,
        )
        .eq('status', 'pendente')
        .eq('forma_pagamento', 'dinheiro')
        .order('assinado_em', { ascending: true })

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      const items = []
      for (const row of data ?? []) {
        const empRaw = row.empresas
        const emp = (Array.isArray(empRaw) ? empRaw[0] : empRaw) as EmpresaJoin | null
        if (!emp) continue
        const empresa = await mapEmpresaCard(adminDb, emp)
        items.push({
          tipo: 'solicitacao',
          id: String(row.id),
          assinado_em: String(row.assinado_em ?? ''),
          plano_titulo: String(row.plano_titulo ?? ''),
          modalidade: String(row.modalidade ?? ''),
          modalidade_label: labelModalidadePlano(String(row.modalidade ?? 'mensal') as 'mensal'),
          forma_pagamento: String(row.forma_pagamento ?? ''),
          forma_pagamento_label: labelFormaPagamentoPlano(String(row.forma_pagamento ?? 'dinheiro') as 'dinheiro'),
          valor: Number(row.valor) || 0,
          empresa,
        })
      }

      return NextResponse.json({ ok: true, aba, items })
    }

    const [{ data: assinaturas, error: errA }, { data: degustacoes, error: errD }] = await Promise.all([
      adminDb
        .from('empresa_assinaturas')
        .select(
          `
          id, empresa_id, plano_titulo, plano_nome, modalidade, forma_pagamento, valor, status, assinado_em, vencimento_em, validado_em,
          empresas ( id, nome_fantasia, nome_usuario, foto_url, docs_verificado_em, docs_verificado_por, usuario_id )
        `,
        )
        .in('status', ['ativo', 'inativo'])
        .order('assinado_em', { ascending: true }),
      adminDb
        .from('empresa_degustacoes')
        .select(
          `
          id, empresa_id, dias, status, inicio_em, expira_em, created_at,
          planos ( titulo, nome ),
          empresas ( id, nome_fantasia, nome_usuario, foto_url, docs_verificado_em, docs_verificado_por, usuario_id )
        `,
        )
        .in('status', ['ativa', 'expirada'])
        .order('created_at', { ascending: true }),
    ])

    if (errA) return NextResponse.json({ error: errA.message }, { status: 500 })
    if (errD) return NextResponse.json({ error: errD.message }, { status: 500 })

    const items: Record<string, unknown>[] = []

    for (const row of assinaturas ?? []) {
      const empRaw = row.empresas
      const emp = (Array.isArray(empRaw) ? empRaw[0] : empRaw) as EmpresaJoin | null
      if (!emp) continue
      const empresa = await mapEmpresaCard(adminDb, emp)
      const statusDb = String(row.status ?? 'inativo') as 'ativo' | 'inativo'
      const vencimento = row.vencimento_em != null ? String(row.vencimento_em) : null
      const badge = statusExibicaoAssinante({ status: statusDb, vencimento_em: vencimento, agora })
      const diasVenc = diasParaVencimento(vencimento, agora)
      items.push({
        tipo: 'assinatura',
        id: String(row.id),
        assinado_em: String(row.assinado_em ?? ''),
        plano_titulo: String(row.plano_titulo ?? ''),
        modalidade: String(row.modalidade ?? ''),
        modalidade_label: labelModalidadePlano(String(row.modalidade ?? 'mensal') as 'mensal'),
        forma_pagamento: String(row.forma_pagamento ?? ''),
        forma_pagamento_label: labelFormaPagamentoPlano(String(row.forma_pagamento ?? 'pix') as 'pix'),
        valor: Number(row.valor) || 0,
        vencimento_em: vencimento,
        dias_para_vencimento: diasVenc,
        status_badge: badge,
        empresa,
        sort_ts: new Date(String(row.assinado_em ?? 0)).getTime(),
      })
    }

    for (const row of degustacoes ?? []) {
      const empRaw = row.empresas
      const emp = (Array.isArray(empRaw) ? empRaw[0] : empRaw) as EmpresaJoin | null
      if (!emp) continue
      const planosRaw = row.planos
      const plano = Array.isArray(planosRaw) ? planosRaw[0] : planosRaw
      const expira = row.expira_em != null ? String(row.expira_em) : null
      const expirada =
        String(row.status ?? '') === 'expirada' ||
        (expira ? new Date(expira).getTime() < agora.getTime() : false)
      const empresa = await mapEmpresaCard(adminDb, emp)
      items.push({
        tipo: 'degustacao',
        id: String(row.id),
        assinado_em: String(row.inicio_em ?? row.created_at ?? ''),
        plano_titulo: plano?.titulo != null ? String(plano.titulo) : 'Degustação',
        modalidade: 'degustacao',
        modalidade_label: `${Number(row.dias) || 0} dias`,
        forma_pagamento: 'degustacao',
        forma_pagamento_label: 'Degustação',
        valor: 0,
        expira_em: expira,
        status_badge: expirada ? 'DEGUSTACAO_ENCERRADA' : 'MODO_DEGUSTACAO',
        empresa,
        sort_ts: new Date(String(row.inicio_em ?? row.created_at ?? 0)).getTime(),
      })
    }

    items.sort((a, b) => Number(a.sort_ts) - Number(b.sort_ts))

    return NextResponse.json({ ok: true, aba, items })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/** Valida assinatura em dinheiro (pendente → ativo). */
export async function POST(req: Request) {
  try {
    const auth = await assertAdminSession()
    if (!auth.ok) return auth.error

    const { row: adminRow, actorId } = await loadAdminUsuarioRow(auth.userId, auth.email)
    if (!isAdminFinanceiro(adminRow)) {
      return jsonAdminError(403, 'forbidden', 'Apenas ADM Geral ou ADM Financeiro.')
    }

    const body = (await req.json()) as Record<string, unknown>
    const assinaturaId = String(body.assinatura_id ?? '').trim()
    if (!assinaturaId) {
      return NextResponse.json({ error: 'assinatura_id é obrigatório.' }, { status: 400 })
    }

    const adminDb = createSupabaseAdmin()
    const res = await validarAssinaturaDinheiroEmpresa(adminDb, {
      assinaturaId,
      adminUsuarioId: actorId,
    })

    if (!res.ok) {
      return NextResponse.json({ error: res.error ?? 'Não foi possível validar.' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
