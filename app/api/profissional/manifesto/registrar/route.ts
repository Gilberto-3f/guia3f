import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { registrarTuristaNoManifesto } from '@/lib/manifestoDiario'

/** Registra turista no manifesto (contratação direta, agendamento ou algoritmo). */
export async function POST(req: Request) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  const body = (await req.json()) as Record<string, unknown>
  const profissionalUsuarioId = String(body.profissional_usuario_id ?? '').trim()
  const turistaUsuarioId = String(body.turista_usuario_id ?? auth.userId).trim()
  const tipoRaw = String(body.contratacao_tipo ?? 'contratacao_direta')
  const contratacaoTipo =
    tipoRaw === 'agendamento' || tipoRaw === 'algoritmo' || tipoRaw === 'indicacao'
      ? tipoRaw
      : 'contratacao_direta'
  const dataManifesto = body.data_manifesto != null ? String(body.data_manifesto) : undefined
  const empresaIds = Array.isArray(body.empresa_ids) ? body.empresa_ids.map(String).filter(Boolean) : []

  const nomeCompleto = String(body.nome_completo ?? '').trim()
  const documento = body.documento != null ? String(body.documento).trim() : null
  const dataNascimento = body.data_nascimento != null ? String(body.data_nascimento).slice(0, 10) : null

  if (!profissionalUsuarioId) {
    return NextResponse.json({ error: 'profissional_usuario_id obrigatório.' }, { status: 400 })
  }

  if (auth.role === 'turista' && turistaUsuarioId === auth.userId) {
    if (!nomeCompleto || !dataNascimento || !documento) {
      return NextResponse.json(
        { error: 'Nome completo, data de nascimento e documento são obrigatórios.' },
        { status: 400 },
      )
    }
  }

  const isTurista = auth.role === 'turista' && turistaUsuarioId === auth.userId
  const isSelfProf = profissionalUsuarioId === auth.userId

  let supabase = auth.supabase
  if (!isTurista && !isSelfProf) {
    try {
      supabase = createSupabaseAdmin()
    } catch {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 403 })
    }
  }

  const { data: prof } = await supabase
    .from('profissionais')
    .select('id, placa_vermelha')
    .eq('usuario_id', profissionalUsuarioId)
    .maybeSingle()

  if (!prof?.id || !prof.placa_vermelha) {
    return NextResponse.json({ error: 'Profissional Guia/Van não encontrado.' }, { status: 404 })
  }

  const res = await registrarTuristaNoManifesto(supabase, {
    profissionalId: String(prof.id),
    turistaUsuarioId,
    contratacaoTipo,
    dataManifesto,
    paradasEmpresaIds: empresaIds.length ? empresaIds : undefined,
    dadosPax: nomeCompleto
      ? {
          nome: nomeCompleto,
          documento,
          data_nascimento: dataNascimento,
          validada: true,
        }
      : undefined,
  })

  if ('error' in res) {
    return NextResponse.json({ error: res.error }, { status: 400 })
  }

  return NextResponse.json({ ok: true, manifesto_id: res.manifestoId, passageiro_id: res.passageiroId })
}
