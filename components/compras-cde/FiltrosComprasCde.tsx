'use client'

import { useEffect, useState } from 'react'
import { Check, Heart, Percent, Search, ShoppingCart, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { listarCategoriasProduto } from '@/lib/comprasCdeTaxonomia'
import {
  contarProdutosPorCategoria,
  contarProdutosPorSubcategoria,
  listarSubcategoriasDaCategoria,
} from '@/lib/comprasCdeHub'
import type { ProdutoCategoriaRow } from '@/lib/comprasCdeCatalogo'

export type FiltrosHubState = {
  categoriaId: string | null
  categoriaNome: string | null
  subcategoriaIds: string[]
  subcategoriaNomes: string[]
  ordenarPreco: boolean
  destaque: boolean
  soOfertas: boolean
  buscaAberta: boolean
  termoBusca: string
}

type Props = {
  filtros: FiltrosHubState
  filtrosPadrao: FiltrosHubState
  onChange: (next: FiltrosHubState) => void
  onBuscar: (termo: string) => void
}

type BlocoResumo = { titulo: string; subtitulo: string }

const btnCls = (ativo: boolean) =>
  `flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-2.5 text-[9px] font-bold uppercase leading-tight sm:gap-0.5 sm:py-2 sm:text-[10px] ${
    ativo ? 'bg-[#0097b2] text-white' : 'bg-white text-[#0097b2] border border-gray-200'
  }`

const iconCls = 'h-6 w-6 shrink-0 sm:h-5 sm:w-5'

/** Ícone de vassoura (limpar filtro) — Lucide 0.468 não tem broom. */
function IconeVassoura({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M5 22h14" />
      <path d="M9 14l-3 3" />
      <path d="M12 14v5" />
      <path d="M15 14l3 3" />
      <path d="M12 3v7" />
      <path d="M9 10h6l1 4H8l1-4z" />
    </svg>
  )
}

function BlocoTexto({ bloco, align }: { bloco: BlocoResumo; align: 'left' | 'center' | 'right' }) {
  const alignCls =
    align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center'
  return (
    <div className={`min-w-0 ${alignCls}`}>
      <p className="font-semibold text-[#001f3f]">{bloco.titulo}</p>
      <p className="text-[10px] font-medium text-gray-500">{bloco.subtitulo}</p>
    </div>
  )
}

export default function FiltrosComprasCde({ filtros, filtrosPadrao, onChange, onBuscar }: Props) {
  const [popupCat, setPopupCat] = useState(false)
  const [fase, setFase] = useState<1 | 2>(1)
  const [categorias, setCategorias] = useState<ProdutoCategoriaRow[]>([])
  const [contagemCat, setContagemCat] = useState<Record<string, number>>({})
  const [contagemSub, setContagemSub] = useState<Record<string, number>>({})
  const [subcats, setSubcats] = useState<{ id: string; nome: string }[]>([])
  const [catTemp, setCatTemp] = useState<string | null>(null)
  const [subsTemp, setSubsTemp] = useState<string[]>([])
  const [termoLocal, setTermoLocal] = useState(filtros.termoBusca)

  useEffect(() => {
    setTermoLocal(filtros.termoBusca)
  }, [filtros.termoBusca])

  useEffect(() => {
    if (!popupCat) return
    void Promise.all([
      listarCategoriasProduto(supabase),
      contarProdutosPorCategoria(supabase),
    ])
      .then(([cats, cont]) => {
        setCategorias(cats)
        setContagemCat(cont)
      })
      .catch(() => {
        setCategorias([])
        setContagemCat({})
      })
  }, [popupCat])

  useEffect(() => {
    if (!catTemp || fase !== 2) return
    void Promise.all([
      listarSubcategoriasDaCategoria(supabase, catTemp),
      contarProdutosPorSubcategoria(supabase, catTemp),
    ])
      .then(([subs, cont]) => {
        setSubcats(subs)
        setContagemSub(cont)
      })
      .catch(() => {
        setSubcats([])
        setContagemSub({})
      })
  }, [catTemp, fase])

  const abrirCategoria = () => {
    setFase(1)
    setCatTemp(filtros.categoriaId)
    setSubsTemp([...filtros.subcategoriaIds])
    setPopupCat(true)
    if (filtros.buscaAberta || filtros.termoBusca.trim()) {
      onChange({
        ...filtros,
        buscaAberta: false,
        termoBusca: '',
      })
      setTermoLocal('')
    }
  }

  const confirmarCategoria = () => {
    const cat = categorias.find((c) => c.id === catTemp)
    const nomesSubs = subcats.filter((s) => subsTemp.includes(s.id)).map((s) => s.nome)
    onChange({
      ...filtros,
      categoriaId: catTemp,
      categoriaNome: cat?.nome ?? null,
      subcategoriaIds: [...subsTemp],
      subcategoriaNomes: nomesSubs,
      buscaAberta: false,
      termoBusca: '',
      destaque: Boolean(catTemp),
      ordenarPreco: false,
      soOfertas: false,
    })
    setTermoLocal('')
    setPopupCat(false)
  }

  /** Limpa só os checkboxes do popup — mantém o popup aberto. */
  const limparCategoriasPopup = () => {
    setCatTemp(null)
    setSubsTemp([])
    setFase(1)
    setContagemSub({})
    const semApoioAtivo = !filtros.ordenarPreco && !filtros.soOfertas
    onChange({
      ...filtros,
      categoriaId: null,
      categoriaNome: null,
      subcategoriaIds: [],
      subcategoriaNomes: [],
      destaque: semApoioAtivo ? filtrosPadrao.destaque : false,
    })
  }

  const toggleBusca = () => {
    const abrindo = !filtros.buscaAberta
    onChange({
      ...filtros,
      buscaAberta: abrindo,
      categoriaId: null,
      categoriaNome: null,
      subcategoriaIds: [],
      subcategoriaNomes: [],
      termoBusca: abrindo ? filtros.termoBusca : '',
      destaque: abrindo ? false : filtros.destaque,
    })
    if (!abrindo) setTermoLocal('')
  }

  const blocoPrincipal: BlocoResumo | null = (() => {
    const termo = filtros.termoBusca.trim()
    if (termo) {
      return { titulo: `"${termo}"`, subtitulo: 'sua busca' }
    }
    if (filtros.categoriaNome) {
      if (filtros.subcategoriaNomes.length > 0) {
        return {
          titulo: filtros.categoriaNome,
          subtitulo: filtros.subcategoriaNomes.join(', '),
        }
      }
      return { titulo: filtros.categoriaNome, subtitulo: 'categoria' }
    }
    return null
  })()

  const blocoApoio: BlocoResumo | null = (() => {
    if (filtros.ordenarPreco) {
      return { titulo: 'Comparador de Preços', subtitulo: 'do menor para o maior' }
    }
    if (filtros.destaque) {
      return { titulo: 'Tendências da Categoria', subtitulo: 'mais pesquisados' }
    }
    if (filtros.soOfertas) {
      return { titulo: 'Produtos em Ofertas', subtitulo: 'em promoção' }
    }
    return null
  })()

  const mostrarLinhaResumo = Boolean(blocoPrincipal || blocoApoio)
  const layoutSplit = Boolean(blocoPrincipal && blocoApoio)

  return (
    <div className="space-y-2 px-3 py-2">
      <div className="flex gap-1.5">
        <button
          type="button"
          className={btnCls(Boolean(filtros.categoriaId))}
          onClick={abrirCategoria}
          aria-label="Categoria"
        >
          <ShoppingCart className={iconCls} aria-hidden />
          <span className="hidden sm:inline">Categoria</span>
        </button>
        <button
          type="button"
          className={btnCls(filtros.ordenarPreco)}
          onClick={() =>
            onChange({
              ...filtros,
              ordenarPreco: !filtros.ordenarPreco,
              destaque: false,
              soOfertas: false,
            })
          }
          title="Do menor valor para o maior"
          aria-label="Comparador"
        >
          <span className="text-xl font-black leading-none sm:text-base" aria-hidden>
            $
          </span>
          <span className="hidden sm:inline">Comparador</span>
        </button>
        <button
          type="button"
          className={btnCls(filtros.destaque)}
          onClick={() =>
            onChange({
              ...filtros,
              destaque: !filtros.destaque,
              ordenarPreco: false,
              soOfertas: false,
            })
          }
          aria-label="Destaque"
        >
          <Heart className={iconCls} aria-hidden />
          <span className="hidden sm:inline">Destaque</span>
        </button>
        <button
          type="button"
          className={btnCls(filtros.soOfertas)}
          onClick={() =>
            onChange({
              ...filtros,
              soOfertas: !filtros.soOfertas,
              destaque: false,
              ordenarPreco: false,
            })
          }
          aria-label="Oferta"
        >
          <Percent className={iconCls} aria-hidden />
          <span className="hidden sm:inline">Oferta</span>
        </button>
        <button
          type="button"
          className={btnCls(filtros.buscaAberta)}
          onClick={toggleBusca}
          aria-label="Busca"
        >
          <Search className={iconCls} aria-hidden />
          <span className="hidden sm:inline">Busca</span>
        </button>
      </div>

      {filtros.buscaAberta ? (
        <div className="flex gap-2">
          <input
            type="search"
            value={termoLocal}
            onChange={(e) => setTermoLocal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onBuscar(termoLocal)
            }}
            placeholder="Produto, Marca..."
            className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400"
          />
          <button
            type="button"
            onClick={() => onBuscar(termoLocal)}
            className="inline-flex items-center gap-1 rounded-lg bg-[#00D443] px-3 py-2 text-sm font-bold text-white"
          >
            <Search className="h-4 w-4" aria-hidden />
            Buscar
          </button>
        </div>
      ) : null}

      {mostrarLinhaResumo ? (
        layoutSplit ? (
          <div className="flex items-start justify-between gap-3 px-0.5 text-[11px] leading-snug">
            {blocoPrincipal ? <BlocoTexto bloco={blocoPrincipal} align="left" /> : null}
            {blocoApoio ? <BlocoTexto bloco={blocoApoio} align="right" /> : null}
          </div>
        ) : (
          <div className="flex justify-center px-0.5 text-[11px] leading-snug">
            <BlocoTexto bloco={(blocoPrincipal ?? blocoApoio)!} align="center" />
          </div>
        )
      ) : null}

      {popupCat ? (
        <div
          className="fixed inset-0 z-[160] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPopupCat(false)
          }}
          role="presentation"
        >
          <div
            className="flex h-[min(85dvh,32rem)] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white sm:rounded-2xl"
            role="dialog"
            aria-modal="true"
            aria-label={fase === 1 ? 'Escolha uma Categoria' : 'Subcategorias Disponíveis'}
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3">
              <h3 className="min-w-0 flex-1 text-sm font-bold text-[#001f3f]">
                {fase === 1 ? 'Escolha uma Categoria' : 'Subcategorias Disponíveis'}
              </h3>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={limparCategoriasPopup}
                  className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
                  aria-label="Limpar filtros de categoria"
                  title="Limpar"
                >
                  <IconeVassoura className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPopupCat(false)}
                  className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {fase === 1 ? (
                <ul className="space-y-1.5">
                  {categorias.map((c) => {
                    const ativo = catTemp === c.id
                    const qtd = contagemCat[c.id] ?? 0
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setCatTemp(c.id)
                            setSubsTemp([])
                            setFase(2)
                          }}
                          className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm font-medium text-gray-900 ${
                            ativo ? 'border-[#0097b2] bg-[#0097b2]/10' : 'border-gray-200 bg-white'
                          }`}
                        >
                          <span
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                              ativo ? 'border-[#0097b2] bg-[#0097b2]' : 'border-gray-300 bg-white'
                            }`}
                          >
                            {ativo ? <Check className="h-2.5 w-2.5 text-white" aria-hidden /> : null}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-gray-900">{c.nome}</span>
                          <span className="shrink-0 tabular-nums text-xs font-semibold text-gray-400">
                            {qtd}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <ul className="space-y-1.5">
                  {subcats.length === 0 ? (
                    <p className="py-4 text-center text-sm text-gray-600">
                      Nenhuma subcategoria ainda — busque só pela categoria.
                    </p>
                  ) : (
                    subcats.map((s) => {
                      const ativo = subsTemp.includes(s.id)
                      const qtd = contagemSub[s.id] ?? 0
                      return (
                        <li key={s.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSubsTemp((prev) =>
                                ativo ? prev.filter((id) => id !== s.id) : [...prev, s.id],
                              )
                            }}
                            className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm font-medium text-gray-900 ${
                              ativo ? 'border-[#0097b2] bg-[#0097b2]/10' : 'border-gray-200 bg-white'
                            }`}
                          >
                            <span
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                ativo ? 'border-[#0097b2] bg-[#0097b2]' : 'border-gray-300 bg-white'
                              }`}
                            >
                              {ativo ? <Check className="h-2.5 w-2.5 text-white" aria-hidden /> : null}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-gray-900">{s.nome}</span>
                            <span className="shrink-0 tabular-nums text-xs font-semibold text-gray-400">
                              {qtd}
                            </span>
                          </button>
                        </li>
                      )
                    })
                  )}
                </ul>
              )}
            </div>
            <div className="flex shrink-0 gap-2 border-t p-4">
              {fase === 2 ? (
                <button
                  type="button"
                  onClick={() => setFase(1)}
                  className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700"
                >
                  Voltar
                </button>
              ) : null}
              <button
                type="button"
                disabled={!catTemp}
                onClick={confirmarCategoria}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#00D443] py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                <Search className="h-4 w-4" aria-hidden />
                BUSCAR
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
