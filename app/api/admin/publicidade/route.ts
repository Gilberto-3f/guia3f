import { NextResponse } from 'next/server'
import { assertAdminSession, jsonAdminError, loadAdminUsuarioRow } from '@/lib/adminApiAuth'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { listarEcossistemasDb } from '@/lib/ecossistemas'

const MIME_OK = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
const MAX_BYTES = 4 * 1024 * 1024

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

async function requireAdmGeral() {
  const auth = await assertAdminSession()
  if (!auth.ok) return { ok: false as const, error: auth.error }
  const { row } = await loadAdminUsuarioRow(auth.userId, auth.email)
  if (Number(row?.admin_level ?? 0) !== 1) {
    return { ok: false as const, error: jsonAdminError(403, 'forbidden', 'Só o ADM geral publica banners.') }
  }
  let adminDb
  try {
    adminDb = createSupabaseAdmin()
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'service_role_unavailable'
    return { ok: false as const, error: jsonAdminError(503, 'admin_db', msg) }
  }
  return { ok: true as const, adminDb, actorId: String(row?.id ?? auth.userId) }
}

function anuncioAtivoHoje(row: {
  status?: string | null
  periodo_inicio?: string | null
  periodo_fim?: string | null
}): boolean {
  if (String(row.status ?? '') !== 'ativo') return false
  const hoje = isoDate(new Date())
  const ini = String(row.periodo_inicio ?? '')
  if (ini && ini > hoje) return false
  const fim = row.periodo_fim != null ? String(row.periodo_fim) : ''
  if (fim && fim < hoje) return false
  return true
}

function extDeMime(mime: string, nome: string): string {
  const t = mime.toLowerCase()
  if (t === 'image/png') return 'png'
  if (t === 'image/webp') return 'webp'
  const part = nome.split('.').pop()?.toLowerCase()
  if (part === 'png' || part === 'webp' || part === 'jpg' || part === 'jpeg') {
    return part === 'jpeg' ? 'jpg' : part
  }
  return 'jpg'
}

