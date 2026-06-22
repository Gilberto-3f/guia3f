import type { SupabaseClient } from '@supabase/supabase-js'
import { inserirNotificacaoCanalFinanceiroEmpresa } from '@/lib/canalFinanceiroEmpresa'
import { inserirNotificacaoCanalFinanceiroProfissional } from '@/lib/canalFinanceiroProfissional'
import { joinSupabaseRow } from '@/lib/supabaseJoinRow'
import { filtrarEmpresaIds, type MetodoValidacaoCheckin } from '@/lib/manifestoDiario'

export type ParadaItinerarioRow = {
  id: string
  turista_id: string | null
  empresa_id: string
  empresa_nome: string
  empresa_foto: string | null
  categoria: string
  endereco: string | null
  cidade: string | null
  visitado: boolean
  visitado_em: string | null
  checkin_confirmado: boolean
  ordem_rota: number | null
}

/** Insere paradas no itinerário (por passageiro). */
export async function inserirParadasItinerario(
  supabase: SupabaseClient,
  params: {
    manifestoId: string
    turistaUsuarioId: string
    empresaIds: string[]
    profissionalIndiretoId?: string | null
  },
): Promise<void> {
  const ids = filtrarEmpresaIds(params.empresaIds)
  if (ids.length === 0) return

  for (const empresaId of ids) {
    const { data: dup } = await supabase
      .from('itinerario_paradas')
      .select('id')
      .eq('manifesto_id', params.manifestoId)
      .eq('turista_id', params.turistaUsuarioId)
      .eq('empresa_id', empresaId)
      .maybeSingle()

    if (dup?.id) continue

    const { count } = await supabase
      .from('itinerario_paradas')
      .select('id', { count: 'exact', head: true })
      .eq('manifesto_id', params.manifestoId)

    await supabase.from('itinerario_paradas').insert({
      manifesto_id: params.manifestoId,
      turista_id: params.turistaUsuarioId,
      empresa_id: empresaId,
      ordem_rota: (count ?? 0) + 1,
    })
  }

  if (params.profissionalIndiretoId) {
    const { data: profInd } = await supabase
      .from('profissionais')
      .select('usuario_id')
      .eq('id', params.profissionalIndiretoId)
      .maybeSingle()

    if (profInd?.usuario_id) {
      const { count } = await supabase
        .from('itinerario_paradas')
        .select('id', { count: 'exact', head: true })
        .eq('manifesto_id', params.manifestoId)
        .eq('turista_id', params.turistaUsuarioId)

      await inserirNotificacaoCanalFinanceiroProfissional(supabase, {
        profissionalUsuarioId: String(profInd.usuario_id),
        tipo: 'extrato_parceria',
        titulo: 'Turista selecionou paradas no itinerário',
        mensagem: `${count ?? ids.length} parada(s) no roteiro. Benefícios de parceria serão calculados ao concluir o manifesto.`,
        comprovanteDetalhes: {
          manifesto_id: params.manifestoId,
          turista_usuario_id: params.turistaUsuarioId,
          empresa_ids: ids,
          profissional_indireto_id: params.profissionalIndiretoId,
        },
      })
    }
  }
}

/** @deprecated use inserirParadasItinerario */
export const inserirAtrativosManifesto = inserirParadasItinerario

export async function confirmarCheckInItinerario(
  supabase: SupabaseClient,
  params: {
    manifestoId: string
    empresaId: string
    turistaUsuarioId?: string | null
    metodo: MetodoValidacaoCheckin
  },
): Promise<{ ok: boolean; error?: string }> {
  const agora = new Date().toISOString()

  const { data: checkin, error: insErr } = await supabase
    .from('manifesto_checkins')
    .insert({
      manifesto_id: params.manifestoId,
      empresa_id: params.empresaId,
      turista_id: params.turistaUsuarioId ?? null,
      horario_chegada: agora,
      status: 'confirmado',
      confirmado_em: agora,
      metodo_validacao: params.metodo,
    })
    .select('id')
    .maybeSingle()

  if (insErr) return { ok: false, error: insErr.message }

  let upd = supabase
    .from('itinerario_paradas')
    .update({ visitado: true, visitado_em: agora })
    .eq('manifesto_id', params.manifestoId)
    .eq('empresa_id', params.empresaId)
  if (params.turistaUsuarioId) upd = upd.eq('turista_id', params.turistaUsuarioId)
  await upd

  const { data: emp } = await supabase
    .from('empresas')
    .select('usuario_id, nome_fantasia')
    .eq('id', params.empresaId)
    .maybeSingle()

  if (emp?.usuario_id) {
    await inserirNotificacaoCanalFinanceiroEmpresa(supabase, {
      empresaUsuarioId: String(emp.usuario_id),
      tipo: 'relatorio_pax',
      titulo: 'Check-in confirmado no itinerário',
      mensagem: `Check-in confirmado (${params.metodo}) em ${String(emp.nome_fantasia ?? 'sua empresa')}.`,
      comprovanteDetalhes: {
        manifesto_id: params.manifestoId,
        empresa_id: params.empresaId,
        checkin_id: checkin?.id,
        metodo_validacao: params.metodo,
      },
    })
  }

  return { ok: true }
}

