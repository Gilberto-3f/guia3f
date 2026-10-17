import { NextResponse } from 'next/server'
import { assertAdminSession, jsonAdminError, loadAdminUsuarioRow } from '@/lib/adminApiAuth'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import {
  cidadeDoCatalogo,
  mapRowEcossistema,
  normalizarCidadeChave,
  slugDeNome,
  type EcossistemaCidade,
} from '@/lib/ecossistemas'

type Ctx = { params: Promise<{ id: string }> }

function podeGerir(adminRow: { admin_level?: number | null; admin_permissoes?: unknown } | null) {
  const nivel = Number(adminRow?.admin_level ?? 0)
  const cargo = (adminRow?.admin_permissoes as { cargo?: string } | null)?.cargo
  return nivel === 1 || cargo === 'FINANCEIRO'
}

async function requireAdmGeralOuFinanceiro() {
  const auth = await assertAdminSession()
  if (!auth.ok) return { ok: false as const, error: auth.error }
  const { row } = await loadAdminUsuarioRow(auth.userId, auth.email)
  if (!podeGerir(row)) {
    return { ok: false as const, error: jsonAdminError(403, 'forbidden', 'Sem permissão para ecossistemas.') }
  }
  let adminDb
  try {
    adminDb = createSupabaseAdmin()
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'service_role_unavailable'
    return { ok: false as const, error: jsonAdminError(503, 'admin_db', msg) }
  }
  return { ok: true as const, adminDb }
}

function parseCidades(raw: unknown): EcossistemaCidade[] | null {
  if (raw === undefined) return null
  if (!Array.isArray(raw)) return []
  const out: EcossistemaCidade[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const texto =
      typeof item === 'string'
        ? item
        : item && typeof item === 'object'
          ? String((item as { chave?: string; label?: string }).chave ?? (item as { label?: string }).label ?? '')
          : ''
    const cat = cidadeDoCatalogo(texto)
    const chave = cat?.chave ?? normalizarCidadeChave(texto)
    if (!chave) continue
    const key = chave.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const label =
      cat?.label ??
      (typeof item === 'object' && item && 'label' in item
        ? String((item as { label?: string }).label ?? chave)
        : chave)
    const pais =
      cat?.pais ??
      (typeof item === 'object' && item && 'pais' in item
        ? String((item as { pais?: string }).pais ?? '') || null
        : null)
    out.push({ chave, label, pais })
  }
  return out
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const gate = await requireAdmGeralOuFinanceiro()
    if (!gate.ok) return gate.error
    const { id } = await ctx.params
    const ecoId = String(id ?? '').trim()
    if (!ecoId) return jsonAdminError(400, 'id', 'id obrigatório.')

    let body: Record<string, unknown> = {}
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return jsonAdminError(400, 'json', 'JSON inválido.')
    }

    const { data: atual } = await gate.adminDb
      .from('ecossistemas')
      .select('*')
      .eq('id', ecoId)
      .maybeSingle()
    if (!atual?.id) return jsonAdminError(404, 'not_found', 'Ecossistema não encontrado.')

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.nome != null) {
      const nome = String(body.nome).trim()
      if (nome.length < 2) return jsonAdminError(400, 'nome', 'Informe o nome do ecossistema.')
      patch.nome = nome
    }
    if (body.slug != null) {
      const slug = slugDeNome(String(body.slug))
      if (!slug) return jsonAdminError(400, 'slug', 'Identificador inválido.')
      patch.slug = slug
    }
    if (body.tipo != null) {
      patch.tipo = String(body.tipo) === 'regiao' ? 'regiao' : 'cidade'
    }
    if (body.descricao !== undefined) {
      patch.descricao = String(body.descricao ?? '').trim() || null
    }
    if (body.disponivel_home != null) patch.disponivel_home = body.disponivel_home !== false
    if (body.tile_sexto != null) {
      const t = String(body.tile_sexto)
      patch.tile_sexto = t === 'compras_cde' || t === 'servicos_locais' ? t : 'aguarde'
    }
    if (body.ordem != null && Number.isFinite(Number(body.ordem))) patch.ordem = Number(body.ordem)

    const tipoFinal = String(patch.tipo ?? atual.tipo)
    const cidades = parseCidades(body.cidades)
    if (cidades && cidades.length < 1) {
      return jsonAdminError(400, 'cidades', 'Inclua ao menos uma cidade.')
    }
    if (tipoFinal === 'cidade' && cidades && cidades.length > 1) {
      return jsonAdminError(400, 'cidades', 'Ecossistema do tipo cidade aceita só um município.')
    }

    if (body.padrao === true) {
      await gate.adminDb.from('ecossistemas').update({ padrao: false }).eq('padrao', true)
      patch.padrao = true
    } else if (body.padrao === false) {
      if (atual.padrao === true) {
        return jsonAdminError(400, 'padrao', 'Defina outro ecossistema como padrão antes de desmarcar este.')
      }
      patch.padrao = false
    }

    const { error: updErr } = await gate.adminDb.from('ecossistemas').update(patch).eq('id', ecoId)
    if (updErr) return jsonAdminError(400, 'update', updErr.message)

    if (cidades) {
      await gate.adminDb.from('ecossistema_cidades').delete().eq('ecossistema_id', ecoId)
      await gate.adminDb.from('ecossistema_cidades').insert(
        cidades.map((c) => ({
          ecossistema_id: ecoId,
          cidade_chave: c.chave,
          cidade_label: c.label,
          pais: c.pais,
        })),
      )
    }

    const { data: row } = await gate.adminDb.from('ecossistemas').select('*').eq('id', ecoId).maybeSingle()
    const { data: cids } = await gate.adminDb
      .from('ecossistema_cidades')
      .select('*')
      .eq('ecossistema_id', ecoId)
    const eco = mapRowEcossistema(
      (row ?? {}) as Record<string, unknown>,
      (cids ?? []).map((c) => ({
        chave: String(c.cidade_chave),
        label: String(c.cidade_label ?? c.cidade_chave),
        pais: c.pais != null ? String(c.pais) : null,
      })),
    )
    return NextResponse.json({ ok: true, ecossistema: eco })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro'
    return jsonAdminError(500, 'patch', msg)
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const gate = await requireAdmGeralOuFinanceiro()
    if (!gate.ok) return gate.error
    const { id } = await ctx.params
    const ecoId = String(id ?? '').trim()
    if (!ecoId) return jsonAdminError(400, 'id', 'id obrigatório.')

    const { data: atual } = await gate.adminDb
      .from('ecossistemas')
      .select('id, padrao, slug')
      .eq('id', ecoId)
      .maybeSingle()
    if (!atual?.id) return jsonAdminError(404, 'not_found', 'Ecossistema não encontrado.')
    if (atual.padrao === true) {
      return jsonAdminError(400, 'padrao', 'Não é possível excluir o ecossistema padrão.')
    }

    const { error } = await gate.adminDb.from('ecossistemas').delete().eq('id', ecoId)
    if (error) return jsonAdminError(400, 'delete', error.message)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro'
    return jsonAdminError(500, 'delete', msg)
  }
}
