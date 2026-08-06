'use client'

import {
  Children,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Hotel,
  ShoppingBag,
  Store,
  Star,
  Ticket,
  Utensils,
  Wrench,
} from 'lucide-react'
import { useRouter } from '@/i18n/navigation'
import AvatarImage from '@/components/AvatarImage'
import ChevronPasta from '@/app/[locale]/(app-shell)/empresa/components/menu-empresa/hospedagem/ChevronPasta'
import DrawerProdutosCde from '@/components/DrawerProdutosCde'
import DrawerCardapio from '@/components/DrawerCardapio'
import DrawerServicosLocais from '@/components/DrawerServicosLocais'
import DrawerTicketsAtrativos from '@/components/DrawerTicketsAtrativos'
import DrawerReservaHospedagem from '@/components/DrawerReservaHospedagem'
import { supabase } from '@/lib/supabase'
import {
  listarAcomodacoesFavoritas,
  listarEmpresasFavoritas,
  listarProdutosFavoritos,
  listarPratosFavoritos,
  listarServicosFavoritos,
  listarTicketsFavoritos,
  type AcomodacaoFavoritaCard,
  type EmpresaFavoritaCard,
  type ProdutoFavoritoCard,
  type PratoFavoritoCard,
  type ServicoFavoritoCard,
  type TicketFavoritoCard,
} from '@/lib/favoritosTurista'
import {
  empresaEhLojasBrasilOuArgentina,
  empresaEhSegmentoLojasParaguai,
} from '@/lib/cidade-empresa'
import {
  rotuloCategoriaImovelCurto,
  rotuloCategoriaParticularCurto,
  rotuloOpcaoCompartilhadaCurto,
  tipoCategoriaImovel,
} from '@/lib/hospedagemAcomodacoesCatalogo'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import { formatarUsd } from '@/lib/comprasCdeCatalogo'
import { formatarPrecoTicket } from '@/lib/atrativosCatalogo'

const COR = '#0097b2'

/**
 * Carrossel horizontal (padrão dos drawers dos botões dinâmicos):
 * um minicard por vez + setas laterais para avançar/voltar.
 */
function CarrosselMinicardsFavoritos({ children }: { children: ReactNode }) {
  const items = Children.toArray(children).filter(Boolean)
  const [idx, setIdx] = useState(0)
  const touchX = useRef<number | null>(null)
  const n = items.length

  useEffect(() => {
    setIdx((i) => (n === 0 ? 0 : Math.min(i, n - 1)))
  }, [n])

  const irAnterior = useCallback(() => {
    if (n <= 1) return
    setIdx((i) => (i - 1 + n) % n)
  }, [n])

  const irProximo = useCallback(() => {
    if (n <= 1) return
    setIdx((i) => (i + 1) % n)
  }, [n])

  if (n === 0) return null

  return (
    <div>
      <div className="relative px-6">
        <div
          className="w-full touch-pan-y"
          onTouchStart={(e) => {
            touchX.current = e.touches[0]?.clientX ?? null
          }}
          onTouchEnd={(e) => {
            const start = touchX.current
            touchX.current = null
            if (start == null || n <= 1) return
            const end = e.changedTouches[0]?.clientX
            if (end == null) return
            const dx = end - start
            if (Math.abs(dx) < 40) return
            if (dx < 0) irProximo()
            else irAnterior()
          }}
        >
          {items[idx]}
        </div>
        {n > 1 ? (
          <>
            <button
              type="button"
              className="absolute left-0 top-1/2 z-10 flex w-6 -translate-y-1/2 items-center justify-center"
              style={{ color: COR }}
              onClick={irAnterior}
              aria-label="Anterior"
            >
              <ChevronLeft className="h-6 w-6" strokeWidth={2.5} aria-hidden />
            </button>
            <button
              type="button"
              className="absolute right-0 top-1/2 z-10 flex w-6 -translate-y-1/2 items-center justify-center"
              style={{ color: COR }}
              onClick={irProximo}
              aria-label="Próximo"
            >
              <ChevronRight className="h-6 w-6" strokeWidth={2.5} aria-hidden />
            </button>
          </>
        ) : null}
      </div>
      {n > 1 ? (
        <p className="mt-2 text-center text-[11px] font-semibold text-gray-400">
          {idx + 1} / {n}
        </p>
      ) : null}
    </div>
  )
}

