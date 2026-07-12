import type { SupabaseClient } from '@supabase/supabase-js'
import { payloadFavoritoEmpresa, deletarFavoritoEmpresa } from '@/lib/favoritosEmpresa'

export type FavoritoAlvoTipo = 'empresa' | 'acomodacao' | 'produto' | 'ticket'

export type EmpresaFavoritaCard = {
  id: string
  nome_fantasia: string
  nome_usuario: string | null
  foto_url: string | null
  cidade: string | null
}

export type AcomodacaoFavoritaCard = {
  id: string
  empresa_id: string
  categoria_imovel: string | null
  categoria_particular: string | null
  opcao_compartilhada: string | null
  valor_diaria: number | null
  foto_url: string | null
  empresa_nome: string | null
}

function payloadAlvo(usuarioId: string, alvoId: string, tipo: FavoritoAlvoTipo) {
  return {
    usuario_id: String(usuarioId),
    alvo_id: String(alvoId),
    alvo_tipo: tipo,
  }
}

export async function usuarioTemFavorito(
  supabase: SupabaseClient,
  usuarioId: string,
  alvoId: string,
  tipo: FavoritoAlvoTipo,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('favoritos')
    .select('id')
    .eq('usuario_id', String(usuarioId))
    .eq('alvo_id', String(alvoId))
    .eq('alvo_tipo', tipo)
    .limit(1)

  if (error) {
    console.error('[favoritosTurista] usuarioTemFavorito:', error.message)
    return false
  }
  return (data ?? []).length > 0
}

export async function filtrarFavoritoIdsPorUsuario(
  supabase: SupabaseClient,
  usuarioId: string,
  tipo: FavoritoAlvoTipo,
  alvoIds: string[],
): Promise<Set<string>> {
  const ids = [...new Set(alvoIds.map((id) => String(id).trim()).filter(Boolean))]
  if (!ids.length) return new Set()

  const { data, error } = await supabase
    .from('favoritos')
    .select('alvo_id')
    .eq('usuario_id', String(usuarioId))
    .eq('alvo_tipo', tipo)
    .in('alvo_id', ids)

  if (error) {
    console.error('[favoritosTurista] filtrarFavoritoIdsPorUsuario:', error.message)
    return new Set()
  }

  const set = new Set<string>()
  for (const row of data ?? []) {
    const id = row.alvo_id != null ? String(row.alvo_id).trim() : ''
    if (id) set.add(id)
  }
  return set
}

export async function adicionarFavorito(
  supabase: SupabaseClient,
  usuarioId: string,
  alvoId: string,
  tipo: FavoritoAlvoTipo,
): Promise<void> {
  if (tipo === 'empresa') {
    const { error } = await supabase
      .from('favoritos')
      .insert(payloadFavoritoEmpresa(usuarioId, alvoId))
    if (error) throw error
    return
  }
  const { error } = await supabase.from('favoritos').insert(payloadAlvo(usuarioId, alvoId, tipo))
  if (error) throw error
}

export async function removerFavorito(
  supabase: SupabaseClient,
  usuarioId: string,
  alvoId: string,
  tipo: FavoritoAlvoTipo,
): Promise<void> {
  if (tipo === 'empresa') {
    await deletarFavoritoEmpresa(supabase, usuarioId, alvoId)
    return
  }
  const { error } = await supabase
    .from('favoritos')
    .delete()
    .eq('usuario_id', String(usuarioId))
    .eq('alvo_id', String(alvoId))
    .eq('alvo_tipo', tipo)
  if (error) throw error
}

/** Toggle; retorna true se ficou favoritado. */
export async function toggleFavorito(
  supabase: SupabaseClient,
  usuarioId: string,
  alvoId: string,
  tipo: FavoritoAlvoTipo,
): Promise<boolean> {
  const ja = await usuarioTemFavorito(supabase, usuarioId, alvoId, tipo)
  if (ja) {
    await removerFavorito(supabase, usuarioId, alvoId, tipo)
    return false
  }
  await adicionarFavorito(supabase, usuarioId, alvoId, tipo)
  return true
}

export async function listarAlvoIdsFavoritos(
  supabase: SupabaseClient,
  usuarioId: string,
  tipo: FavoritoAlvoTipo,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('favoritos')
    .select('alvo_id')
    .eq('usuario_id', String(usuarioId))
    .eq('alvo_tipo', tipo)
    .order('salvo_em', { ascending: false })

  if (error) {
    console.error('[favoritosTurista] listarAlvoIdsFavoritos:', error.message)
    return []
  }

  const ids: string[] = []
  const seen = new Set<string>()
  for (const row of data ?? []) {
    const id = row.alvo_id != null ? String(row.alvo_id).trim() : ''
    if (id && !seen.has(id)) {
      seen.add(id)
      ids.push(id)
    }
  }
  return ids
}

export async function listarEmpresasFavoritas(
  supabase: SupabaseClient,
  usuarioId: string,
): Promise<EmpresaFavoritaCard[]> {
  const ids = await listarAlvoIdsFavoritos(supabase, usuarioId, 'empresa')
  if (!ids.length) return []

  const { data, error } = await supabase
    .from('empresas')
    .select('id, nome_fantasia, nome_usuario, foto_url, cidade')
    .in('id', ids)

  if (error || !data?.length) return []

  const byId = new Map(data.map((e) => [String(e.id), e]))
  return ids
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((e) => ({
      id: String(e!.id),
      nome_fantasia: String(e!.nome_fantasia ?? 'Empresa'),
      nome_usuario: e!.nome_usuario != null ? String(e!.nome_usuario) : null,
      foto_url: e!.foto_url != null ? String(e!.foto_url) : null,
      cidade: e!.cidade != null ? String(e!.cidade) : null,
    }))
}

export async function listarAcomodacoesFavoritas(
  supabase: SupabaseClient,
  usuarioId: string,
): Promise<AcomodacaoFavoritaCard[]> {
  const ids = await listarAlvoIdsFavoritos(supabase, usuarioId, 'acomodacao')
  if (!ids.length) return []

  const { data, error } = await supabase
    .from('hospedagem_acomodacoes')
    .select(
      'id, empresa_id, categoria_imovel, categoria_particular, opcao_compartilhada, valor_diaria, fotos, empresas ( nome_fantasia )',
    )
    .in('id', ids)

  if (error || !data?.length) return []

  const byId = new Map(data.map((a) => [String(a.id), a]))
  return ids
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((a) => {
      const empRaw = a!.empresas as
        | { nome_fantasia?: string }
        | { nome_fantasia?: string }[]
        | null
      const emp = Array.isArray(empRaw) ? empRaw[0] : empRaw
      const fotos = Array.isArray(a!.fotos) ? a!.fotos : []
      const foto = fotos.find((f) => typeof f === 'string' && f.trim()) ?? null
      return {
        id: String(a!.id),
        empresa_id: String(a!.empresa_id ?? ''),
        categoria_imovel: a!.categoria_imovel != null ? String(a!.categoria_imovel) : null,
        categoria_particular:
          a!.categoria_particular != null ? String(a!.categoria_particular) : null,
        opcao_compartilhada:
          a!.opcao_compartilhada != null ? String(a!.opcao_compartilhada) : null,
        valor_diaria: a!.valor_diaria != null ? Number(a!.valor_diaria) : null,
        foto_url: foto != null ? String(foto) : null,
        empresa_nome: emp?.nome_fantasia != null ? String(emp.nome_fantasia) : null,
      }
    })
}
