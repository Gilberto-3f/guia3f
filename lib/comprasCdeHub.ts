import type { SupabaseClient } from '@supabase/supabase-js'
import { empresaEhSegmentoLojasParaguai } from '@/lib/cidade-empresa'
import {
  mapProdutoRow,
  precoFinalUsd,
  produtoCorrespondeBuscaCde,
  type ProdutoCdeRow,
} from '@/lib/comprasCdeCatalogo'
import { normalizarMoedaPadrao, type MoedaPadraoLoja } from '@/lib/comprasCdeMoedaPadrao'

export type CotacaoMap = Record<string, number>

export type ProdutoHubCard = ProdutoCdeRow & {
  empresa_nome: string
  empresa_username: string | null
  empresa_foto: string | null
  empresa_nota: number | null
  empresa_moeda_padrao: MoedaPadraoLoja
}

export type TipoIntencaoCde = 'busca' | 'filtro' | 'tendencia' | 'clique' | 'impressao'

export type PerfilIntencaoCde = 'turista' | 'profissional' | 'empresa' | 'anon'

const SELECT_HUB = `
  id, empresa_id, nome, descricao, preco_usd, percentual_desconto,
  fotos, foto_url, site_url, ativo, categoria_id, subcategoria_id, marca_id,
  palavras_chave, created_at,
  produto_categorias ( id, nome, ordem ),
  produto_subcategorias ( id, nome ),
  produto_marcas ( id, nome ),
  empresas!inner (
    id, nome_fantasia, nome_usuario, foto_url, nota_media, cidade, categoria, status, moeda_padrao
  )
`

export async function carregarCotacoesMap(supabase: SupabaseClient): Promise<CotacaoMap> {
  const { data } = await supabase.from('cotacoes').select('moeda, valor_brl')
  const map: CotacaoMap = {
    USD: 0.2,
    EUR: 0.18,
    ARS: 180,
    PYG: 1500,
  }
  for (const row of data ?? []) {
    const m = String(row.moeda ?? '').toUpperCase()
    const v = Number(row.valor_brl)
    if (m && Number.isFinite(v) && v > 0) map[m] = v
  }
  return map
}

/** 1 unidade da moeda → BRL (valor_brl = quantidade da moeda por 1 BRL). */
export function brlPorUnidade(moeda: string, cotacoes: CotacaoMap): number {
  if (moeda === 'BRL') return 1
  const taxa = cotacoes[moeda]
  if (!taxa || taxa <= 0) return 0
  return Math.round((1 / taxa) * 100) / 100
}

export function converterMoedas(
  valor: number,
  de: string,
  para: string,
  cotacoes: CotacaoMap,
): number {
  if (!Number.isFinite(valor) || valor < 0) return 0
  if (de === para) return valor
  const paraBrl = de === 'BRL' ? valor : valor / (cotacoes[de] || 1)
  if (para === 'BRL') return Math.round(paraBrl * 100) / 100
  const taxaPara = cotacoes[para]
  if (!taxaPara) return 0
  return Math.round(paraBrl * taxaPara * 100) / 100
}

function mapHubRow(raw: Record<string, unknown>): ProdutoHubCard | null {
  const emp = raw.empresas as Record<string, unknown> | null
  if (!emp) return null
  /** Comparador COMPRAS CDE: exclusivo lojas de Ciudad del Este. */
  if (
    !empresaEhSegmentoLojasParaguai(
      emp.categoria != null ? String(emp.categoria) : null,
      emp.cidade != null ? String(emp.cidade) : null,
    )
  ) {
    return null
  }
  const status = emp.status != null ? String(emp.status) : ''
  if (status && status !== 'ativo' && status !== 'aprovado') {
    // mantém se docs_verificado/ativo fluxo antigo sem status estrito
  }
  const base = mapProdutoRow(raw)
  return {
    ...base,
    empresa_nome: String(emp.nome_fantasia ?? 'Loja'),
    empresa_username: emp.nome_usuario != null ? String(emp.nome_usuario) : null,
    empresa_foto: emp.foto_url != null ? String(emp.foto_url) : null,
    empresa_nota: emp.nota_media != null ? Number(emp.nota_media) : null,
    empresa_moeda_padrao: normalizarMoedaPadrao(emp.moeda_padrao),
  }
}

