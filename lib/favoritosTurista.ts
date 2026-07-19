import type { SupabaseClient } from '@supabase/supabase-js'
import { deletarFavoritoEmpresa } from '@/lib/favoritosEmpresa'
import {
  rotuloCategoriaImovelCurto,
  rotuloCategoriaParticularCurto,
  rotuloOpcaoCompartilhadaCurto,
  tipoCategoriaImovel,
} from '@/lib/hospedagemAcomodacoesCatalogo'

export type FavoritoAlvoTipo = 'empresa' | 'acomodacao' | 'produto' | 'ticket'

export type EmpresaFavoritaCard = {
  id: string
  nome_fantasia: string
  nome_usuario: string | null
  foto_url: string | null
  cidade: string | null
  nota_media: number | null
}

export type AcomodacaoFavoritaCard = {
  id: string
  empresa_id: string
  categoria_imovel: string | null
  categoria_particular: string | null
  opcao_compartilhada: string | null
  capacidade_pessoas: number | null
  valor_diaria: number | null
  foto_url: string | null
  empresa_nome: string | null
}

export type ProdutoFavoritoCard = {
  id: string
  empresa_id: string | null
  titulo: string
  foto_url: string | null
  preco: number | null
  percentual_desconto: number
  empresa_nome: string | null
  marca_nome: string | null
}

export type TicketFavoritoCard = {
  id: string
  titulo: string
  foto_url: string | null
  empresa_id: string | null
  empresa_nome: string | null
  preco_inteira: number | null
  preco_meia: number | null
}

/** Item de catálogo salvo — para Publicações Salvas (não-turistas). */
export type ItemCatalogoSalvo = {
  kind: 'produto' | 'acomodacao' | 'ticket'
  id: string
  titulo: string
  foto_url: string | null
  empresa_id: string | null
  empresa_nome: string | null
  salvo_em: string
  subtitulo: string | null
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
  const payload = payloadAlvo(usuarioId, alvoId, tipo)
  const { error } = await supabase.from('favoritos').insert(payload)
  if (error) {
    // Duplicata: trata como já favoritado
    if (error.code === '23505') return
    console.error('[favoritosTurista] adicionarFavorito:', error.message, payload)
    throw error
  }
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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('favoritos-turista-atualizados'))
    }
    return false
  }
  await adicionarFavorito(supabase, usuarioId, alvoId, tipo)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('favoritos-turista-atualizados'))
  }
  return true
}

export async function listarAlvoIdsFavoritos(
  supabase: SupabaseClient,
  usuarioId: string,
  tipo: FavoritoAlvoTipo,
): Promise<string[]> {
  // Sem order por salvo_em: coluna pode não existir / quebrar a query no remoto.
  const { data, error } = await supabase
    .from('favoritos')
    .select('alvo_id')
    .eq('usuario_id', String(usuarioId))
    .eq('alvo_tipo', tipo)

  if (error) {
    console.error('[favoritosTurista] listarAlvoIdsFavoritos:', error.message, {
      usuarioId,
      tipo,
    })
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
    .select('id, nome_fantasia, nome_usuario, foto_url, cidade, nota_media')
    .in('id', ids)

  if (error) {
    console.error('[favoritosTurista] listarEmpresasFavoritas:', error.message)
    return []
  }
  if (!data?.length) return []

  const byId = new Map(data.map((e) => [String(e.id), e]))
  return ids
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((e) => {
      const notaRaw = e!.nota_media != null ? Number(e!.nota_media) : NaN
      return {
        id: String(e!.id),
        nome_fantasia: String(e!.nome_fantasia ?? 'Empresa'),
        nome_usuario: e!.nome_usuario != null ? String(e!.nome_usuario) : null,
        foto_url: e!.foto_url != null ? String(e!.foto_url) : null,
        cidade: e!.cidade != null ? String(e!.cidade) : null,
        nota_media: Number.isFinite(notaRaw) && notaRaw > 0 ? notaRaw : null,
      }
    })
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
      'id, empresa_id, categoria_imovel, categoria_particular, opcao_compartilhada, capacidade_pessoas, valor_diaria, fotos',
    )
    .in('id', ids)

  if (error) {
    console.error('[favoritosTurista] listarAcomodacoesFavoritas:', error.message)
    return []
  }
  if (!data?.length) return []

  const empresaIds = [
    ...new Set(data.map((a) => String(a.empresa_id ?? '').trim()).filter(Boolean)),
  ]
  const nomePorEmpresa = new Map<string, string>()
  if (empresaIds.length) {
    const { data: emps } = await supabase
      .from('empresas')
      .select('id, nome_fantasia')
      .in('id', empresaIds)
    for (const e of emps ?? []) {
      nomePorEmpresa.set(String(e.id), String(e.nome_fantasia ?? ''))
    }
  }

  const byId = new Map(data.map((a) => [String(a.id), a]))
  return ids
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((a) => {
      const fotos = Array.isArray(a!.fotos) ? a!.fotos : []
      const foto = fotos.find((f) => typeof f === 'string' && f.trim()) ?? null
      const empId = String(a!.empresa_id ?? '')
      return {
        id: String(a!.id),
        empresa_id: empId,
        categoria_imovel: a!.categoria_imovel != null ? String(a!.categoria_imovel) : null,
        categoria_particular:
          a!.categoria_particular != null ? String(a!.categoria_particular) : null,
        opcao_compartilhada:
          a!.opcao_compartilhada != null ? String(a!.opcao_compartilhada) : null,
        capacidade_pessoas:
          a!.capacidade_pessoas != null ? Number(a!.capacidade_pessoas) : null,
        valor_diaria: a!.valor_diaria != null ? Number(a!.valor_diaria) : null,
        foto_url: foto != null ? String(foto) : null,
        empresa_nome: nomePorEmpresa.get(empId) || null,
      }
    })
}

