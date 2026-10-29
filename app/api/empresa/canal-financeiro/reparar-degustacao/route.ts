import { NextResponse } from 'next/server'
import {
  garantirAvisoCadastroLiberadoRelatoriosEmpresa,
  garantirBoasVindasAposPlanoEmpresa,
} from '@/lib/canalFinanceiroAprovacaoCadastro'
import { repararLeituraDegustacaoConcluidaEmpresa } from '@/lib/canalFinanceiroEmpresaLeitura.server'
import { assinaturaContratadaVigente } from '@/lib/empresaAssinatura'
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

    let avisoRelatorios: { ok: boolean; error?: string; skipped?: boolean } | null = null
    let bemVindo: { ok: boolean; error?: string; skipped?: boolean } | null = null
    if (emp.somente_anfitriao !== true) {
      try {
        const { data: userRow } = await session.supabase
          .from('usuarios')
          .select('status')
          .eq('id', session.userId)
          .maybeSingle()
        if (empresaRecursosLiberados(userRow?.status != null ? String(userRow.status) : null, emp)) {
          const admin = createSupabaseAdmin()
          avisoRelatorios = await garantirAvisoCadastroLiberadoRelatoriosEmpresa(admin, session.userId)
          if (!avisoRelatorios.ok) {
            console.error('[reparar-degustacao] cadastro liberado:', avisoRelatorios.error)
          }

          const { data: ass } = await admin
            .from('empresa_assinaturas')
            .select('status, vencimento_em')
            .eq('empresa_id', empresaId)
            .eq('status', 'ativo')
            .order('assinado_em', { ascending: false })
            .limit(1)
            .maybeSingle()
          if (assinaturaContratadaVigente(ass)) {
            bemVindo = await garantirBoasVindasAposPlanoEmpresa(admin, {
              empresaUsuarioId: session.userId,
              empresaId,
            })
            if (!bemVindo.ok) {
              console.error('[reparar-degustacao] Bem-Vindo:', bemVindo.error)
            }
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.warn('[reparar-degustacao] cadastro liberado', msg)
        if (!avisoRelatorios) avisoRelatorios = { ok: false, error: msg }
        if (!bemVindo) bemVindo = { ok: false, error: msg }
      }
    }

    return NextResponse.json({
      ok: true,
      aviso_relatorios: avisoRelatorios == null ? null : avisoRelatorios.ok,
      aviso_relatorios_skipped: avisoRelatorios?.skipped === true,
      aviso_relatorios_error: avisoRelatorios?.ok === false ? avisoRelatorios.error ?? null : null,
      bem_vindo: bemVindo == null ? null : bemVindo.ok,
      bem_vindo_skipped: bemVindo?.skipped === true,
      bem_vindo_error: bemVindo?.ok === false ? bemVindo.error ?? null : null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