type Pastas = {
  comprasCde: boolean
  lojasBrAr: boolean
  gastronomia: boolean
  servicosLocais: boolean
  tickets: boolean
  hospedagem: boolean
  empresas: boolean
}

type DrawerProdutoState = {
  empresaId: string
  empresaNome: string
  produtoId: string
} | null

type DrawerPratoState = {
  empresaId: string
  empresaNome: string
  pratoId: string
} | null

type DrawerServicoState = {
  empresaId: string
  empresaNome: string
  servicoId: string
} | null

type DrawerTicketState = {
  empresaId: string
  empresaNome: string
  ticketId: string
} | null

type DrawerAcomodacaoState = {
  empresaId: string
  empresaNome: string
  acomodacaoId: string
  empresaUsername: string | null
  empresaFotoUrl: string | null
  notaMedia: number | null
  empresaVerificada: boolean
} | null

function rotuloAcomodacaoFavorita(a: AcomodacaoFavoritaCard): string | null {
  const tipo = tipoCategoriaImovel(String(a.categoria_imovel ?? ''))
  const cat =
    tipo === 'particular'
      ? rotuloCategoriaParticularCurto(a.categoria_particular)
      : tipo === 'compartilhado'
        ? rotuloOpcaoCompartilhadaCurto(a.opcao_compartilhada)
        : ''
  const qtd = Number(a.capacidade_pessoas) || 0
  if (cat && qtd > 0) return `${cat} · ${qtd} ${qtd === 1 ? 'pessoa' : 'pessoas'}`
  if (cat) return cat
  if (qtd > 0) return `${qtd} ${qtd === 1 ? 'pessoa' : 'pessoas'}`
  return null
}

function CardProdutoFavorito({
  p,
  onVer,
}: {
  p: ProdutoFavoritoCard
  onVer: () => void
}) {
  return (
    <article className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <p className="px-3 pt-3 text-sm font-semibold text-[#001f3f]">{p.titulo}</p>
      <div className="mt-2 aspect-[4/3] bg-gray-100">
        {p.foto_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.foto_url} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="space-y-2 p-3">
        {p.marca_nome ? (
          <p className="text-sm font-semibold text-[#001f3f]">{p.marca_nome}</p>
        ) : null}
        {p.empresa_nome ? (
          <p className="truncate text-xs text-gray-500">{p.empresa_nome}</p>
        ) : null}
        {p.preco != null ? (
          <p className="text-sm font-bold text-[#0097b2]">
            {formatarUsd(p.preco)}
            {p.percentual_desconto > 0 ? (
              <span className="ml-1.5 rounded bg-[#00D443]/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#00D443]">
                −{p.percentual_desconto}%
              </span>
            ) : null}
          </p>
        ) : null}
        {p.empresa_id ? (
          <button
            type="button"
            onClick={onVer}
            className="w-full rounded-lg bg-[#0097b2] py-2 text-xs font-bold text-white"
          >
            Ver produto
          </button>
        ) : null}
      </div>
    </article>
  )
}

function CardPratoFavorito({
  p,
  onVer,
}: {
  p: PratoFavoritoCard
  onVer: () => void
}) {
  return (
    <article className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <p className="px-3 pt-3 text-sm font-semibold text-[#001f3f]">{p.titulo}</p>
      <div className="mt-2 aspect-[4/3] bg-gray-100">
        {p.foto_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.foto_url} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="space-y-2 p-3">
        {p.categoria_nome ? (
          <p className="text-sm font-semibold text-[#001f3f]">{p.categoria_nome}</p>
        ) : null}
        {p.empresa_nome ? (
          <p className="truncate text-xs text-gray-500">{p.empresa_nome}</p>
        ) : null}
        {p.preco != null ? (
          <p className="text-sm font-bold text-[#0097b2]">
            {formatarUsd(p.preco)}
            {p.percentual_desconto > 0 ? (
              <span className="ml-1.5 rounded bg-[#00D443]/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#00D443]">
                −{p.percentual_desconto}%
              </span>
            ) : null}
          </p>
        ) : null}
        {p.empresa_id ? (
          <button
            type="button"
            onClick={onVer}
            className="w-full rounded-lg bg-[#0097b2] py-2 text-xs font-bold text-white"
          >
            VER PRATO
          </button>
        ) : null}
      </div>
    </article>
  )
}

