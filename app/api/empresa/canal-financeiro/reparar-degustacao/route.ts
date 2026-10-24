import { NextResponse } from 'next/server'
import { enviarAvisoCadastroLiberadoRelatoriosEmpresa } from '@/lib/canalFinanceiroAprovacaoCadastro'
import { repararLeituraDegustacaoConcluidaEmpresa } from '@/lib/canalFinanceiroEmpresaLeitura.server'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { assertUserSession } from '@/lib/apiUserSession'
import { empresaRecursosLiberados } from '@/lib/verificacao-documentos'

/** Repara canal_financeiro de degustações já aceitas/encerradas (não marca convites pendentes). */
export async function POST() {
  try {
    const session = await assertUserSession()
    if (!session.ok) return session.error

    const { data: emp } = await session.supabase
      .from('empresas')
      .select('id, somente_anfitriao, status, docs_verificado, aprovado_em, verificado_em')
      .eq('usuario_id', session.userId)
      .maybeSingle()
    if (!emp?.id) {
      return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
    }
    const empresaId = String(emp.id)

    await repararLeituraDegustacaoConcluidaEmpresa(session.supabase, empresaId)

    if (emp.somente_anfitriao !== true) {
      try {
        const { data: userRow } = await session.supabase
          .from('usuarios')
          .select('status')
          .eq('id', session.userId)
          .maybeSingle()
        if (empresaRecursosLiberados(userRow?.status != null ? String(userRow.status) : null, emp)) {
          const aviso = await enviarAvisoCadastroLiberadoRelatoriosEmpresa(
            createSupabaseAdmin(),
            session.userId,
          )
          if (!aviso.ok) {
            console.error('[reparar-degustacao] cadastro liberado:', aviso.error)
          }
        }
      } catch (e) {
        console.warn('[reparar-degustacao] cadastro liberado', e)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
