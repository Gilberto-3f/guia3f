import type { SupabaseClient } from '@supabase/supabase-js'
import { buscarIdsEmpresaPresencaPublicaVigente } from '@/lib/empresaPresencaPublica'

export type EmpresaMarcadaBusca = {
  empresaId: string
  usuarioId: string
  nome: string
  username: string
  fotoUrl: string | null
}

function mapPerfilEmpresa(row: Record<string, unknown>): EmpresaMarcadaBusca | null {
  const empresaId = row.empresa_id != null ? String(row.empresa_id).trim() : ''
  const usuarioId = row.usuario_id != null ? String(row.usuario_id).trim() : ''
  if (!empresaId || !usuarioId) return null
  return {
    empresaId,
    usuarioId,
    nome: row.nome != null ? String(row.nome).trim() : 'Empresa',
    username: String(row.username ?? '')
      .trim()
      .replace(/^@+/, '') || 'empresa',
    fotoUrl: row.foto_url != null ? String(row.foto_url) : null,
  }
}

/** Busca empresas com presença pública vigente para marcar na foto. */
export async function buscarEmpresasParaMarcacaoFoto(
  supabase: SupabaseClient,
  termo: string,
): Promise<EmpresaMarcadaBusca[]> {
  const q = termo.trim().replace(/^@+/, '').replace(/[%_,()]/g, '')
  if (q.length < 2) return []

  const vigentes = await buscarIdsEmpresaPresencaPublicaVigente(supabase)
  if (vigentes.size === 0) return []

  const pattern = `%${q}%`
  const cols = 'usuario_id, empresa_id, username, nome, foto_url, tipo'
  const [porUsername, porNome] = await Promise.all([
    supabase.from('perfis_para_busca').select(cols).eq('tipo', 'empresa').ilike('username', pattern).limit(20),
    supabase.from('perfis_para_busca').select(cols).eq('tipo', 'empresa').ilike('nome', pattern).limit(20),
  ])
  const err = porUsername.error || porNome.error
  if (err) {
    console.error('[marcacaoEmpresaPost] busca:', err.message)
    return []
  }

  const map = new Map<string, EmpresaMarcadaBusca>()
  for (const row of [...(porUsername.data ?? []), ...(porNome.data ?? [])]) {
    if (String((row as { tipo?: unknown }).tipo ?? '') !== 'empresa') continue
    const item = mapPerfilEmpresa(row as Record<string, unknown>)
    if (!item || !vigentes.has(item.empresaId) || map.has(item.empresaId)) continue
    map.set(item.empresaId, item)
  }
  return [...map.values()].slice(0, 12)
}

const cacheEmpresaMarcada = new Map<string, EmpresaMarcadaBusca | null>()

export async function buscarEmpresaMarcadaPorId(
  supabase: SupabaseClient,
  empresaId: string | null | undefined,
): Promise<EmpresaMarcadaBusca | null> {
  const id = empresaId != null ? String(empresaId).trim() : ''
  if (!id) return null
  if (cacheEmpresaMarcada.has(id)) return cacheEmpresaMarcada.get(id) ?? null

  const { data, error } = await supabase
    .from('empresas')
    .select('id, usuario_id, nome_fantasia, nome_usuario, foto_url')
    .eq('id', id)
    .maybeSingle()
  if (error || !data?.id) {
    cacheEmpresaMarcada.set(id, null)
    return null
  }
  const item: EmpresaMarcadaBusca = {
    empresaId: String(data.id),
    usuarioId: data.usuario_id != null ? String(data.usuario_id) : '',
    nome: data.nome_fantasia != null ? String(data.nome_fantasia).trim() : 'Empresa',
    username: String(data.nome_usuario ?? '')
      .trim()
      .replace(/^@+/, ''),
    fotoUrl: data.foto_url != null ? String(data.foto_url) : null,
  }
  cacheEmpresaMarcada.set(id, item)
  return item
}

export function empresaMarcadaIdDePost(raw: { empresa_marcada_id?: unknown } | null | undefined): string | null {
  const s = raw?.empresa_marcada_id != null ? String(raw.empresa_marcada_id).trim() : ''
  return s !== '' ? s : null
}

export async function ocultarMarcacaoEmpresaNoPost(
  supabase: SupabaseClient,
  postId: string,
): Promise<{ ok: boolean; error?: string }> {
  const id = postId?.trim()
  if (!id) return { ok: false, error: 'post_vazio' }
  const { error } = await supabase.rpc('ocultar_marcacao_empresa_post', { p_post_id: id })
  if (error) {
    console.error('[marcacaoEmpresaPost] ocultar:', error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}