export async function listarProdutosHub(
  supabase: SupabaseClient,
  opts?: {
    categoriaId?: string | null
    subcategoriaIds?: string[]
    soOfertas?: boolean
    termo?: string
    ordenarPrecoAsc?: boolean
  },
): Promise<ProdutoHubCard[]> {
  let q = supabase.from('produtos').select(SELECT_HUB).eq('ativo', true)

  if (opts?.categoriaId) q = q.eq('categoria_id', opts.categoriaId)
  if (opts?.subcategoriaIds?.length) q = q.in('subcategoria_id', opts.subcategoriaIds)
  if (opts?.soOfertas) q = q.gt('percentual_desconto', 0)

  const termo = opts?.termo?.trim()
  if (termo) {
    // Pool amplo: match fino no cliente (metatags + nomes de cat/sub).
    q = q.limit(800)
  } else {
    q = q.limit(120)
  }

  const { data, error } = await q
  if (error) {
    console.error('[comprasCdeHub] listarProdutosHub:', error.message)
    return []
  }

  let lista = (data ?? [])
    .map((r) => mapHubRow(r as Record<string, unknown>))
    .filter((x): x is ProdutoHubCard => x != null)

  if (termo) {
    lista = lista.filter((p) => produtoCorrespondeBuscaCde(p, termo))
  }

  if (opts?.ordenarPrecoAsc) {
    lista = [...lista].sort(
      (a, b) =>
        precoFinalUsd(a.preco_usd, a.percentual_desconto) -
        precoFinalUsd(b.preco_usd, b.percentual_desconto),
    )
  }

  return lista
}

/** Tendências: produtos mais vistos no drawer (tipo clique) nas últimas 24h. */
export async function listarDestaquesHub(
  supabase: SupabaseClient,
  opts?: { categoriaId?: string | null; subcategoriaIds?: string[]; limite?: number },
): Promise<ProdutoHubCard[]> {
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: buscas, error } = await supabase
    .from('buscas_produto')
    .select('produto_id, created_at')
    .eq('tipo', 'clique')
    .not('produto_id', 'is', null)
    .gte('created_at', desde)
    .limit(5000)

  if (error) {
    console.error('[comprasCdeHub] destaques:', error.message)
  }

  const contagem = new Map<string, number>()
  for (const b of buscas ?? []) {
    if (b.produto_id) {
      const id = String(b.produto_id)
      contagem.set(id, (contagem.get(id) ?? 0) + 1)
    }
  }

  const todos = await listarProdutosHub(supabase, {
    categoriaId: opts?.categoriaId,
    subcategoriaIds: opts?.subcategoriaIds,
  })

  if (contagem.size === 0) {
    // Sem intenções recentes: mostra mais recentes / com oferta primeiro
    return [...todos]
      .sort((a, b) => (Number(b.percentual_desconto) || 0) - (Number(a.percentual_desconto) || 0))
      .slice(0, opts?.limite ?? 40)
  }

  return [...todos]
    .sort((a, b) => (contagem.get(b.id) ?? 0) - (contagem.get(a.id) ?? 0))
    .slice(0, opts?.limite ?? 40)
}

async function resolverPerfilIntencao(
  supabase: SupabaseClient,
  usuarioId: string | null,
): Promise<PerfilIntencaoCde> {
  if (!usuarioId) return 'anon'
  const { data } = await supabase.from('usuarios').select('role').eq('id', usuarioId).maybeSingle()
  const role = String(data?.role ?? '').toLowerCase()
  if (role === 'turista') return 'turista'
  if (role === 'profissional') return 'profissional'
  if (role === 'empresa') return 'empresa'
  return 'anon'
}