function normalizarLink(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  if (/^https?:\/\//i.test(t)) return t
  if (t.startsWith('/')) return t
  return `https://${t}`
}

function normalizarWhatsapp(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  const jaUrl = t.match(/wa\.me\/(\+?\d+)/i)
  if (jaUrl?.[1]) {
    const d = jaUrl[1].replace(/\D/g, '')
    return d.length >= 10 ? `https://wa.me/${d}` : null
  }
  const digits = t.replace(/\D/g, '')
  if (digits.length < 10) return null
  return `https://wa.me/${digits}`
}

export async function GET() {
  try {
    const gate = await requireAdmGeral()
    if (!gate.ok) return gate.error
    const ecos = await listarEcossistemasDb(gate.adminDb)
    const { data, error } = await gate.adminDb
      .from('anuncios')
      .select('id, empresa_id, ecossistema_id, imagem_url, link_url, periodo_inicio, periodo_fim, status, created_at, impressoes_exibidas, cliques')
      .is('empresa_id', null)
      .eq('tipo', 'home')
      .order('created_at', { ascending: false })
    if (error) return jsonAdminError(400, 'list', error.message)
    const anuncios = (data ?? []).map((r) => ({
      ...r,
      ativo: anuncioAtivoHoje(r),
    }))
    return NextResponse.json({ ok: true, ecossistemas: ecos, anuncios })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro'
    return jsonAdminError(500, 'get', msg)
  }
}

export async function POST(req: Request) {
  try {
    const gate = await requireAdmGeral()
    if (!gate.ok) return gate.error

    const form = await req.formData()
    const ecoId = String(form.get('ecossistema_id') ?? '').trim()
    if (!ecoId) return jsonAdminError(400, 'eco', 'Escolha o ecossistema.')

    const { data: eco } = await gate.adminDb.from('ecossistemas').select('id, nome').eq('id', ecoId).maybeSingle()
    if (!eco?.id) return jsonAdminError(400, 'eco', 'Ecossistema não encontrado.')

    const vigencia = String(form.get('vigencia') ?? 'recorrente') === 'prazo' ? 'prazo' : 'recorrente'
    let periodoFim: string | null = null
    if (vigencia === 'prazo') {
      periodoFim = String(form.get('periodo_fim') ?? '').trim() || null
      if (!periodoFim || periodoFim < isoDate(new Date())) {
        return jsonAdminError(400, 'prazo', 'Informe uma data final igual ou posterior a hoje.')
      }
    }

    const destino = String(form.get('destino') ?? 'nenhum')
    let linkUrl: string | null = null
    if (destino === 'link') {
      linkUrl = normalizarLink(String(form.get('link_url') ?? ''))
      if (!linkUrl) return jsonAdminError(400, 'link', 'Informe o link.')
    } else if (destino === 'whatsapp') {
      linkUrl = normalizarWhatsapp(String(form.get('whatsapp') ?? ''))
      if (!linkUrl) return jsonAdminError(400, 'whatsapp', 'Informe um WhatsApp válido (DDI + número).')
    } else if (destino !== 'nenhum') {
      return jsonAdminError(400, 'destino', 'Destino inválido.')
    }

    const file = form.get('arte')
    if (!(file instanceof File) || file.size < 1) {
      return jsonAdminError(400, 'arte', 'Selecione a imagem (JPG, PNG ou WEBP).')
    }
    if (file.size > MAX_BYTES) return jsonAdminError(400, 'arte', 'Imagem no máximo 4 MB.')
    const mime = (file.type || '').toLowerCase()
    if (!MIME_OK.has(mime)) return jsonAdminError(400, 'arte', 'Use imagem JPG, PNG ou WEBP.')

    const { data: ativosDet, error: detErr } = await gate.adminDb
      .from('anuncios')
      .select('id, periodo_fim, status, periodo_inicio')
      .is('empresa_id', null)
      .eq('ecossistema_id', ecoId)
      .eq('tipo', 'home')
      .eq('status', 'ativo')
    if (detErr) return jsonAdminError(400, 'ativos', detErr.message)
    const ativoAtual = (ativosDet ?? []).find((r) => anuncioAtivoHoje(r)) ?? null

    const substituir = String(form.get('substituir') ?? '') === '1'
    if (ativoAtual && !substituir) {
      return NextResponse.json(
        {
          ok: false,
          code: 'existe_ativo',
          error: `Já existe um banner ativo em ${eco.nome}. Substituir pelo novo criativo?`,
          anuncio_id: ativoAtual.id,
        },
        { status: 409 },
      )
    }

    if (ativoAtual && substituir) {
      const { error: offErr } = await gate.adminDb
        .from('anuncios')
        .update({ status: 'inativo' })
        .eq('id', ativoAtual.id)
        .is('empresa_id', null)
      if (offErr) return jsonAdminError(400, 'substituir', offErr.message)
    }

    const ext = extDeMime(mime, file.name || '')
    const objectPath = `adm/${gate.actorId}/${crypto.randomUUID()}.${ext}`
    const buf = Buffer.from(await file.arrayBuffer())
    const { error: upErr } = await gate.adminDb.storage.from('anuncios').upload(objectPath, buf, {
      cacheControl: '3600',
      upsert: false,
      contentType: mime || 'image/jpeg',
    })
    if (upErr) return jsonAdminError(400, 'upload', upErr.message)

    const { data: pub } = gate.adminDb.storage.from('anuncios').getPublicUrl(objectPath)
    const imagemUrl = pub?.publicUrl ?? ''
    if (!imagemUrl) return jsonAdminError(400, 'upload', 'URL da imagem indisponível.')

    const hoje = isoDate(new Date())
    const { data: insertRow, error: insErr } = await gate.adminDb
      .from('anuncios')
      .insert({
        empresa_id: null,
        ecossistema_id: ecoId,
        tipo: 'home',
        localizacao: null,
        imagem_url: imagemUrl,
        link_url: linkUrl,
        periodo_inicio: hoje,
        periodo_fim: periodoFim,
        status: 'ativo',
        impressoes_exibidas: 0,
        cliques: 0,
      })
      .select('id')
      .single()
    if (insErr) return jsonAdminError(400, 'insert', insErr.message)

    return NextResponse.json({ ok: true, id: insertRow?.id })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro'
    return jsonAdminError(500, 'post', msg)
  }
}
