import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { buscarProfissionalPlacaVermelha } from '@/lib/manifestoDiario'
import { joinSupabaseRow } from '@/lib/supabaseJoinRow'

export type AtrativoDisponivelRow = {
  empresa_id: string
  nome_fantasia: string
  categoria: string
  cidade: string | null
}

/** Empresas com oferta de comissão — lista para adicionar ao manifesto. */
export async function GET() {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  const prof = await buscarProfissionalPlacaVermelha(auth.supabase, auth.userId)
  if (!prof?.placa_vermelha) {
    return NextResponse.json({ error: 'Acesso restrito.' }, { status: 403 })
  }

  const { data, error } = await auth.supabase
    .from('comissao_oferta')
    .select(
      `
      empresa_id,
      categoria,
      empresas:empresa_id (nome_fantasia, categoria, cidade)
    `,
    )
    .limit(80)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const vistos = new Set<string>()
  const atrativos: AtrativoDisponivelRow[] = []

  for (const row of data ?? []) {
    const empId = row.empresa_id != null ? String(row.empresa_id) : ''
    if (!empId || vistos.has(empId)) continue
    vistos.add(empId)

    const emp = joinSupabaseRow(row.empresas)
    atrativos.push({
      empresa_id: empId,
      nome_fantasia: String(emp?.nome_fantasia ?? 'Empresa'),
      categoria: String(emp?.categoria ?? row.categoria ?? ''),
      cidade: emp?.cidade != null ? String(emp.cidade) : null,
    })
  }

  atrativos.sort((a, b) => a.nome_fantasia.localeCompare(b.nome_fantasia, 'pt-BR'))

  return NextResponse.json({ ok: true, atrativos })
}