function CardServicoFavorito({
  p,
  onVer,
}: {
  p: ServicoFavoritoCard
  onVer: () => void
}) {
  return (
    <article className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <p className="px-3 pt-3 text-sm font-semibold text-[#001f3f]">{p.titulo}</p>
      <div className="mt-2 aspect-[4/3] bg-gray-100">
        {p.foto_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.foto_url} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="space-y-2 p-3">
        {p.categoria_nome ? (
          <p className="text-sm font-semibold text-[#001f3f]">{p.categoria_nome}</p>
        ) : null}
        {p.empresa_nome ? (
          <p className="truncate text-xs text-gray-500">{p.empresa_nome}</p>
        ) : null}
        {p.preco != null ? (
          <p className="text-sm font-bold text-[#0097b2]">
            {formatarUsd(p.preco)}
            {p.percentual_desconto > 0 ? (
              <span className="ml-1.5 rounded bg-[#00D443]/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#00D443]">
                −{p.percentual_desconto}%
              </span>
            ) : null}
          </p>
        ) : null}
        {p.empresa_id ? (
          <button
            type="button"
            onClick={onVer}
            className="w-full rounded-lg bg-[#0097b2] py-2 text-xs font-bold text-white"
          >
            VER SERVIÇO
          </button>
        ) : null}
      </div>
    </article>
  )
}