export async function listarParadasManifesto(
  supabase: SupabaseClient,
  manifestoId: string,
): Promise<ParadaItinerarioRow[]> {
  const [{ data: paradas }, { data: checkins }] = await Promise.all([
    supabase
      .from('itinerario_paradas')
      .select(
        `
        id, turista_id, empresa_id, visitado, visitado_em, ordem_rota,
        empresas:empresa_id (nome_fantasia, categoria, foto_url, endereco, bairro, cidade)
      `,
      )
      .eq('manifesto_id', manifestoId)
      .order('ordem_rota', { ascending: true }),
    supabase
      .from('manifesto_checkins')
      .select('empresa_id, turista_id, status')
      .eq('manifesto_id', manifestoId)
      .eq('status', 'confirmado'),
  ])

  const checkinSet = new Set(
    (checkins ?? []).map((c) => `${String(c.empresa_id)}:${String(c.turista_id ?? '')}`),
  )

  return (paradas ?? []).map((a) => {
    const emp = joinSupabaseRow(a.empresas)
    const endParts = [emp?.endereco, emp?.bairro, emp?.cidade].filter(Boolean).map(String)
    const key = `${String(a.empresa_id)}:${String(a.turista_id ?? '')}`
    return {
      id: String(a.id),
      turista_id: a.turista_id != null ? String(a.turista_id) : null,
      empresa_id: String(a.empresa_id),
      empresa_nome: String(emp?.nome_fantasia ?? 'Empresa'),
      empresa_foto: emp?.foto_url != null ? String(emp.foto_url) : null,
      categoria: String(emp?.categoria ?? ''),
      endereco: endParts.length ? endParts.join(', ') : null,
      cidade: emp?.cidade != null ? String(emp.cidade) : null,
      visitado: Boolean(a.visitado),
      visitado_em: a.visitado_em != null ? String(a.visitado_em) : null,
      checkin_confirmado: checkinSet.has(key),
      ordem_rota: a.ordem_rota != null ? Number(a.ordem_rota) : null,
    }
  })
}

export async function buscarParadasParceriaIndireto(
  supabase: SupabaseClient,
  profissionalIndiretoId: string,
  turistaUsuarioId?: string | null,
): Promise<
  Array<{
    empresa_id: string
    empresa_nome: string
    categoria: string
    visitado: boolean
    selecionado_em: string
  }>
> {
  let q = supabase
    .from('manifesto_passageiros')
    .select('manifesto_id, turista_id')
    .eq('profissional_indireto_id', profissionalIndiretoId)

  if (turistaUsuarioId) q = q.eq('turista_id', turistaUsuarioId)

  const { data: passRows } = await q
  const manifestoIds = [...new Set((passRows ?? []).map((p) => String(p.manifesto_id)))]
  if (manifestoIds.length === 0) return []

  let pq = supabase
    .from('itinerario_paradas')
    .select(
      `
      empresa_id, visitado, selecionado_em, turista_id,
      empresas:empresa_id (nome_fantasia, categoria)
    `,
    )
    .in('manifesto_id', manifestoIds)

  if (turistaUsuarioId) pq = pq.eq('turista_id', turistaUsuarioId)

  const { data } = await pq
  return (data ?? []).map((a) => {
    const emp = joinSupabaseRow(a.empresas)
    return {
      empresa_id: String(a.empresa_id),
      empresa_nome: String(emp?.nome_fantasia ?? 'Empresa'),
      categoria: String(emp?.categoria ?? ''),
      visitado: Boolean(a.visitado),
      selecionado_em: String(a.selecionado_em ?? ''),
    }
  })
}