/** Produtos Compras CDE favoritos. */
export async function listarProdutosFavoritos(
  supabase: SupabaseClient,
  usuarioId: string,
): Promise<ProdutoFavoritoCard[]> {
  const ids = await listarAlvoIdsFavoritos(supabase, usuarioId, 'produto')
  if (!ids.length) return []

  const { data, error } = await supabase
    .from('produtos')
    .select(
      `
      id, empresa_id, nome, fotos, foto_url, preco_usd, percentual_desconto,
      produto_marcas ( nome )
    `,
    )
    .in('id', ids)

  if (error) {
    console.error('[favoritosTurista] listarProdutosFavoritos:', error.message)
    return []
  }
  if (!data?.length) return []

  const empresaIds = [
    ...new Set(data.map((p) => String(p.empresa_id ?? '').trim()).filter(Boolean)),
  ]
  const nomePorEmpresa = new Map<string, string>()
  if (empresaIds.length) {
    const { data: emps } = await supabase
      .from('empresas')
      .select('id, nome_fantasia')
      .in('id', empresaIds)
    for (const e of emps ?? []) {
      nomePorEmpresa.set(String(e.id), String(e.nome_fantasia ?? ''))
    }
  }

  const byId = new Map(data.map((p) => [String(p.id), p]))
  return ids
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((p) => {
      const fotos = Array.isArray(p!.fotos) ? p!.fotos : []
      const foto =
        (fotos.find((f) => typeof f === 'string' && String(f).trim()) as string | undefined) ??
        (p!.foto_url != null ? String(p!.foto_url) : null)
      const pct = Number(p!.percentual_desconto) || 0
      const bruto = Number(p!.preco_usd) || 0
      const final = Math.round(bruto * (1 - pct / 100) * 100) / 100
      const empId = p!.empresa_id != null ? String(p!.empresa_id) : null
      const marcaRel = p!.produto_marcas as { nome?: string } | null
      return {
        id: String(p!.id),
        empresa_id: empId,
        titulo: String(p!.nome ?? 'Produto'),
        foto_url: foto,
        preco: final > 0 ? final : null,
        percentual_desconto: pct,
        empresa_nome: empId ? nomePorEmpresa.get(empId) || null : null,
        marca_nome: marcaRel?.nome ? String(marcaRel.nome) : null,
      }
    })
}


