'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { normalizarTextoTaxonomia } from '@/lib/comprasCdeCatalogo'
import { labelMes } from '@/lib/drenaAnalytics'

export type TipoFiltroLinha = 'palavra' | 'categoria' | 'subcategoria' | 'marca'

export type PontoMesLinha = {
  label: string
  ano: number
  mes: number
  filtro: number
  motor: number
  recomendacoes: number
}

export type RelatorioLinhaTempo = {
  rotulo: string
  tipo: TipoFiltroLinha
  resumo: { filtro: number; motor: number; recomendacoes: number }
  serie: PontoMesLinha[]
}

function mesesNoIntervalo(
  anoIni: number,
  mesIni: number,
  anoFim: number,
  mesFim: number,
): { ano: number; mes: number }[] {
  const out: { ano: number; mes: number }[] = []
  let y = anoIni
  let m = mesIni
  let guard = 0
  while (y < anoFim || (y === anoFim && m <= mesFim)) {
    out.push({ ano: y, mes: m })
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
    guard += 1
    if (guard > 36) break
  }
  return out
}

export function useDrenaLinhaTempo() {
  const [tipo, setTipo] = useState<TipoFiltroLinha>('palavra')
  const [valorTexto, setValorTexto] = useState('')
  const [valorId, setValorId] = useState('')
  const [anoIni, setAnoIni] = useState(() => {
    const d = new Date()
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 11, 1)).getUTCFullYear()
  })
  const [mesIni, setMesIni] = useState(() => {
    const d = new Date()
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 11, 1)).getUTCMonth() + 1
  })
  const [relatorio, setRelatorio] = useState<RelatorioLinhaTempo | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const [categorias, setCategorias] = useState<{ id: string; nome: string }[]>([])
  const [subcategorias, setSubcategorias] = useState<{ id: string; nome: string }[]>([])
  const [marcas, setMarcas] = useState<{ id: string; nome: string }[]>([])

  useEffect(() => {
    void (async () => {
      const [c, m, s] = await Promise.all([
        supabase.from('produto_categorias').select('id, nome').order('ordem'),
        supabase.from('produto_marcas').select('id, nome').order('nome').limit(500),
        supabase.from('produto_subcategorias').select('id, nome').order('nome').limit(800),
      ])
      setCategorias((c.data ?? []).map((r) => ({ id: String(r.id), nome: String(r.nome) })))
      setMarcas((m.data ?? []).map((r) => ({ id: String(r.id), nome: String(r.nome) })))
      setSubcategorias((s.data ?? []).map((r) => ({ id: String(r.id), nome: String(r.nome) })))
    })()
  }, [])

  const buscar = useCallback(async () => {
    setErro(null)
    setBuscando(true)
    setRelatorio(null)

    try {
      const now = new Date()
      const anoFim = now.getFullYear()
      const mesFim = now.getMonth() + 1

      const todos = mesesNoIntervalo(anoIni, mesIni, anoFim, mesFim)
      const janela = todos.slice(-12)
      if (!janela.length) {
        setErro('Intervalo de datas inválido.')
        return
      }

      const inicio = new Date(Date.UTC(janela[0].ano, janela[0].mes - 1, 1)).toISOString()
      const fim = new Date(Date.UTC(anoFim, mesFim, 1)).toISOString()

      let rotulo = ''
      let palavraNorm = ''

      if (tipo === 'palavra') {
        const t = valorTexto.trim()
        if (t.length < 2) {
          setErro('Informe uma palavra-chave com pelo menos 2 letras.')
          return
        }
        palavraNorm = normalizarTextoTaxonomia(t)
        rotulo = t
      } else {
        if (!valorId) {
          setErro('Selecione um valor para o filtro.')
          return
        }
        if (tipo === 'categoria') {
          rotulo = categorias.find((c) => c.id === valorId)?.nome ?? 'Categoria'
        } else if (tipo === 'subcategoria') {
          rotulo = subcategorias.find((c) => c.id === valorId)?.nome ?? 'Subcategoria'
        } else {
          rotulo = marcas.find((c) => c.id === valorId)?.nome ?? 'Marca'
        }
      }

      const { data: buscas, error: bErr } = await supabase
        .from('buscas_produto')
        .select('termo_busca, tipo, categoria_id, subcategoria_id, marca_id, created_at')
        .gte('created_at', inicio)
        .lt('created_at', fim)
        .limit(20000)
      if (bErr) throw bErr

      const { data: recs, error: rErr } = await supabase
        .from('recomendacoes_produto')
        .select('categoria_id, subcategoria_id, marca_id, produto_id, created_at')
        .gte('created_at', inicio)
        .lt('created_at', fim)
        .limit(15000)

      if (rErr) console.warn('[useDrenaLinhaTempo] recs:', rErr.message)

      let produtoIdsPalavra: Set<string> | null = null
      if (tipo === 'palavra' && palavraNorm) {
        const { data: prods } = await supabase
          .from('produtos')
          .select('id, nome')
          .eq('ativo', true)
          .limit(3000)
        produtoIdsPalavra = new Set()
        for (const p of prods ?? []) {
          if (normalizarTextoTaxonomia(String(p.nome ?? '')).includes(palavraNorm)) {
            produtoIdsPalavra.add(String(p.id))
          }
        }
      }

      const matchBusca = (r: {
        termo_busca?: string | null
        tipo?: string | null
        categoria_id?: string | null
        subcategoria_id?: string | null
        marca_id?: string | null
      }) => {
        if (tipo === 'palavra') {
          return normalizarTextoTaxonomia(String(r.termo_busca ?? '')) === palavraNorm
        }
        if (tipo === 'categoria') return String(r.categoria_id ?? '') === valorId
        if (tipo === 'subcategoria') return String(r.subcategoria_id ?? '') === valorId
        return String(r.marca_id ?? '') === valorId
      }

      const matchRec = (r: {
        categoria_id?: string | null
        subcategoria_id?: string | null
        marca_id?: string | null
        produto_id?: string | null
      }) => {
        if (tipo === 'palavra') {
          return produtoIdsPalavra?.has(String(r.produto_id ?? '')) ?? false
        }
        if (tipo === 'categoria') return String(r.categoria_id ?? '') === valorId
        if (tipo === 'subcategoria') return String(r.subcategoria_id ?? '') === valorId
        return String(r.marca_id ?? '') === valorId
      }

      const serie: PontoMesLinha[] = janela.map(({ ano, mes }) => ({
        label: `${labelMes(mes)}/${ano}`,
        ano,
        mes,
        filtro: 0,
        motor: 0,
        recomendacoes: 0,
      }))

      const idx = (iso: string) => {
        const d = new Date(iso)
        const ano = d.getUTCFullYear()
        const mes = d.getUTCMonth() + 1
        return serie.findIndex((p) => p.ano === ano && p.mes === mes)
      }

      for (const r of buscas ?? []) {
        if (!matchBusca(r)) continue
        const i = idx(String(r.created_at))
        if (i < 0) continue
        const t = String(r.tipo ?? '')
        if (tipo === 'palavra') {
          if (t === 'busca') serie[i].motor += 1
        } else {
          if (t === 'filtro') serie[i].filtro += 1
          if (t === 'clique') serie[i].motor += 1
        }
      }

      for (const r of recs ?? []) {
        if (!matchRec(r)) continue
        const i = idx(String(r.created_at))
        if (i < 0) continue
        serie[i].recomendacoes += 1
      }

      const resumo = {
        filtro: serie.reduce((a, p) => a + p.filtro, 0),
        motor: serie.reduce((a, p) => a + p.motor, 0),
        recomendacoes: serie.reduce((a, p) => a + p.recomendacoes, 0),
      }

      setRelatorio({ rotulo, tipo, resumo, serie })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao gerar relatório.')
    } finally {
      setBuscando(false)
    }
  }, [tipo, valorTexto, valorId, anoIni, mesIni, categorias, subcategorias, marcas])

  return {
    tipo,
    setTipo,
    valorTexto,
    setValorTexto,
    valorId,
    setValorId,
    anoIni,
    setAnoIni,
    mesIni,
    setMesIni,
    categorias,
    subcategorias,
    marcas,
    relatorio,
    buscando,
    erro,
    buscar,
    labelMes,
  }
}