export default function FavoritosPage() {
  const router = useRouter()
  const { perfilEhTurista, loading: gateLoading } = useProfissionalGate()
  const [usuarioId, setUsuarioId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [empresas, setEmpresas] = useState<EmpresaFavoritaCard[]>([])
  const [acomodacoes, setAcomodacoes] = useState<AcomodacaoFavoritaCard[]>([])
  const [produtos, setProdutos] = useState<ProdutoFavoritoCard[]>([])
  const [pratos, setPratos] = useState<PratoFavoritoCard[]>([])
  const [servicos, setServicos] = useState<ServicoFavoritoCard[]>([])
  const [tickets, setTickets] = useState<TicketFavoritoCard[]>([])
  const [pastas, setPastas] = useState<Pastas>({
    comprasCde: false,
    lojasBrAr: false,
    gastronomia: false,
    servicosLocais: false,
    tickets: false,
    hospedagem: false,
    empresas: false,
  })
  const [drawerProduto, setDrawerProduto] = useState<DrawerProdutoState>(null)
  const [drawerPrato, setDrawerPrato] = useState<DrawerPratoState>(null)
  const [drawerServico, setDrawerServico] = useState<DrawerServicoState>(null)
  const [drawerTicket, setDrawerTicket] = useState<DrawerTicketState>(null)
  const [drawerAcomodacao, setDrawerAcomodacao] = useState<DrawerAcomodacaoState>(null)

  const toggle = (key: keyof Pastas) => {
    setPastas((p) => ({ ...p, [key]: !p[key] }))
  }

  const { produtosCde, produtosLojasBrAr } = useMemo(() => {
    const cde: ProdutoFavoritoCard[] = []
    const brAr: ProdutoFavoritoCard[] = []
    for (const p of produtos) {
      if (empresaEhSegmentoLojasParaguai(p.empresa_categoria, p.empresa_cidade)) {
        cde.push(p)
      } else if (empresaEhLojasBrasilOuArgentina(p.empresa_categoria, p.empresa_cidade)) {
        brAr.push(p)
      } else {
        // Fallback: sem meta de cidade → pasta CDE (legado)
        cde.push(p)
      }
    }
    return { produtosCde: cde, produtosLojasBrAr: brAr }
  }, [produtos])

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const uid = session?.user?.id ?? null
      setUsuarioId(uid)
      if (!uid) {
        setEmpresas([])
        setAcomodacoes([])
        setProdutos([])
        setPratos([])
        setServicos([])
        setTickets([])
        return
      }
      const [emps, acoms, prods, prts, servs, ticks] = await Promise.all([
        listarEmpresasFavoritas(supabase, uid),
        listarAcomodacoesFavoritas(supabase, uid),
        listarProdutosFavoritos(supabase, uid),
        listarPratosFavoritos(supabase, uid),
        listarServicosFavoritos(supabase, uid),
        listarTicketsFavoritos(supabase, uid),
      ])
      setEmpresas(emps)
      setAcomodacoes(acoms)
      setProdutos(prods)
      setPratos(prts)
      setServicos(servs)
      setTickets(ticks)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  useEffect(() => {
    const onFocus = () => void carregar()
    const onVis = () => {
      if (document.visibilityState === 'visible') void carregar()
    }
    const onFav = () => void carregar()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('favoritos-turista-atualizados', onFav)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('favoritos-turista-atualizados', onFav)
    }
  }, [carregar])

  const abrirProduto = (p: ProdutoFavoritoCard) => {
    if (!p.empresa_id) return
    setDrawerProduto({
      empresaId: p.empresa_id,
      empresaNome: p.empresa_nome || 'Empresa',
      produtoId: p.id,
    })
  }

  const abrirPrato = (p: PratoFavoritoCard) => {
    if (!p.empresa_id) return
    setDrawerPrato({
      empresaId: p.empresa_id,
      empresaNome: p.empresa_nome || 'Empresa',
      pratoId: p.id,
    })
  }

  const abrirServico = (p: ServicoFavoritoCard) => {
    if (!p.empresa_id) return
    setDrawerServico({
      empresaId: p.empresa_id,
      empresaNome: p.empresa_nome || 'Empresa',
      servicoId: p.id,
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-gray-50">
      <header className="shrink-0 border-b border-white/15 bg-[#0097b2] px-4 py-4 pt-safe">
        <h1 className="flex items-center justify-center gap-2 text-lg font-bold tracking-wide text-white">
          <Star className="fill-white text-white" size={22} strokeWidth={2} aria-hidden />
          Meus Favoritos
        </h1>
        <p className="mt-0.5 text-center text-xs font-medium text-white/85">do Guia Turístico</p>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 pb-24">
        {loading || gateLoading ? (
          <p className="py-10 text-center text-sm text-gray-500">Carregando favoritos…</p>
        ) : !usuarioId ? (
          <p className="py-10 text-center text-sm text-gray-500">Faça login para ver seus favoritos.</p>
        ) : !perfilEhTurista ? (
          <p className="py-10 text-center text-sm text-gray-500">
            Favoritos está disponível apenas para o perfil turista.
          </p>
        ) : (
          <>
            <ChevronPasta
              titulo="Compras CDE"
              icone={ShoppingBag}
              corTitulo={COR}
              aberto={pastas.comprasCde}
              onToggle={() => toggle('comprasCde')}
            >
              {produtosCde.length === 0 ? (
                <p className="text-center text-sm text-gray-500">Nenhum produto salvo ainda.</p>
              ) : (
                <CarrosselMinicardsFavoritos>
                  {produtosCde.map((p) => (
                    <CardProdutoFavorito key={p.id} p={p} onVer={() => abrirProduto(p)} />
                  ))}
                </CarrosselMinicardsFavoritos>
              )}
            </ChevronPasta>

            <ChevronPasta
              titulo="Lojas (Brasil e Argentina)"
              icone={Store}
              corTitulo={COR}
              aberto={pastas.lojasBrAr}
              onToggle={() => toggle('lojasBrAr')}
            >
              {produtosLojasBrAr.length === 0 ? (
                <p className="text-center text-sm text-gray-500">
                  Nenhum produto de lojas de Foz ou Puerto salvo ainda.
                </p>
              ) : (
                <CarrosselMinicardsFavoritos>
                  {produtosLojasBrAr.map((p) => (
                    <CardProdutoFavorito key={p.id} p={p} onVer={() => abrirProduto(p)} />
                  ))}
                </CarrosselMinicardsFavoritos>
              )}
            </ChevronPasta>

            <ChevronPasta
              titulo="Gastronomia"
              icone={Utensils}
              corTitulo={COR}
              aberto={pastas.gastronomia}
              onToggle={() => toggle('gastronomia')}
            >
              {pratos.length === 0 ? (
                <p className="text-center text-sm text-gray-500">Nenhum prato salvo ainda.</p>
              ) : (
                <CarrosselMinicardsFavoritos>
                  {pratos.map((p) => (
                    <CardPratoFavorito key={p.id} p={p} onVer={() => abrirPrato(p)} />
                  ))}
                </CarrosselMinicardsFavoritos>
              )}
            </ChevronPasta>

            <ChevronPasta
              titulo="Serviços Locais"
              icone={Wrench}
              corTitulo={COR}
              aberto={pastas.servicosLocais}
              onToggle={() => toggle('servicosLocais')}
            >
              {servicos.length === 0 ? (
                <p className="text-center text-sm text-gray-500">Nenhum serviço salvo ainda.</p>
              ) : (
                <CarrosselMinicardsFavoritos>
                  {servicos.map((p) => (
                    <CardServicoFavorito key={p.id} p={p} onVer={() => abrirServico(p)} />
                  ))}
                </CarrosselMinicardsFavoritos>
              )}
            </ChevronPasta>

            <ChevronPasta
              titulo="Tickets"
              icone={Ticket}
              corTitulo={COR}
              aberto={pastas.tickets}
              onToggle={() => toggle('tickets')}
            >
              {tickets.length === 0 ? (
                <p className="text-center text-sm text-gray-500">Nenhum ticket salvo ainda.</p>
              ) : (
                <CarrosselMinicardsFavoritos>
                  {tickets.map((t) => (
                    <article
                      key={t.id}
                      className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
                    >
                      <p className="px-3 pt-3 text-sm font-semibold text-[#001f3f]">{t.titulo}</p>
                      <div className="mt-2 aspect-[4/3] bg-gray-100">
                        {t.foto_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={t.foto_url} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="space-y-2 p-3">
                        {t.empresa_nome ? (
                          <p className="truncate text-xs text-gray-500">{t.empresa_nome}</p>
                        ) : null}
                        {t.preco_inteira != null ? (
                          <p className="text-sm font-bold text-[#0097b2]">
                            {formatarPrecoTicket(t.preco_inteira)}
                            <span className="font-normal text-gray-500"> / inteira</span>
                          </p>
                        ) : null}
                        {t.preco_meia != null ? (
                          <p className="text-xs font-semibold text-gray-600">
                            Meia: {formatarPrecoTicket(t.preco_meia)}
                          </p>
                        ) : null}
                        {t.empresa_id ? (
                          <button
                            type="button"
                            onClick={() =>
                              setDrawerTicket({
                                empresaId: t.empresa_id!,
                                empresaNome: t.empresa_nome || 'Empresa',
                                ticketId: t.id,
                              })
                            }
                            className="w-full rounded-lg bg-[#0097b2] py-2 text-xs font-bold text-white"
                          >
                            Ver ticket
                          </button>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </CarrosselMinicardsFavoritos>
              )}
            </ChevronPasta>

            <ChevronPasta
              titulo="Hospedagem"
              icone={Hotel}
              corTitulo={COR}
              aberto={pastas.hospedagem}
              onToggle={() => toggle('hospedagem')}
            >
              {acomodacoes.length === 0 ? (
                <p className="text-center text-sm text-gray-500">
                  Nenhuma acomodação salva ainda.
                </p>
              ) : (
                <CarrosselMinicardsFavoritos>
                  {acomodacoes.map((a) => {
                    const sub = rotuloAcomodacaoFavorita(a)
                    return (
                      <article
                        key={a.id}
                        className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
                      >
                        <p className="px-3 pt-3 text-sm font-semibold text-[#001f3f]">
                          {rotuloCategoriaImovelCurto(a.categoria_imovel) || 'Acomodação'}
                        </p>
                        <div className="mt-2 aspect-[4/3] bg-gray-100">
                          {a.foto_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={a.foto_url} alt="" className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <div className="space-y-2 p-3">
                          {sub ? (
                            <p className="text-sm font-semibold text-[#001f3f]">{sub}</p>
                          ) : null}
                          {a.empresa_nome ? (
                            <p className="truncate text-xs text-gray-500">{a.empresa_nome}</p>
                          ) : null}
                          {a.valor_diaria != null ? (
                            <p className="text-sm font-bold text-[#0097b2]">
                              {a.valor_diaria.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                              <span className="font-normal text-gray-500"> / diária</span>
                            </p>
                          ) : null}
                          {a.empresa_id ? (
                            <button
                              type="button"
                              onClick={() =>
                                setDrawerAcomodacao({
                                  empresaId: a.empresa_id,
                                  empresaNome: a.empresa_nome || 'Empresa',
                                  acomodacaoId: a.id,
                                  empresaUsername: a.empresa_username,
                                  empresaFotoUrl: a.empresa_foto_url,
                                  notaMedia: a.empresa_nota,
                                  empresaVerificada: a.empresa_verificada,
                                })
                              }
                              className="w-full rounded-lg bg-[#0097b2] py-2 text-xs font-bold text-white"
                            >
                              VER ACOMODAÇÃO
                            </button>
                          ) : null}
                        </div>
                      </article>
                    )
                  })}
                </CarrosselMinicardsFavoritos>
              )}
            </ChevronPasta>

            <ChevronPasta
              titulo="Páginas de Empresas"
              icone={Building2}
              corTitulo={COR}
              aberto={pastas.empresas}
              onToggle={() => toggle('empresas')}
            >
              {empresas.length === 0 ? (
                <p className="text-center text-sm text-gray-500">Nenhuma página salva ainda.</p>
              ) : (
                <CarrosselMinicardsFavoritos>
                  {empresas.map((e) => {
                    const username = String(e.nome_usuario ?? '')
                      .replace(/^@+/, '')
                      .trim()
                    return (
                      <div
                        key={e.id}
                        className="flex items-center gap-2.5 rounded-xl bg-[#0097b2] p-2.5 shadow-sm"
                      >
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 border-white bg-white/20">
                          {e.foto_url ? (
                            <AvatarImage
                              src={e.foto_url}
                              alt=""
                              fill
                              className="object-cover"
                              sizes="48px"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1 overflow-hidden pr-1">
                          <p className="truncate text-sm font-bold leading-tight text-white">
                            {e.nome_fantasia}
                          </p>
                          {username ? (
                            <p className="mt-0.5 truncate text-xs leading-tight text-white/90">
                              @{username}
                            </p>
                          ) : null}
                          {e.nota_media != null && e.nota_media > 0 ? (
                            <p className="mt-0.5 inline-flex items-center gap-0.5 text-xs font-bold text-amber-300">
                              <span aria-hidden>★</span>
                              {e.nota_media.toFixed(1).replace(/\.0$/, '')}
                            </p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => router.push(`/empresa/${e.id}`)}
                          className="flex h-11 w-[4.5rem] shrink-0 flex-col items-center justify-center rounded-lg bg-white px-1 text-center text-[10px] font-bold leading-tight text-[#0097b2]"
                        >
                          <span>VISITAR</span>
                          <span>PÁGINA</span>
                        </button>
                      </div>
                    )
                  })}
                </CarrosselMinicardsFavoritos>
              )}
            </ChevronPasta>
          </>
        )}
      </main>

      {drawerProduto ? (
        <DrawerProdutosCde
          isOpen
          onClose={() => setDrawerProduto(null)}
          empresaId={drawerProduto.empresaId}
          empresaNome={drawerProduto.empresaNome}
          produtoIdInicial={drawerProduto.produtoId}
          mostrarEmpresaNoDetalhe
        />
      ) : null}

      {drawerPrato ? (
        <DrawerCardapio
          isOpen
          onClose={() => setDrawerPrato(null)}
          empresaId={drawerPrato.empresaId}
          empresaNome={drawerPrato.empresaNome}
          pratoIdInicial={drawerPrato.pratoId}
          mostrarEmpresaNoDetalhe
        />
      ) : null}

      {drawerServico ? (
        <DrawerServicosLocais
          isOpen
          onClose={() => setDrawerServico(null)}
          empresaId={drawerServico.empresaId}
          empresaNome={drawerServico.empresaNome}
          servicoIdInicial={drawerServico.servicoId}
          mostrarEmpresaNoDetalhe
        />
      ) : null}

      {drawerTicket ? (
        <DrawerTicketsAtrativos
          isOpen
          onClose={() => setDrawerTicket(null)}
          empresaId={drawerTicket.empresaId}
          empresaNome={drawerTicket.empresaNome}
          ticketIdInicial={drawerTicket.ticketId}
        />
      ) : null}

      {drawerAcomodacao ? (
        <DrawerReservaHospedagem
          isOpen
          onClose={() => setDrawerAcomodacao(null)}
          empresaId={drawerAcomodacao.empresaId}
          empresaNome={drawerAcomodacao.empresaNome}
          empresaUsername={drawerAcomodacao.empresaUsername}
          empresaFotoUrl={drawerAcomodacao.empresaFotoUrl}
          notaMedia={drawerAcomodacao.notaMedia}
          empresaVerificadaInicial={drawerAcomodacao.empresaVerificada}
          acomodacaoIdInicial={drawerAcomodacao.acomodacaoId}
        />
      ) : null}
    </div>
  )
}