/** Base pronta — tickets de atrativos (experiências). */
export async function listarTicketsFavoritos(
  supabase: SupabaseClient,
  usuarioId: string,
): Promise<TicketFavoritoCard[]> {
  const ids = await listarAlvoIdsFavoritos(supabase, usuarioId, 'ticket')
  if (!ids.length) return []

  const { data, error } = await supabase
    .from('atrativos_experiencias')
    .select('id, empresa_id, titulo, fotos, preco_inteira, preco_meia')
    .in('id', ids)

  if (error) {
    console.error('[favoritosTurista] listarTicketsFavoritos:', error.message)
    return []
  }
  if (!data?.length) return []

  const empresaIds = [
    ...new Set(data.map((t) => String(t.empresa_id ?? '').trim()).filter(Boolean)),
  ]
  const nomePorEmpresa = new Map<string, string>()
  if (empresaIds.length) {
    const { data: emps } = await supabase
      .from('empresas')
      .select('id, nome_fantasia')
      .in('id', empresaIds)
    for (const e of emps ?? []) {
      nomePorEmpresa.set(String(e.id), String(e.nome_fantasia ?? ''))
    }
  }

  const byId = new Map(data.map((t) => [String(t.id), t]))
  return ids
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((t) => {
      const fotos = Array.isArray(t!.fotos) ? t!.fotos : []
      const foto = fotos.find((f) => typeof f === 'string' && f.trim()) ?? null
      const empId = t!.empresa_id != null ? String(t!.empresa_id) : null
      return {
        id: String(t!.id),
        titulo: String(t!.titulo ?? 'Atrativo'),
        foto_url: foto != null ? String(foto) : null,
        empresa_id: empId,
        empresa_nome: empId ? nomePorEmpresa.get(empId) || null : null,
        preco_inteira: t!.preco_inteira != null ? Number(t!.preco_inteira) : null,
        preco_meia: t!.preco_meia != null ? Number(t!.preco_meia) : null,
      }
    })
}

/**
 * Produtos / acomodações / tickets salvos (tabela favoritos).
 * Usado em Publicações Salvas para perfis que não têm a página /favoritos.
 */
export async function listarItensCatalogoSalvos(
  supabase: SupabaseClient,
  usuarioId: string,
): Promise<ItemCatalogoSalvo[]> {
  const uid = String(usuarioId)
  const { data: favRows, error } = await supabase
    .from('favoritos')
    .select('alvo_id, alvo_tipo, salvo_em')
    .eq('usuario_id', uid)
    .in('alvo_tipo', ['produto', 'acomodacao', 'ticket'])

  if (error) {
    console.error('[favoritosTurista] listarItensCatalogoSalvos:', error.message)
    return []
  }
  if (!favRows?.length) return []

  const dateByKey = new Map<string, string>()
  for (const row of favRows) {
    const tipo = String(row.alvo_tipo ?? '').trim()
    const id = row.alvo_id != null ? String(row.alvo_id).trim() : ''
    if (!tipo || !id) continue
    const key = `${tipo}:${id}`
    if (!dateByKey.has(key)) {
      dateByKey.set(key, row.salvo_em != null ? String(row.salvo_em) : '')
    }
  }

  const [prods, acoms, ticks] = await Promise.all([
    listarProdutosFavoritos(supabase, uid),
    listarAcomodacoesFavoritas(supabase, uid),
    listarTicketsFavoritos(supabase, uid),
  ])

  const items: ItemCatalogoSalvo[] = []

  for (const p of prods) {
    items.push({
      kind: 'produto',
      id: p.id,
      titulo: p.titulo,
      foto_url: p.foto_url,
      empresa_id: p.empresa_id,
      empresa_nome: p.empresa_nome,
      salvo_em: dateByKey.get(`produto:${p.id}`) ?? '',
      subtitulo: p.marca_nome || p.empresa_nome,
    })
  }

  for (const a of acoms) {
    const tipo = tipoCategoriaImovel(String(a.categoria_imovel ?? ''))
    const cat =
      tipo === 'particular'
        ? rotuloCategoriaParticularCurto(a.categoria_particular)
        : tipo === 'compartilhado'
          ? rotuloOpcaoCompartilhadaCurto(a.opcao_compartilhada)
          : ''
    const tituloBase = rotuloCategoriaImovelCurto(a.categoria_imovel) || 'Acomodação'
    const titulo = cat ? `${tituloBase} · ${cat}` : tituloBase
    items.push({
      kind: 'acomodacao',
      id: a.id,
      titulo,
      foto_url: a.foto_url,
      empresa_id: a.empresa_id || null,
      empresa_nome: a.empresa_nome,
      salvo_em: dateByKey.get(`acomodacao:${a.id}`) ?? '',
      subtitulo: a.empresa_nome,
    })
  }

  for (const t of ticks) {
    items.push({
      kind: 'ticket',
      id: t.id,
      titulo: t.titulo,
      foto_url: t.foto_url,
      empresa_id: t.empresa_id,
      empresa_nome: t.empresa_nome,
      salvo_em: dateByKey.get(`ticket:${t.id}`) ?? '',
      subtitulo: t.empresa_nome,
    })
  }

  items.sort((a, b) => {
    const ta = a.salvo_em ? Date.parse(a.salvo_em) : 0
    const tb = b.salvo_em ? Date.parse(b.salvo_em) : 0
    return tb - ta
  })
  return items
}
