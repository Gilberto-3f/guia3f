'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MessageCircle,
  X,
} from 'lucide-react'
import { useRouter } from '@/i18n/navigation'
import { supabase } from '@/lib/supabase'
import { useModalScrollLock } from '@/lib/useModalScrollLock'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import BotaoEstrelaFavorito from '@/components/favoritos/BotaoEstrelaFavorito'
import BotaoChamarCorrida from '@/components/BotaoChamarCorrida'
import PopupRecomendarProduto from '@/components/compras-cde/PopupRecomendarProduto'
import ChevronPasta from '@/app/[locale]/(app-shell)/empresa/components/menu-empresa/hospedagem/ChevronPasta'
import MiniCardProdutoVisitante from '@/components/compras-cde/MiniCardProdutoVisitante'
import PrecoProdutoCde from '@/components/compras-cde/PrecoProdutoCde'
import { filtrarFavoritoIdsPorUsuario } from '@/lib/favoritosTurista'
import { contaVerificadaDocumentacao } from '@/lib/contaVerificada'
import { openWhatsAppChat, mensagemWhatsappProduto } from '@/lib/whatsapp-empresa'
import {
  registrarIntencaoCde,
  carregarCotacoesMap,
  converterMoedas,
  type CotacaoMap,
} from '@/lib/comprasCdeHub'
import { normalizarMoedaPadrao, type MoedaPadraoLoja } from '@/lib/comprasCdeMoedaPadrao'
import { iconeCategoriaProduto } from '@/lib/comprasCdeCategoriaIcone'
import {
  mapProdutoRow,
  precoFinalUsd,
  type ProdutoCdeRow,
} from '@/lib/comprasCdeCatalogo'

const COR = '#0097b2'

const SELECT_PRODUTOS = `
  id, empresa_id, nome, descricao, preco_usd, percentual_desconto,
  fotos, foto_url, site_url, ativo, categoria_id, subcategoria_id, marca_id,
  palavras_chave, created_at,
  produto_categorias ( id, nome, ordem, slug ),
  produto_subcategorias ( nome ),
  produto_marcas ( nome )
`

type SecaoCategoria = {
  categoriaId: string
  categoriaNome: string
  categoriaSlug: string | null
  ordem: number
  produtos: ProdutoCdeRow[]
}

type Props = {
  isOpen: boolean
  onClose: () => void
  empresaId: string
  empresaNome: string
  empresaUsername?: string | null
  empresaFotoUrl?: string | null
  notaMedia?: number | null
  /** Se já conhecido pelo card/página — evita flash do check no cabeçalho. */
  empresaVerificada?: boolean | null
  /** Comparador / hub / favoritos: mostra card azul da empresa no detalhe. Catálogo (botão dinâmico) não precisa — já tem cabeçalho. */
  mostrarEmpresaNoDetalhe?: boolean
  /** Abrir já no detalhe deste produto. */
  produtoIdInicial?: string | null
}

