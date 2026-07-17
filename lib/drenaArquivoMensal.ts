import type { SupabaseClient } from '@supabase/supabase-js'
import {
  agregarRankingTermos,
  pizzaFromContagens,
  type FatiaCategoria,
  type TermoRanking,
} from '@/lib/drenaAnalytics'

export type ItemArquivo = {
  id: string
  nome: string
  total: number
}

export type DrenaArquivoPayload = {
  versao: 1
  ano: number
  mes: number
  gerado_em: string
  ranking100: {
    turistas: TermoRanking[]
    profissionais: TermoRanking[]
  }
  recomendacoes: {
    categorias: ItemArquivo[]
    subcategorias: ItemArquivo[]
    marcas: ItemArquivo[]
  }
  categorias: {
    filtroCategorias: ItemArquivo[]
    filtroSubcategorias: ItemArquivo[]
    motorCategorias: ItemArquivo[]
    motorSubcategorias: ItemArquivo[]
  }
  graficos: {
    pizza: FatiaCategoria[]
    listaDesempenho: ItemArquivo[]
  }
}

async function nomesPorIds(
  client: SupabaseClient,
  tabela: 'produto_categorias' | 'produto_subcategorias' | 'produto_marcas',
  ids: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (!ids.length) return map
  const { data } = await client.from(tabela).select('id, nome').in('id', ids)
  for (const r of data ?? []) {
    if (r.id) map.set(String(r.id), String(r.nome ?? '—'))
  }
  return map
}

function rankingFromCountMap(
  counts: Map<string, number>,
  nomes: Map<string, string>,
): ItemArquivo[] {
  return [...counts.entries()]
    .map(([id, total]) => ({ id, nome: nomes.get(id) ?? '—', total }))
    .sort((a, b) => b.total - a.total)
}

/** Agrega o pacote mensal do Drena (mesmo formato do hub Compras CDE). */
export async function montarPayloadArquivoMensal(
  client: SupabaseClient,
  ano: number,
  mes: number,
): Promise<DrenaArquivoPayload> {
  const inicio = new Date(Date.UTC(ano, mes - 1, 1)).toISOString()
  const fim = new Date(Date.UTC(ano, mes, 1)).toISOString()

  const { data: buscas, error: bErr } = await client
    .from('buscas_produto')
    .select('termo_busca, tipo, perfil, categoria_id, subcategoria_id, marca_id')
    .gte('created_at', inicio)
    .lt('created_at', fim)
    .limit(25000)
  if (bErr) throw bErr
  const rows = buscas ?? []

  const buscasTurista = rows.filter(
    (r) => r.tipo === 'busca' && String(r.perfil ?? '') === 'turista',
  )
  const buscasProf = rows.filter(
    (r) => r.tipo === 'busca' && String(r.perfil ?? '') === 'profissional',
  )

  const catRec = new Map<string, number>()
  const subRec = new Map<string, number>()
  const marcaRec = new Map<string, number>()
  const { data: recs } = await client
    .from('recomendacoes_produto')
    .select('categoria_id, subcategoria_id, marca_id')
    .gte('created_at', inicio)
    .lt('created_at', fim)
    .limit(15000)
  for (const r of recs ?? []) {
    if (r.categoria_id) {
      const id = String(r.categoria_id)
      catRec.set(id, (catRec.get(id) ?? 0) + 1)
    }
    if (r.subcategoria_id) {
      const id = String(r.subcategoria_id)
      subRec.set(id, (subRec.get(id) ?? 0) + 1)
    }
    if (r.marca_id) {
      const id = String(r.marca_id)
      marcaRec.set(id, (marcaRec.get(id) ?? 0) + 1)
    }
  }

  const catFiltro = new Map<string, number>()
  const subFiltro = new Map<string, number>()
  const catMotor = new Map<string, number>()
  const subMotor = new Map<string, number>()
  const catGeral = new Map<string, number>()

  for (const r of rows) {
    if (r.tipo === 'filtro') {
      if (r.categoria_id && !r.subcategoria_id) {
        const id = String(r.categoria_id)
        catFiltro.set(id, (catFiltro.get(id) ?? 0) + 1)
      }
      if (r.subcategoria_id) {
        const id = String(r.subcategoria_id)
        subFiltro.set(id, (subFiltro.get(id) ?? 0) + 1)
      }
    }
    if (r.tipo === 'clique') {
      if (r.categoria_id) {
        const id = String(r.categoria_id)
        catMotor.set(id, (catMotor.get(id) ?? 0) + 1)
      }
      if (r.subcategoria_id) {
        const id = String(r.subcategoria_id)
        subMotor.set(id, (subMotor.get(id) ?? 0) + 1)
      }
    }
    if (
      r.categoria_id &&
      (r.tipo === 'filtro' || r.tipo === 'clique' || r.tipo === 'impressao')
    ) {
      const id = String(r.categoria_id)
      catGeral.set(id, (catGeral.get(id) ?? 0) + 1)
    }
  }

  const allCatIds = [
    ...new Set([...catRec.keys(), ...catFiltro.keys(), ...catMotor.keys(), ...catGeral.keys()]),
  ]
  const allSubIds = [...new Set([...subRec.keys(), ...subFiltro.keys(), ...subMotor.keys()])]
  const allMarcaIds = [...marcaRec.keys()]

  const [nomesCat, nomesSub, nomesMarca] = await Promise.all([
    nomesPorIds(client, 'produto_categorias', allCatIds),
    nomesPorIds(client, 'produto_subcategorias', allSubIds),
    nomesPorIds(client, 'produto_marcas', allMarcaIds),
  ])

  const listaDesempenho = rankingFromCountMap(catGeral, nomesCat)

  return {
    versao: 1,
    ano,
    mes,
    gerado_em: new Date().toISOString(),
    ranking100: {
      turistas: agregarRankingTermos(buscasTurista, 100),
      profissionais: agregarRankingTermos(buscasProf, 100),
    },
    recomendacoes: {
      categorias: rankingFromCountMap(catRec, nomesCat),
      subcategorias: rankingFromCountMap(subRec, nomesSub),
      marcas: rankingFromCountMap(marcaRec, nomesMarca),
    },
    categorias: {
      filtroCategorias: rankingFromCountMap(catFiltro, nomesCat),
      filtroSubcategorias: rankingFromCountMap(subFiltro, nomesSub),
      motorCategorias: rankingFromCountMap(catMotor, nomesCat),
      motorSubcategorias: rankingFromCountMap(subMotor, nomesSub),
    },
    graficos: {
      pizza: pizzaFromContagens(
        new Map(listaDesempenho.map((i) => [i.id, { nome: i.nome, total: i.total }])),
      ),
      listaDesempenho,
    },
  }
}

export async function upsertArquivoMensal(
  client: SupabaseClient,
  ano: number,
  mes: number,
): Promise<DrenaArquivoPayload> {
  const payload = await montarPayloadArquivoMensal(client, ano, mes)
  const { error } = await client.from('drena_arquivo_mensal').upsert(
    {
      ano,
      mes,
      payload,
      gerado_em: payload.gerado_em,
    },
    { onConflict: 'ano,mes' },
  )
  if (error) throw error
  return payload
}
