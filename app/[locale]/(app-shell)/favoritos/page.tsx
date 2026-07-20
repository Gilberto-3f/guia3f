'use client'

import { useCallback, useEffect, useState } from 'react'
import { Building2, Hotel, ShoppingBag, Star, Ticket } from 'lucide-react'
import { useRouter } from '@/i18n/navigation'
import AvatarImage from '@/components/AvatarImage'
import ChevronPasta from '@/app/[locale]/(app-shell)/empresa/components/menu-empresa/hospedagem/ChevronPasta'
import DrawerProdutosCde from '@/components/DrawerProdutosCde'
import DrawerTicketsAtrativos from '@/components/DrawerTicketsAtrativos'
import { supabase } from '@/lib/supabase'
import {
  listarAcomodacoesFavoritas,
  listarEmpresasFavoritas,
  listarProdutosFavoritos,
  listarTicketsFavoritos,
  type AcomodacaoFavoritaCard,
  type EmpresaFavoritaCard,
  type ProdutoFavoritoCard,
  type TicketFavoritoCard,
} from '@/lib/favoritosTurista'
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

type Pastas = {
  compras: boolean
  tickets: boolean
  hospedagem: boolean
  empresas: boolean
}

type DrawerProdutoState = {
  empresaId: string
  empresaNome: string
  produtoId: string
} | null

type DrawerTicketState = {
  empresaId: string
  empresaNome: string
  ticketId: string
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

export default function FavoritosPage() {
  const router = useRouter()
  const { perfilEhTurista, loading: gateLoading } = useProfissionalGate()
  const [usuarioId, setUsuarioId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [empresas, setEmpresas] = useState<EmpresaFavoritaCard[]>([])
  const [acomodacoes, setAcomodacoes] = useState<AcomodacaoFavoritaCard[]>([])
  const [produtos, setProdutos] = useState<ProdutoFavoritoCard[]>([])
  const [tickets, setTickets] = useState<TicketFavoritoCard[]>([])
  const [pastas, setPastas] = useState<Pastas>({
    compras: false,
    tickets: false,
    hospedagem: false,
    empresas: false,
  })
  const [drawerProduto, setDrawerProduto] = useState<DrawerProdutoState>(null)
  const [drawerTicket, setDrawerTicket] = useState<DrawerTicketState>(null)

  const toggle = (key: keyof Pastas) => {
    setPastas((p) => ({ ...p, [key]: !p[key] }))
  }

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
        setTickets([])
        return
      }
      const [emps, acoms, prods, ticks] = await Promise.all([
        listarEmpresasFavoritas(supabase, uid),
        listarAcomodacoesFavoritas(supabase, uid),
        listarProdutosFavoritos(supabase, uid),
        listarTicketsFavoritos(supabase, uid),
      ])
      setEmpresas(emps)
      setAcomodacoes(acoms)
      setProdutos(prods)
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

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-gray-50">
      <header className="shrink-0 border-b border-white/15 bg-[#0097b2] px-4 py-4 pt-safe">
        <h1 className="flex items-center justify-center gap-2 text-lg font-bold tracking-wide text-white">
          <Star className="fill-white text-white" size={22} strokeWidth={2} aria-hidden />
          Meus Favoritos
        </h1>
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
              aberto={pastas.compras}
              onToggle={() => toggle('compras')}
            >
              {produtos.length === 0 ? (
                <p className="text-center text-sm text-gray-500">Nenhum produto salvo ainda.</p>
              ) : (
                <ul className="space-y-3">
                  {produtos.map((p) => (
                    <li
                      key={p.id}
                      className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
                    >
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
                            onClick={() =>
                              setDrawerProduto({
                                empresaId: p.empresa_id!,
                                empresaNome: p.empresa_nome || 'Empresa',
                                produtoId: p.id,
                              })
                            }
                            className="w-full rounded-lg bg-[#0097b2] py-2 text-xs font-bold text-white"
                          >
                            Ver produto
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
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
                <ul className="space-y-3">
                  {tickets.map((t) => (
                    <li
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
                    </li>
                  ))}
                </ul>
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
                <ul className="space-y-3">
                  {acomodacoes.map((a) => {
                    const sub = rotuloAcomodacaoFavorita(a)
                    return (
                      <li
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
                              onClick={() => router.push(`/empresa/${a.empresa_id}`)}
                              className="w-full rounded-lg bg-[#0097b2] py-2 text-xs font-bold text-white"
                            >
                              Ver empresa
                            </button>
                          ) : null}
                        </div>
                      </li>
                    )
                  })}
                </ul>
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
                <ul className="space-y-2">
                  {empresas.map((e) => {
                    const username = String(e.nome_usuario ?? '')
                      .replace(/^@+/, '')
                      .trim()
                    return (
                      <li key={e.id}>
                        <div className="flex items-center gap-2.5 rounded-xl bg-[#0097b2] p-2.5 shadow-sm">
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
                      </li>
                    )
                  })}
                </ul>
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

      {drawerTicket ? (
        <DrawerTicketsAtrativos
          isOpen
          onClose={() => setDrawerTicket(null)}
          empresaId={drawerTicket.empresaId}
          empresaNome={drawerTicket.empresaNome}
          ticketIdInicial={drawerTicket.ticketId}
        />
      ) : null}
    </div>
  )
}