export default function DrawerProdutosCde({
  isOpen,
  onClose,
  empresaId,
  empresaNome,
  empresaUsername = null,
  empresaFotoUrl = null,
  notaMedia = null,
  empresaVerificada: empresaVerificadaProp = null,
  mostrarEmpresaNoDetalhe = false,
  produtoIdInicial = null,
}: Props) {
  useModalScrollLock(isOpen)
  const router = useRouter()
  const { perfilEhProfissional, perfilEhEmpresa } = useProfissionalGate()

  const [passo, setPasso] = useState<1 | 2>(() => (produtoIdInicial ? 2 : 1))
  const [carregando, setCarregando] = useState(true)
  const [secoes, setSecoes] = useState<SecaoCategoria[]>([])
  const [selecionado, setSelecionado] = useState<ProdutoCdeRow | null>(null)
  const [fotoIdx, setFotoIdx] = useState(0)
  const touchFotoX = useRef<number | null>(null)
  const [taxaUsd, setTaxaUsd] = useState(0.2)
  const [cotacoes, setCotacoes] = useState<CotacaoMap>({
    USD: 0.2,
    EUR: 0.18,
    ARS: 180,
    PYG: 1500,
  })
  const [whatsappComercial, setWhatsappComercial] = useState<string | null>(null)
  const [empresaVerificada, setEmpresaVerificada] = useState(() =>
    empresaVerificadaProp != null ? Boolean(empresaVerificadaProp) : false,
  )
  const [visitanteId, setVisitanteId] = useState<string | null>(null)
  const [favProdutos, setFavProdutos] = useState<Set<string>>(() => new Set())
  const [infoAberto, setInfoAberto] = useState(false)
  const [verMaisAberto, setVerMaisAberto] = useState(false)
  const [recomendarAberto, setRecomendarAberto] = useState(false)
  const [notaEmpresaLive, setNotaEmpresaLive] = useState<number | null>(null)
  const [fotoEmpresaLive, setFotoEmpresaLive] = useState<string | null>(null)
  const [usernameEmpresaLive, setUsernameEmpresaLive] = useState<string | null>(null)
  const [moedaPadrao, setMoedaPadrao] = useState<MoedaPadraoLoja>('USD')
  /** Hub Compras CDE abre direto no detalhe — evita flash do cabeçalho do catálogo. */
  const abrirDiretoNoDetalhe = Boolean(produtoIdInicial)
  /** Evita duplicar visita na mesma abertura do detalhe; libera ao voltar ao catálogo. */
  const visitaDetalheRegistradaRef = useRef<string | null>(null)

  const reset = useCallback(() => {
    setPasso(abrirDiretoNoDetalhe ? 2 : 1)
    setSelecionado(null)
    setFotoIdx(0)
    setVerMaisAberto(false)
    setInfoAberto(false)
    setRecomendarAberto(false)
    setNotaEmpresaLive(null)
    setFotoEmpresaLive(null)
    setUsernameEmpresaLive(null)
  }, [abrirDiretoNoDetalhe])

  const handleFechar = useCallback(() => {
    reset()
    onClose()
  }, [onClose, reset])

  const carregar = useCallback(async () => {
    if (!empresaId) return
    setCarregando(true)
    try {
      const [empRes, prodRes, cotMap, sess] = await Promise.all([
        supabase
          .from('empresas')
          .select(
            'whatsapp_comercial, whatsapp, docs_verificado, status, foto_url, nome_usuario, nota_media, moeda_padrao',
          )
          .eq('id', empresaId)
          .maybeSingle(),
        supabase
          .from('produtos')
          .select(SELECT_PRODUTOS)
          .eq('empresa_id', empresaId)
          .eq('ativo', true)
          .order('created_at', { ascending: false }),
        carregarCotacoesMap(supabase),
        supabase.auth.getSession(),
      ])

      const emp = empRes.data as Record<string, unknown> | null
      const waCom =
        emp?.whatsapp_comercial != null && String(emp.whatsapp_comercial).trim()
          ? String(emp.whatsapp_comercial)
          : emp?.whatsapp != null
            ? String(emp.whatsapp)
            : null
      setWhatsappComercial(waCom)
      setEmpresaVerificada(() => {
        if (empresaVerificadaProp != null) return Boolean(empresaVerificadaProp)
        return contaVerificadaDocumentacao('empresa', emp)
      })
      const notaRaw = emp?.nota_media != null ? Number(emp.nota_media) : NaN
      setNotaEmpresaLive(Number.isFinite(notaRaw) && notaRaw > 0 ? notaRaw : null)
      const fotoEmp =
        emp?.foto_url != null && String(emp.foto_url).trim() !== '' ? String(emp.foto_url) : null
      setFotoEmpresaLive(fotoEmp)
      const userEmp =
        emp?.nome_usuario != null && String(emp.nome_usuario).trim() !== ''
          ? String(emp.nome_usuario).replace(/^@+/, '').trim()
          : null
      setUsernameEmpresaLive(userEmp || null)
      setMoedaPadrao(normalizarMoedaPadrao(emp?.moeda_padrao))

      setCotacoes(cotMap)
      if (cotMap.USD > 0) setTaxaUsd(cotMap.USD)

      const produtos = (prodRes.data ?? []).map((r) => mapProdutoRow(r as Record<string, unknown>))
      const map = new Map<string, SecaoCategoria>()
      for (const p of produtos) {
        const key = p.categoria_id ?? 'outros'
        if (!map.has(key)) {
          map.set(key, {
            categoriaId: key,
            categoriaNome: p.categoria_nome || 'Outros',
            categoriaSlug: p.categoria_slug ?? null,
            ordem: p.categoria_ordem ?? 999,
            produtos: [],
          })
        }
        map.get(key)!.produtos.push(p)
      }
      const listaSecoes = [...map.values()].sort(
        (a, b) => a.ordem - b.ordem || a.categoriaNome.localeCompare(b.categoriaNome),
      )
      setSecoes(listaSecoes)

      const uid = sess.data.session?.user?.id ?? null
      setVisitanteId(uid)
      if (uid && produtos.length) {
        const favs = await filtrarFavoritoIdsPorUsuario(
          supabase,
          uid,
          'produto',
          produtos.map((p) => p.id),
        )
        setFavProdutos(favs)
      } else {
        setFavProdutos(new Set())
      }

      if (produtoIdInicial) {
        const found = produtos.find((p) => p.id === produtoIdInicial)
        if (found) {
          setSelecionado(found)
          setFotoIdx(0)
          setPasso(2)
        }
      }
    } catch (e) {
      console.error('[DrawerProdutosCde]', e)
      setSecoes([])
    } finally {
      setCarregando(false)
    }
  }, [empresaId, produtoIdInicial, empresaVerificadaProp])

  useEffect(() => {
    if (!isOpen) return
    if (empresaVerificadaProp != null) setEmpresaVerificada(Boolean(empresaVerificadaProp))
    reset()
    void carregar()
  }, [isOpen, carregar, reset, empresaVerificadaProp])

  useEffect(() => {
    if (!isOpen) visitaDetalheRegistradaRef.current = null
  }, [isOpen])

  useEffect(() => {
    if (passo === 1) visitaDetalheRegistradaRef.current = null
  }, [passo])

  useEffect(() => {
    if (!isOpen || passo !== 2 || !selecionado || carregando) return
    if (visitaDetalheRegistradaRef.current === selecionado.id) return
    visitaDetalheRegistradaRef.current = selecionado.id
    void registrarIntencaoCde(supabase, {
      tipo: 'clique',
      termo: selecionado.nome,
      produtoId: selecionado.id,
      categoriaId: selecionado.categoria_id,
      subcategoriaId: selecionado.subcategoria_id,
      marcaId: selecionado.marca_id,
    })
  }, [isOpen, passo, selecionado, carregando])

  const fotos = selecionado?.fotos?.length
    ? selecionado.fotos
    : selecionado?.foto_url
      ? [selecionado.foto_url]
      : []

  const precoFinal = selecionado
    ? precoFinalUsd(selecionado.preco_usd, selecionado.percentual_desconto)
    : 0
  const precoBrl = precoFinal > 0 ? converterMoedas(precoFinal, 'USD', 'BRL', cotacoes) : 0
  const pct = selecionado ? Number(selecionado.percentual_desconto) || 0 : 0

  const avatarEmpresa = empresaFotoUrl || fotoEmpresaLive
  const usernameExibir = (() => {
    const fromProp =
      empresaUsername != null && String(empresaUsername).trim() !== ''
        ? String(empresaUsername).replace(/^@+/, '').trim()
        : ''
    return fromProp || usernameEmpresaLive || null
  })()
  const notaEmpresaExibir =
    notaEmpresaLive != null && notaEmpresaLive > 0
      ? notaEmpresaLive
      : notaMedia != null && Number(notaMedia) > 0
        ? Number(notaMedia)
        : null
  const notaEmpresaTexto =
    notaEmpresaExibir != null ? notaEmpresaExibir.toFixed(1).replace(/\.0$/, '') : null

  const abrirWhatsapp = () => {
    if (!selecionado) return
    const origin =
      typeof window !== 'undefined' ? window.location.origin : ''
    const produtoUrl = origin
      ? `${origin}/compras-cde/produto/${selecionado.id}?ref=whatsapp`
      : `/compras-cde/produto/${selecionado.id}?ref=whatsapp`
    const ok = openWhatsAppChat(
      whatsappComercial,
      mensagemWhatsappProduto({
        nomeProduto: selecionado.nome,
        username: usernameExibir,
        produtoUrl,
      }),
    )
    if (!ok) window.alert('WhatsApp comercial da loja não configurado.')
  }

  const abrirSite = () => {
    const url = selecionado?.site_url?.trim()
    if (!url) {
      window.alert('Link do site não cadastrado para este produto.')
      return
    }
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`
    window.open(href, '_blank', 'noopener,noreferrer')
  }

  const totalProdutos = useMemo(
    () => secoes.reduce((acc, s) => acc + s.produtos.length, 0),
    [secoes],
  )

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[140] flex flex-col bg-white"
      role="dialog"
      aria-modal="true"
      aria-label="Catálogo de produtos"
    >
      {passo === 1 && !abrirDiretoNoDetalhe ? (
        <header
          className="shrink-0 border-b border-white/15 bg-[#0097b2]"
          style={{ paddingTop: 'max(0.1rem, env(safe-area-inset-top, 0px))' }}
        >
          <div className="relative px-4 pb-2 pt-1 pr-2">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-white/80 bg-white/20">
                {avatarEmpresa ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarEmpresa} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 pr-7">
                <p className="truncate text-sm font-bold leading-tight text-white">{empresaNome}</p>
                {usernameExibir ? (
                  <p className="flex max-w-full items-center gap-1 truncate text-xs leading-tight text-white/85">
                    <span className="inline-flex h-3 w-3 shrink-0 items-center justify-center" aria-hidden>
                      <BadgeCheck
                        className={`h-3 w-3 text-white ${empresaVerificada ? 'visible' : 'invisible'}`}
                        fill="currentColor"
                        stroke="#0097b2"
                        strokeWidth={2}
                      />
                    </span>
                    <span className="truncate">@{usernameExibir}</span>
                  </p>
                ) : null}
                {notaEmpresaTexto ? (
                  <p className="flex items-center gap-0.5 text-xs font-bold leading-tight text-amber-300">
                    <span aria-hidden>★</span>
                    {notaEmpresaTexto}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={handleFechar}
                className="absolute right-0.5 top-0 shrink-0 rounded-lg p-1.5 text-white hover:bg-white/15"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
          </div>
        </header>
      ) : (
        <header
          className="flex shrink-0 items-center gap-2 border-b border-gray-100 bg-white px-3 pb-2"
          style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top, 0px))' }}
        >
          <p className="min-w-0 flex-1 truncate text-sm font-bold text-[#001f3f]">
            {selecionado?.categoria_nome || (carregando ? '…' : 'Produto')}
          </p>
          <button
            type="button"
            onClick={() => {
              if (abrirDiretoNoDetalhe) {
                handleFechar()
                return
              }
              setPasso(1)
              setSelecionado(null)
              setVerMaisAberto(false)
            }}
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
            aria-label={abrirDiretoNoDetalhe ? 'Fechar' : 'Voltar'}
          >
            <ArrowRight className="h-5 w-5" aria-hidden />
          </button>
        </header>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto" data-modal-scroll-lock-scrollable>
        {carregando ? (
          <p className="py-12 text-center text-sm text-gray-400">Carregando produtos…</p>
        ) : passo === 1 && !abrirDiretoNoDetalhe ? (
          <div className="space-y-5 pb-8 pt-3">
            {totalProdutos === 0 ? (
              <p className="px-4 text-center text-sm text-gray-500">Nenhum produto disponível no momento.</p>
            ) : (
              secoes.map((sec) => {
                const IconeCat = iconeCategoriaProduto(sec.categoriaSlug || sec.categoriaNome)
                return (
                  <section key={sec.categoriaId} className="space-y-2">
                    <h3 className="flex items-center justify-center gap-2 px-4 text-center text-sm font-bold text-[#0097b2]">
                      <IconeCat className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
                      {sec.categoriaNome} • {sec.produtos.length}
                    </h3>
                    <div className="flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      <div className="w-[11%] shrink-0 snap-none" aria-hidden />
                      {sec.produtos.map((p) => (
                        <MiniCardProdutoVisitante
                          key={p.id}
                          item={p}
                          taxaUsd={taxaUsd}
                          cotacoes={cotacoes}
                          moedaPadrao={moedaPadrao}
                          notaMediaEmpresa={null}
                          visitanteId={visitanteId}
                          favoritoInicial={favProdutos.has(p.id)}
                          tamanhoUniforme
                          className="box-border w-[78%] max-w-[280px] shrink-0 snap-center"
                          onFavoritoChange={(salvo) => {
                            setFavProdutos((prev) => {
                              const next = new Set(prev)
                              if (salvo) next.add(p.id)
                              else next.delete(p.id)
                              return next
                            })
                          }}
                        onInfo={() => setInfoAberto(true)}
                        onVerProduto={() => {
                          setSelecionado(p)
                          setFotoIdx(0)
                          setVerMaisAberto(false)
                          setPasso(2)
                        }}
                        onImpressao={() => {
                          void registrarIntencaoCde(supabase, {
                            tipo: 'impressao',
                            termo: p.nome,
                            produtoId: p.id,
                            categoriaId: p.categoria_id,
                            subcategoriaId: p.subcategoria_id,
                            marcaId: p.marca_id,
                          })
                        }}
                      />
                      ))}
                      <div className="w-[11%] shrink-0 snap-none" aria-hidden />
                    </div>
                  </section>
                )
              })
            )}
          </div>
        ) : selecionado ? (
          <div className="space-y-4 pb-8 pt-3">
            <p className="px-4 text-left text-base font-bold text-[#001f3f]">{selecionado.nome}</p>

            <div className="relative px-6">
              <div
                className="aspect-[16/10] w-full touch-pan-y overflow-hidden rounded-xl bg-gray-100"
                onTouchStart={(e) => {
                  touchFotoX.current = e.touches[0]?.clientX ?? null
                }}
                onTouchEnd={(e) => {
                  const start = touchFotoX.current
                  touchFotoX.current = null
                  if (start == null || fotos.length <= 1) return
                  const end = e.changedTouches[0]?.clientX
                  if (end == null) return
                  const dx = end - start
                  if (Math.abs(dx) < 40) return
                  if (dx < 0) {
                    setFotoIdx((i) => (i + 1) % fotos.length)
                  } else {
                    setFotoIdx((i) => (i - 1 + fotos.length) % fotos.length)
                  }
                }}
              >
                {fotos[fotoIdx] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={fotos[fotoIdx]}
                    alt=""
                    className="pointer-events-none h-full w-full object-cover"
                    draggable={false}
                  />
                ) : null}
              </div>
              {fotos.length > 1 ? (
                <>
                  <button
                    type="button"
                    className="absolute left-0 top-1/2 z-10 flex w-6 -translate-y-1/2 items-center justify-center"
                    style={{ color: COR }}
                    onClick={() => setFotoIdx((i) => (i - 1 + fotos.length) % fotos.length)}
                    aria-label="Foto anterior"
                  >
                    <ChevronLeft className="h-6 w-6" strokeWidth={2.5} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="absolute right-0 top-1/2 z-10 flex w-6 -translate-y-1/2 items-center justify-center"
                    style={{ color: COR }}
                    onClick={() => setFotoIdx((i) => (i + 1) % fotos.length)}
                    aria-label="Próxima foto"
                  >
                    <ChevronRight className="h-6 w-6" strokeWidth={2.5} aria-hidden />
                  </button>
                </>
              ) : null}
            </div>

            <div className="space-y-4 px-4">
            <div>
              <PrecoProdutoCde
                precoUsd={precoFinal}
                precoUsdCheio={pct > 0 ? selecionado.preco_usd : null}
                cotacoes={cotacoes}
                moedaPadrao={moedaPadrao}
                variante="detalhe"
              />
              {pct > 0 ? (
                <p className="mt-1 text-xs font-bold uppercase text-[#00D443]">Em oferta −{pct}%</p>
              ) : null}
            </div>

            <dl className="space-y-1.5 text-sm text-gray-700">
              {selecionado.marca_nome ? (
                <div>
                  <dt className="inline font-semibold text-gray-500">Marca: </dt>
                  <dd className="inline text-gray-900">{selecionado.marca_nome}</dd>
                </div>
              ) : null}
              {selecionado.subcategoria_nome ? (
                <div>
                  <dt className="inline font-semibold text-gray-500">Subcategoria: </dt>
                  <dd className="inline text-gray-900">{selecionado.subcategoria_nome}</dd>
                </div>
              ) : null}
            </dl>

            {selecionado.descricao ? (
              <div>
                <p className="text-sm font-semibold text-gray-500">Descrição</p>
                <p className="mt-1 text-sm leading-relaxed text-gray-600">{selecionado.descricao}</p>
              </div>
            ) : null}

            <ChevronPasta
              titulo="VER MAIS"
              aberto={verMaisAberto}
              onToggle={() => setVerMaisAberto((v) => !v)}
              corTitulo={COR}
            >
              <div className="flex items-center justify-around gap-2 py-1">
                <button
                  type="button"
                  onClick={abrirWhatsapp}
                  className="flex flex-col items-center gap-1 text-[#25D366]"
                  aria-label="WhatsApp"
                >
                  <MessageCircle className="h-7 w-7" aria-hidden />
                  <span className="text-[10px] font-semibold text-gray-600">WhatsApp</span>
                </button>
                {selecionado.site_url?.trim() ? (
                  <button
                    type="button"
                    onClick={abrirSite}
                    className="flex flex-col items-center gap-1 text-[#0097b2]"
                    aria-label="Ver no site"
                  >
                    <ExternalLink className="h-7 w-7" aria-hidden />
                    <span className="text-[10px] font-semibold text-gray-600">Site</span>
                  </button>
                ) : null}
                {!perfilEhEmpresa ? (
                  <div className="flex flex-col items-center gap-1">
                    <BotaoEstrelaFavorito
                      usuarioId={visitanteId}
                      alvoId={selecionado.id}
                      tipo="produto"
                      inicial={favProdutos.has(selecionado.id)}
                      size={28}
                      className="!opacity-100"
                      onChange={(salvo) => {
                        setFavProdutos((prev) => {
                          const next = new Set(prev)
                          if (salvo) next.add(selecionado.id)
                          else next.delete(selecionado.id)
                          return next
                        })
                      }}
                    />
                    <span className="text-[10px] font-semibold text-gray-600">Favorito</span>
                  </div>
                ) : null}
              </div>
            </ChevronPasta>

            {mostrarEmpresaNoDetalhe ? (
              <div className="flex items-center gap-3 rounded-xl bg-[#0097b2] p-3 shadow-sm">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border-2 border-white/40 bg-white/20">
                  {avatarEmpresa ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarEmpresa} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1 overflow-hidden pr-1">
                  <p className="truncate text-sm font-bold text-white">{empresaNome}</p>
                  {usernameExibir ? (
                    <p className="mt-0.5 flex max-w-full items-center gap-1 truncate text-xs text-white/90">
                      <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center" aria-hidden>
                        <BadgeCheck
                          className={`h-3.5 w-3.5 text-white ${empresaVerificada ? 'visible' : 'invisible'}`}
                          fill="currentColor"
                          stroke="#0097b2"
                          strokeWidth={2}
                        />
                      </span>
                      <span className="truncate">@{usernameExibir}</span>
                    </p>
                  ) : null}
                  {notaEmpresaTexto ? (
                    <p className="mt-0.5 flex items-center gap-0.5 text-xs font-bold text-amber-300">
                      <span aria-hidden>★</span>
                      {notaEmpresaTexto}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleFechar()
                    router.push(`/empresa/${empresaId}`)
                  }}
                  className="flex h-11 w-[4.5rem] shrink-0 flex-col items-center justify-center rounded-lg bg-white px-1 text-center text-[10px] font-bold leading-tight text-[#0097b2]"
                >
                  <span>VISITAR</span>
                  <span>PÁGINA</span>
                </button>
              </div>
            ) : null}

            {perfilEhProfissional ? (
              <button
                type="button"
                onClick={() => setRecomendarAberto(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#00D443] py-3 text-base font-bold text-white shadow-sm transition-opacity hover:opacity-95"
              >
                <MessageCircle size={20} className="text-white" aria-hidden />
                RECOMENDAR
              </button>
            ) : (
              <BotaoChamarCorrida variant="empresa" empresaId={empresaId} />
            )}
            </div>
          </div>
        ) : null}
      </div>

      {infoAberto ? (
        <div
          className="fixed inset-0 z-[160] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setInfoAberto(false)
          }}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-2xl"
            role="dialog"
            aria-labelledby="info-produtos-titulo"
          >
            <h3 id="info-produtos-titulo" className="text-base font-bold text-[#001f3f]">
              ATENÇÃO
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              Ofertas, valores e disponibilidade estão sujeitos a mudanças sem aviso prévio.
            </p>
            <button
              type="button"
              onClick={() => setInfoAberto(false)}
              className="mt-4 w-full rounded-xl py-2.5 text-sm font-bold text-white"
              style={{ backgroundColor: COR }}
            >
              Entendi
            </button>
          </div>
        </div>
      ) : null}

      {selecionado ? (
        <PopupRecomendarProduto
          aberto={recomendarAberto}
          onFechar={() => setRecomendarAberto(false)}
          produto={{
            id: selecionado.id,
            nome: selecionado.nome,
            precoUsd: precoFinal,
            precoBrl: precoBrl > 0 ? precoBrl : null,
            empresaId,
            empresaNome,
            empresaUsername: usernameExibir,
            categoriaId: selecionado.categoria_id,
            subcategoriaId: selecionado.subcategoria_id,
            marcaId: selecionado.marca_id,
          }}
        />
      ) : null}
    </div>
  )
}