export async function registrarIntencaoCde(
  supabase: SupabaseClient,
  payload: {
    tipo: TipoIntencaoCde
    termo?: string
    produtoId?: string | null
    categoriaId?: string | null
    subcategoriaId?: string | null
    marcaId?: string | null
  },
): Promise<void> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const uid = session?.user?.id ?? null
    const perfil = await resolverPerfilIntencao(supabase, uid)
    const row: Record<string, unknown> = {
      termo_busca: (payload.termo ?? payload.tipo).trim() || payload.tipo,
      tipo: payload.tipo,
      produto_id: payload.produtoId ?? null,
      categoria_id: payload.categoriaId ?? null,
      subcategoria_id: payload.subcategoriaId ?? null,
      marca_id: payload.marcaId ?? null,
      perfil,
    }
    if (uid) row.usuario_id = uid
    const { error } = await supabase.from('buscas_produto').insert(row)
    if (error) {
      const msg = String(error.message ?? '').toLowerCase()
      if (msg.includes('subcategoria') || msg.includes('marca_id') || msg.includes('perfil')) {
        const legado: Record<string, unknown> = {
          termo_busca: row.termo_busca,
          tipo: row.tipo,
          produto_id: row.produto_id,
          categoria_id: row.categoria_id,
        }
        if (uid) legado.usuario_id = uid
        const { error: e2 } = await supabase.from('buscas_produto').insert(legado)
        if (e2) console.error('[comprasCdeHub] intencao:', e2.message)
        return
      }
      console.error('[comprasCdeHub] intencao:', error.message)
    }
  } catch (e) {
    console.error('[comprasCdeHub] intencao', e)
  }
}

export async function listarSubcategoriasDaCategoria(
  supabase: SupabaseClient,
  categoriaId: string,
): Promise<{ id: string; nome: string }[]> {
  const { data, error } = await supabase
    .from('produto_subcategorias')
    .select('id, nome')
    .eq('categoria_id', categoriaId)
    .order('nome')
  if (error) {
    console.error('[comprasCdeHub] subcats:', error.message)
    return []
  }
  return (data ?? []).map((r) => ({ id: String(r.id), nome: String(r.nome) }))
}

/** Contagem de produtos ativos por categoria_id (popup de filtros) — só lojas CDE. */
export async function contarProdutosPorCategoria(
  supabase: SupabaseClient,
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('produtos')
    .select('categoria_id, empresas!inner ( cidade, categoria )')
    .eq('ativo', true)
    .not('categoria_id', 'is', null)
    .limit(5000)
  if (error) {
    console.error('[comprasCdeHub] contarPorCategoria:', error.message)
    return {}
  }
  const map: Record<string, number> = {}
  for (const row of data ?? []) {
    const emp = (row as { empresas?: { cidade?: string | null; categoria?: string | null } })
      .empresas
    if (
      !empresaEhSegmentoLojasParaguai(
        emp?.categoria != null ? String(emp.categoria) : null,
        emp?.cidade != null ? String(emp.cidade) : null,
      )
    ) {
      continue
    }
    const id = row.categoria_id ? String(row.categoria_id) : ''
    if (!id) continue
    map[id] = (map[id] ?? 0) + 1
  }
  return map
}

/** Contagem de produtos ativos por subcategoria_id (popup fase 2) — só lojas CDE. */
export async function contarProdutosPorSubcategoria(
  supabase: SupabaseClient,
  categoriaId?: string | null,
): Promise<Record<string, number>> {
  let q = supabase
    .from('produtos')
    .select('subcategoria_id, empresas!inner ( cidade, categoria )')
    .eq('ativo', true)
    .not('subcategoria_id', 'is', null)
    .limit(5000)
  if (categoriaId) q = q.eq('categoria_id', categoriaId)
  const { data, error } = await q
  if (error) {
    console.error('[comprasCdeHub] contarPorSubcategoria:', error.message)
    return {}
  }
  const map: Record<string, number> = {}
  for (const row of data ?? []) {
    const emp = (row as { empresas?: { cidade?: string | null; categoria?: string | null } })
      .empresas
    if (
      !empresaEhSegmentoLojasParaguai(
        emp?.categoria != null ? String(emp.categoria) : null,
        emp?.cidade != null ? String(emp.cidade) : null,
      )
    ) {
      continue
    }
    const id = row.subcategoria_id ? String(row.subcategoria_id) : ''
    if (!id) continue
    map[id] = (map[id] ?? 0) + 1
  }
  return map
}
