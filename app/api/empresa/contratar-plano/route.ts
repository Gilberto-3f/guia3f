import { NextResponse } from 'next/server'
import { type ModalidadePlanoEmpresa } from '@/lib/contratarPlanoEmpresa'
import { registrarAssinaturaPlanoEmpresa } from '@/lib/empresaAssinatura'
import type { FormaPagamentoPlano } from '@/lib/pagamentoPlanoEmpresa'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { assertUserSession } from '@/lib/apiUserSession'

/** Empresa contrata plano do catálogo ADM (aba Planos do canal financeiro). */
export async function POST(req: Request) {
  try {
    const session = await assertUserSession()
    if (!session.ok) return session.error

    if (String(session.role ?? '') !== 'empresa') {
      return NextResponse.json({ error: 'Apenas empresas podem contratar planos.' }, { status: 403 })
    }

    const body = (await req.json()) as Record<string, unknown>
    const planoId = String(body.plano_id ?? '').trim()
    const modalidade = String(body.modalidade ?? '') as ModalidadePlanoEmpresa
    const formaRaw = String(body.forma_pagamento ?? 'pix').trim() as FormaPagamentoPlano
    const formaPagamento: FormaPagamentoPlano =
      formaRaw === 'cartao' || formaRaw === 'pix' || formaRaw === 'dinheiro' ? formaRaw : 'pix'

    const visitaAgendadaEm = body.visita_agendada_em != null ? String(body.visita_agendada_em).trim() : ''
    const visitaResponsavelNome =
      body.visita_responsavel_nome != null ? String(body.visita_responsavel_nome).trim() : ''
    const visitaResponsavelWhatsapp =
      body.visita_responsavel_whatsapp != null ? String(body.visita_responsavel_whatsapp).trim() : ''

    if (!planoId) {
      return NextResponse.json({ error: 'plano_id é obrigatório.' }, { status: 400 })
    }

    const res = await registrarAssinaturaPlanoEmpresa(createSupabaseAdmin(), {
      empresaUsuarioId: session.userId,
      planoId,
      modalidade,
      formaPagamento,
      visitaDinheiro:
        formaPagamento === 'dinheiro'
          ? {
              visitaAgendadaEm,
              responsavelNome: visitaResponsavelNome,
              responsavelWhatsapp: visitaResponsavelWhatsapp,
            }
          : null,
    })

    if (!res.ok) {
      return NextResponse.json({ error: res.error ?? 'Não foi possível contratar.' }, { status: 400 })
    }

    return NextResponse.json({
      ok: true,
      plano_titulo: res.planoTitulo,
      plano_contratado: res.planoContratado ?? false,
      assinatura_id: res.assinaturaId,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
