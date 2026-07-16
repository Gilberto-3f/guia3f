'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import FaixaCotacoesConversor from '@/components/compras-cde/FaixaCotacoesConversor'
import FiltrosComprasCde, { type FiltrosHubState } from '@/components/compras-cde/FiltrosComprasCde'
import MiniCardProdutoVisitante from '@/components/compras-cde/MiniCardProdutoVisitante'
import DrawerProdutosCde from '@/components/DrawerProdutosCde'
import { filtrarFavoritoIdsPorUsuario } from '@/lib/favoritosTurista'
import {
  carregarCotacoesMap,
  listarDestaquesHub,
  listarProdutosHub,
  registrarIntencaoCde,
  type CotacaoMap,
  type ProdutoHubCard,
} from '@/lib/comprasCdeHub'

const filtrosIniciais: FiltrosHubState = {
  categoriaId: null,
  categoriaNome: null,
  subcategoriaIds: [],
  ordenarPreco: false,
  destaque: true,
  soOfertas: false,
  buscaAberta: false,
  termoBusca: '',
}

export default function ComprasCdePage() {
  const [cotacoes, setCotacoes] = useState<CotacaoMap>({ USD: 0.2, EUR: 0.18, ARS: 180, PYG: 1500 })
  const [cotLoading, setCotLoading] = useState(true)
  const [conversorAberto, setConversorAberto] = useState(false)
  const [filtros, setFiltros] = useState<FiltrosHubState>(filtrosIniciais)
  const [lista, setLista] = useState<ProdutoHubCard[]>([])
  const [loading, setLoading] = useState(true)
  const [visitanteId, setVisitanteId] = useState<string | null>(null)
  const [favIds, setFavIds] = useState<Set<string>>(() => new Set())
  const [infoAberto, setInfoAberto] = useState(false)
  const [drawerEmpresa, setDrawerEmpresa] = useState<{
    id: string
    nome: string
    username: string | null
    foto: string | null
    nota: number | null
    produtoId: string
  } | null>(null)

  useEffect(() => {
    void (async () => {
      setCotLoading(true)
      try {
        setCotacoes(await carregarCotacoesMap(supabase))
      } finally {
        setCotLoading(false)
      }
    })()
  }, [])

  const carregarFeed = useCallback(async (f: FiltrosHubState) => {
    setLoading(true)
    try {
      let items: ProdutoHubCard[]
      if (f.destaque && !f.ordenarPreco && !f.soOfertas && !f.termoBusca.trim()) {
        items = await listarDestaquesHub(supabase, {
          categoriaId: f.categoriaId,
          subcategoriaIds: f.subcategoriaIds.length ? f.subcategoriaIds : undefined,
        })
      } else {
        items = await listarProdutosHub(supabase, {
          categoriaId: f.categoriaId,
          subcategoriaIds: f.subcategoriaIds.length ? f.subcategoriaIds : undefined,
          soOfertas: f.soOfertas,
          termo: f.termoBusca.trim() || undefined,
          ordenarPrecoAsc: f.ordenarPreco,
        })
        if (f.destaque && f.categoriaId) {
          // Destaque com categoria: reordena por tendências 24h
          const dest = await listarDestaquesHub(supabase, {
            categoriaId: f.categoriaId,
            subcategoriaIds: f.subcategoriaIds.length ? f.subcategoriaIds : undefined,
          })
          const order = new Map(dest.map((p, i) => [p.id, i]))
          items = [...items].sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999))
        }
      }
      setLista(items)

      const {
        data: { session },
      } = await supabase.auth.getSession()
      const uid = session?.user?.id ?? null
      setVisitanteId(uid)
      if (uid && items.length) {
        setFavIds(await filtrarFavoritoIdsPorUsuario(supabase, uid, 'produto', items.map((p) => p.id)))
      } else {
        setFavIds(new Set())
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregarFeed(filtros)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega sob demanda via handlers
  }, [])

  const aplicarFiltros = (next: FiltrosHubState) => {
    // Abrir busca fecha conversor
    if (next.buscaAberta && !filtros.buscaAberta) {
      setConversorAberto(false)
    }
    setFiltros(next)
    void carregarFeed(next)
    if (next.categoriaId && next.categoriaId !== filtros.categoriaId) {
      void registrarIntencaoCde(supabase, {
        tipo: 'filtro',
        termo: next.categoriaNome ?? 'categoria',
        categoriaId: next.categoriaId,
      })
    }
  }

  const onBuscar = (termo: string) => {
    const t = termo.trim()
    const next = {
      ...filtros,
      termoBusca: t,
      buscaAberta: true,
      destaque: false,
    }
    setFiltros(next)
    setConversorAberto(false)
    void carregarFeed(next)
    if (t) {
      void registrarIntencaoCde(supabase, { tipo: 'busca', termo: t, categoriaId: next.categoriaId })
    }
  }

  const abrirProduto = (p: ProdutoHubCard) => {
    void registrarIntencaoCde(supabase, {
      tipo: 'clique',
      termo: p.nome,
      produtoId: p.id,
      categoriaId: p.categoria_id,
    })
    setDrawerEmpresa({
      id: p.empresa_id,
      nome: p.empresa_nome,
      username: p.empresa_username,
      foto: p.empresa_foto,
      nota: p.empresa_nota,
      produtoId: p.id,
    })
  }

  const taxaUsd = cotacoes.USD || 0.2

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-gray-50">
      <header className="shrink-0 bg-[#0097b2] pt-safe">
        <div className="px-4 py-3">
          <h1 className="flex items-center justify-center gap-2 text-lg font-bold tracking-wide text-white">
            <span className="text-xl leading-none" aria-hidden>
              🇵🇾
            </span>
            Compras CDE
            <span className="text-xl leading-none" aria-hidden>
              🇧🇷
            </span>
          </h1>
        </div>
        <FaixaCotacoesConversor
          cotacoes={cotacoes}
          loading={cotLoading}
          conversorAberto={conversorAberto}
          onToggleConversor={() => setConversorAberto((v) => !v)}
        />
      </header>

      <div className={`shrink-0 border-b border-gray-100 bg-[#f5f5f5] ${conversorAberto ? '' : ''}`}>
        <FiltrosComprasCde
          filtros={filtros}
          onChange={aplicarFiltros}
          onBuscar={onBuscar}
        />
      </div>

      <main className="min-h-0 flex-1 overflow-y-auto px-3 py-4 pb-24">
        {loading ? (
          <p className="py-10 text-center text-sm text-gray-400">Carregando produtos…</p>
        ) : lista.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">
            Nenhum produto encontrado. Tente outro filtro ou cadastre produtos no Botão Dinâmico.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {lista.map((p) => (
              <li key={p.id} className="flex justify-center sm:justify-stretch">
                <MiniCardProdutoVisitante
                  className="w-full max-w-sm"
                  item={p}
                  taxaUsd={taxaUsd}
                  notaMediaEmpresa={p.empresa_nota}
                  visitanteId={visitanteId}
                  favoritoInicial={favIds.has(p.id)}
                  onFavoritoChange={(salvo) => {
                    setFavIds((prev) => {
                      const next = new Set(prev)
                      if (salvo) next.add(p.id)
                      else next.delete(p.id)
                      return next
                    })
                  }}
                  onInfo={() => setInfoAberto(true)}
                  onVerProduto={() => abrirProduto(p)}
                />
              </li>
            ))}
          </ul>
        )}
      </main>

      {drawerEmpresa ? (
        <DrawerProdutosCde
          isOpen
          onClose={() => setDrawerEmpresa(null)}
          empresaId={drawerEmpresa.id}
          empresaNome={drawerEmpresa.nome}
          empresaUsername={drawerEmpresa.username}
          empresaFotoUrl={drawerEmpresa.foto}
          notaMedia={drawerEmpresa.nota}
          mostrarEmpresaNoDetalhe
          produtoIdInicial={drawerEmpresa.produtoId}
        />
      ) : null}

      {infoAberto ? (
        <div
          className="fixed inset-0 z-[160] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setInfoAberto(false)
          }}
          role="presentation"
        >
          <div className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-2xl" role="dialog">
            <h3 className="text-base font-bold text-[#001f3f]">ATENÇÃO</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              Ofertas, valores e disponibilidade estão sujeitos a mudanças sem aviso prévio.
            </p>
            <button
              type="button"
              onClick={() => setInfoAberto(false)}
              className="mt-4 w-full rounded-xl bg-[#0097b2] py-2.5 text-sm font-bold text-white"
            >
              Entendi
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
