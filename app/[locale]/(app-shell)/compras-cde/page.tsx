'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Info } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import FaixaCotacoesConversor from '@/components/compras-cde/FaixaCotacoesConversor'
import FiltrosComprasCde, { type FiltrosHubState } from '@/components/compras-cde/FiltrosComprasCde'
import MiniCardProdutoVisitante from '@/components/compras-cde/MiniCardProdutoVisitante'
import DrawerProdutosCde from '@/components/DrawerProdutosCde'
import PopupAvisoBloqueioConta from '@/components/PopupAvisoBloqueioConta'
import { filtrarFavoritoIdsPorUsuario } from '@/lib/favoritosTurista'
import { useGateComprasReservas } from '@/lib/useGateComprasReservas'
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
  subcategoriaNomes: [],
  ordenarPreco: false,
  destaque: true,
  soOfertas: false,
  buscaAberta: false,
  termoBusca: '',
}

const TEXTO_INFO_HUB_OBS =
  'OBS: Se atente às regras de compras das empresas participantes nas suas respectivas páginas desse guia turístico.'

export default function ComprasCdePage() {
  const {
    podeComprarReservar,
    loading: gateLoading,
    mensagemBloqueio,
    tituloBloqueio,
    avisoAberto,
    avisarBloqueio,
    fecharAvisoBloqueio,
  } = useGateComprasReservas()

  const [cotacoes, setCotacoes] = useState<CotacaoMap>({ USD: 0.2, EUR: 0.18, ARS: 180, PYG: 1500 })
  const [cotLoading, setCotLoading] = useState(true)
  const [conversorAberto, setConversorAberto] = useState(false)
  const [filtros, setFiltros] = useState<FiltrosHubState>(filtrosIniciais)
  const [lista, setLista] = useState<ProdutoHubCard[]>([])
  const [loading, setLoading] = useState(true)
  const [visitanteId, setVisitanteId] = useState<string | null>(null)
  const [favIds, setFavIds] = useState<Set<string>>(() => new Set())
  const [infoAberto, setInfoAberto] = useState(false)
  const [infoHubAberto, setInfoHubAberto] = useState(false)
  const [drawerEmpresa, setDrawerEmpresa] = useState<{
    id: string
    nome: string
    username: string | null
    foto: string | null
    nota: number | null
    produtoId: string
  } | null>(null)
  const impressoesSessao = useRef<Set<string>>(new Set())

  const hubLiberado = !gateLoading && podeComprarReservar

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

  useEffect(() => {
    if (gateLoading) return
    if (!podeComprarReservar) avisarBloqueio()
  }, [gateLoading, podeComprarReservar, avisarBloqueio])

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
    if (!hubLiberado) {
      setLista([])
      setLoading(false)
      return
    }
    void carregarFeed(filtros)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- feed sob demanda + gate
  }, [hubLiberado])

  const aplicarFiltros = (next: FiltrosHubState) => {
    if (!hubLiberado) {
      avisarBloqueio()
      return
    }
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

    const novasSubs = next.subcategoriaIds.filter((id) => !filtros.subcategoriaIds.includes(id))
    for (const subId of novasSubs) {
      const idx = next.subcategoriaIds.indexOf(subId)
      const nome = next.subcategoriaNomes[idx] ?? 'subcategoria'
      void registrarIntencaoCde(supabase, {
        tipo: 'filtro',
        termo: nome,
        categoriaId: next.categoriaId,
        subcategoriaId: subId,
      })
    }
  }

  const onBuscar = (termo: string) => {
    if (!hubLiberado) {
      avisarBloqueio()
      return
    }
    const t = termo.trim()
    const next = {
      ...filtros,
      termoBusca: t,
      buscaAberta: true,
      destaque: false,
      ordenarPreco: false,
      soOfertas: false,
      categoriaId: null,
      categoriaNome: null,
      subcategoriaIds: [],
      subcategoriaNomes: [],
    }
    setFiltros(next)
    setConversorAberto(false)
    void carregarFeed(next)
    if (t) {
      void registrarIntencaoCde(supabase, { tipo: 'busca', termo: t, categoriaId: null })
    }
  }

  const abrirProduto = (p: ProdutoHubCard) => {
    if (!hubLiberado) {
      avisarBloqueio()
      return
    }
    setDrawerEmpresa({
      id: p.empresa_id,
      nome: p.empresa_nome,
      username: p.empresa_username,
      foto: p.empresa_foto,
      nota: p.empresa_nota,
      produtoId: p.id,
    })
  }

  const registrarImpressao = (p: ProdutoHubCard) => {
    if (!hubLiberado) return
    if (impressoesSessao.current.has(p.id)) return
    impressoesSessao.current.add(p.id)
    void registrarIntencaoCde(supabase, {
      tipo: 'impressao',
      termo: p.nome,
      produtoId: p.id,
      categoriaId: p.categoria_id,
      subcategoriaId: p.subcategoria_id,
      marcaId: p.marca_id,
    })
  }

  const taxaUsd = cotacoes.USD || 0.2

  if (gateLoading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Carregando Compras CDE…</p>
      </div>
    )
  }

  if (!podeComprarReservar) {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-gray-50">
        <header className="shrink-0 bg-[#0097b2] px-4 py-3 pt-safe">
          <h1 className="text-center text-lg font-bold tracking-wide text-white">Compras CDE</h1>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 pb-24 text-center">
          <p className="text-sm leading-relaxed text-gray-600">
            {mensagemBloqueio ||
              'O Compras CDE está disponível após verificação completa ou pré-liberação da conta.'}
          </p>
          <button
            type="button"
            onClick={avisarBloqueio}
            className="rounded-xl bg-[#0097b2] px-5 py-2.5 text-sm font-bold text-white"
          >
            Ver detalhes
          </button>
        </div>
        <PopupAvisoBloqueioConta
          aberto={avisoAberto}
          onFechar={fecharAvisoBloqueio}
          titulo={tituloBloqueio}
          mensagem={mensagemBloqueio}
        />
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-gray-50">
      <header className="shrink-0 bg-[#0097b2] pt-safe">
        <div className="px-4 py-3">
          <h1 className="flex items-center justify-center gap-2 text-lg font-bold tracking-wide text-white">
            <span className="text-xl leading-none" aria-hidden>
              🇵🇾
            </span>
            Compras CDE
            <button
              type="button"
              onClick={() => setInfoHubAberto(true)}
              className="inline-flex items-center justify-center rounded-full p-0.5 text-white hover:bg-white/15"
              aria-label="Informações sobre o Compras CDE"
            >
              <Info className="h-5 w-5" strokeWidth={2.25} aria-hidden />
            </button>
          </h1>
        </div>
        <FaixaCotacoesConversor
          cotacoes={cotacoes}
          loading={cotLoading}
          conversorAberto={conversorAberto}
          onToggleConversor={() => setConversorAberto((v) => !v)}
        />
      </header>

      <div className="shrink-0 border-b border-gray-100 bg-[#f5f5f5]">
        <FiltrosComprasCde
          filtros={filtros}
          filtrosPadrao={filtrosIniciais}
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
                  cotacoes={cotacoes}
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
                  onImpressao={() => registrarImpressao(p)}
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

      {infoHubAberto ? (
        <div
          className="fixed inset-0 z-[160] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setInfoHubAberto(false)
          }}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-t-2xl border border-gray-200 bg-white p-5 shadow-lg sm:rounded-2xl"
            role="dialog"
            aria-labelledby="info-hub-cde-titulo"
          >
            <h3 id="info-hub-cde-titulo" className="text-center text-base font-bold text-black">
              ATENÇÃO
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-black">
              O <strong>Compras CDE</strong> é um comparador de preços (não um e-commerce), aqui você
              pode pesquisar preços de produtos e identificar ofertas exclusivas, entre vários outros
              benefícios.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-black">{TEXTO_INFO_HUB_OBS}</p>
            <button
              type="button"
              onClick={() => setInfoHubAberto(false)}
              className="mt-5 w-full rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-bold text-[#001f3f] hover:bg-gray-50"
            >
              Entendi
            </button>
          </div>
        </div>
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

      <PopupAvisoBloqueioConta
        aberto={avisoAberto}
        onFechar={fecharAvisoBloqueio}
        titulo={tituloBloqueio}
        mensagem={mensagemBloqueio}
      />
    </div>
  )
}
