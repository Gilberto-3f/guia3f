'use client'

import { useEffect, useState } from 'react'
import { Check, Heart, Percent, Search, ShoppingCart, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { listarCategoriasProduto } from '@/lib/comprasCdeTaxonomia'
import { listarSubcategoriasDaCategoria } from '@/lib/comprasCdeHub'
import type { ProdutoCategoriaRow } from '@/lib/comprasCdeCatalogo'

export type FiltrosHubState = {
  categoriaId: string | null
  categoriaNome: string | null
  subcategoriaIds: string[]
  ordenarPreco: boolean
  destaque: boolean
  soOfertas: boolean
  buscaAberta: boolean
  termoBusca: string
}

type Props = {
  filtros: FiltrosHubState
  onChange: (next: FiltrosHubState) => void
  onBuscar: (termo: string) => void
}

const btnCls = (ativo: boolean) =>
  `flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-2.5 text-[9px] font-bold uppercase leading-tight sm:gap-0.5 sm:py-2 sm:text-[10px] ${
    ativo ? 'bg-[#0097b2] text-white' : 'bg-white text-[#0097b2] border border-gray-200'
  }`

const iconCls = 'h-6 w-6 shrink-0 sm:h-5 sm:w-5'

export default function FiltrosComprasCde({ filtros, onChange, onBuscar }: Props) {
  const [popupCat, setPopupCat] = useState(false)
  const [fase, setFase] = useState<1 | 2>(1)
  const [categorias, setCategorias] = useState<ProdutoCategoriaRow[]>([])
  const [subcats, setSubcats] = useState<{ id: string; nome: string }[]>([])
  const [catTemp, setCatTemp] = useState<string | null>(null)
  const [subsTemp, setSubsTemp] = useState<string[]>([])
  const [termoLocal, setTermoLocal] = useState(filtros.termoBusca)

  useEffect(() => {
    setTermoLocal(filtros.termoBusca)
  }, [filtros.termoBusca])

  useEffect(() => {
    if (!popupCat) return
    void listarCategoriasProduto(supabase).then(setCategorias).catch(() => setCategorias([]))
  }, [popupCat])

  useEffect(() => {
    if (!catTemp || fase !== 2) return
    void listarSubcategoriasDaCategoria(supabase, catTemp).then(setSubcats).catch(() => setSubcats([]))
  }, [catTemp, fase])

  const abrirCategoria = () => {
    setFase(1)
    setCatTemp(filtros.categoriaId)
    setSubsTemp([...filtros.subcategoriaIds])
    setPopupCat(true)
  }

  const confirmarCategoria = () => {
    const cat = categorias.find((c) => c.id === catTemp)
    onChange({
      ...filtros,
      categoriaId: catTemp,
      categoriaNome: cat?.nome ?? null,
      subcategoriaIds: [...subsTemp],
      destaque: Boolean(catTemp),
    })
    setPopupCat(false)
  }

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
          onClick={() => onChange({ ...filtros, ordenarPreco: !filtros.ordenarPreco, destaque: false })}
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
          onClick={() => onChange({ ...filtros, buscaAberta: !filtros.buscaAberta })}
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

      {filtros.categoriaNome ? (
        <p className="text-center text-[11px] text-gray-500">
          Filtro: <span className="font-semibold text-[#001f3f]">{filtros.categoriaNome}</span>
          {filtros.subcategoriaIds.length > 0 ? ` · ${filtros.subcategoriaIds.length} subcategoria(s)` : ''}
        </p>
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
            <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
              <h3 className="text-sm font-bold text-[#001f3f]">
                {fase === 1 ? 'Escolha uma Categoria' : 'Subcategorias Disponíveis'}
              </h3>
              <button type="button" onClick={() => setPopupCat(false)} aria-label="Fechar">
                <X className="h-5 w-5 text-gray-500" aria-hidden />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {fase === 1 ? (
                <ul className="space-y-1.5">
                  {categorias.map((c) => {
                    const ativo = catTemp === c.id
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
                          <span className="text-gray-900">{c.nome}</span>
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
                            <span className="text-gray-900">{s.nome}</span>
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
