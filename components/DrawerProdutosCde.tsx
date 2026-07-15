'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MessageCircle,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useModalScrollLock } from '@/lib/useModalScrollLock'
import BotaoEstrelaFavorito from '@/components/favoritos/BotaoEstrelaFavorito'
import BotaoChamarCorrida from '@/components/BotaoChamarCorrida'
import ChevronPasta from '@/app/[locale]/(app-shell)/empresa/components/menu-empresa/hospedagem/ChevronPasta'
import MiniCardProdutoVisitante from '@/components/compras-cde/MiniCardProdutoVisitante'
import { filtrarFavoritoIdsPorUsuario } from '@/lib/favoritosTurista'
import { contaVerificadaDocumentacao } from '@/lib/contaVerificada'
import { openWhatsAppChat, mensagemWhatsappProduto } from '@/lib/whatsapp-empresa'
import {
  formatarBrl,
  formatarUsd,
  mapProdutoRow,
  precoFinalUsd,
  usdParaBrl,
  type ProdutoCdeRow,
} from '@/lib/comprasCdeCatalogo'

const COR = '#0097b2'
const VERDE = '#00D443'

const SELECT_PRODUTOS = `
  id, empresa_id, nome, descricao, preco_usd, percentual_desconto,
  fotos, foto_url, site_url, ativo, categoria_id, subcategoria_id, marca_id,
  palavras_chave, created_at,
  produto_categorias ( id, nome, ordem ),
  produto_subcategorias ( nome ),
  produto_marcas ( nome )
`

type SecaoCategoria = {
  categoriaId: string
  categoriaNome: string
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
  /** No hub Compras CDE, mostra avatar da empresa no detalhe (acima do Ver mais). */
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
  mostrarEmpresaNoDetalhe = false,
  produtoIdInicial = null,
}: Props) {
  useModalScrollLock(isOpen)

  const [passo, setPasso] = useState<1 | 2>(1)
  const [carregando, setCarregando] = useState(true)
  const [secoes, setSecoes] = useState<SecaoCategoria[]>([])
  const [selecionado, setSelecionado] = useState<ProdutoCdeRow | null>(null)
  const [fotoIdx, setFotoIdx] = useState(0)
  const [taxaUsd, setTaxaUsd] = useState(0.2)
  const [whatsappComercial, setWhatsappComercial] = useState<string | null>(null)
  const [empresaVerificada, setEmpresaVerificada] = useState(false)
  const [visitanteId, setVisitanteId] = useState<string | null>(null)
  const [favProdutos, setFavProdutos] = useState<Set<string>>(() => new Set())
  const [infoAberto, setInfoAberto] = useState(false)
  const [verMaisAberto, setVerMaisAberto] = useState(false)

  const reset = useCallback(() => {
    setPasso(1)
    setSelecionado(null)
    setFotoIdx(0)
    setVerMaisAberto(false)
    setInfoAberto(false)
  }, [])

  const handleFechar = useCallback(() => {
    reset()
    onClose()
  }, [onClose, reset])

  const carregar = useCallback(async () => {
    if (!empresaId) return
    setCarregando(true)
    try {
      const [empRes, prodRes, cotRes, sess] = await Promise.all([
        supabase
          .from('empresas')
          .select('whatsapp_comercial, whatsapp, docs_verificado, status, foto_url, nome_usuario')
          .eq('id', empresaId)
          .maybeSingle(),
        supabase
          .from('produtos')
          .select(SELECT_PRODUTOS)
          .eq('empresa_id', empresaId)
          .eq('ativo', true)
          .order('created_at', { ascending: false }),
        supabase.from('cotacoes').select('moeda, valor_brl').eq('moeda', 'USD').maybeSingle(),
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
      setEmpresaVerificada(contaVerificadaDocumentacao('empresa', emp))

      if (cotRes.data?.valor_brl != null) {
        const t = Number(cotRes.data.valor_brl)
        if (t > 0) setTaxaUsd(t)
      }

      const produtos = (prodRes.data ?? []).map((r) => mapProdutoRow(r as Record<string, unknown>))
      const map = new Map<string, SecaoCategoria>()
      for (const p of produtos) {
        const key = p.categoria_id ?? 'outros'
        if (!map.has(key)) {
          map.set(key, {
            categoriaId: key,
            categoriaNome: p.categoria_nome || 'Outros',
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
  }, [empresaId, produtoIdInicial])

  useEffect(() => {
    if (!isOpen) return
    reset()
    void carregar()
  }, [isOpen, carregar, reset])

  const fotos = selecionado?.fotos?.length
    ? selecionado.fotos
    : selecionado?.foto_url
      ? [selecionado.foto_url]
      : []

  const precoFinal = selecionado
    ? precoFinalUsd(selecionado.preco_usd, selecionado.percentual_desconto)
    : 0
  const precoBrl = usdParaBrl(precoFinal, taxaUsd)
  const pct = selecionado ? Number(selecionado.percentual_desconto) || 0 : 0

  const avatarEmpresa = empresaFotoUrl

  const abrirWhatsapp = () => {
    if (!selecionado) return
    const ok = openWhatsAppChat(
      whatsappComercial,
      mensagemWhatsappProduto({
        nomeProduto: selecionado.nome,
        username: empresaUsername,
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
      {passo === 1 ? (
        <header
          className="shrink-0 border-b border-white/15 bg-[#0097b2]"
          style={{ paddingTop: 'max(0.15rem, env(safe-area-inset-top, 0px))' }}
        >
          <div className="relative px-5 pb-3 pt-1.5 pr-3">
            <div className="flex items-start gap-3.5">
              <div className="h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-md border-2 border-white bg-white/20">
                {avatarEmpresa ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarEmpresa} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1 pr-8">
                <p className="truncate text-base font-bold leading-tight text-white">{empresaNome}</p>
                {empresaUsername ? (
                  <p className="inline-flex max-w-full items-center gap-1 truncate text-sm leading-tight text-white/80">
                    {empresaVerificada ? (
                      <BadgeCheck
                        className="h-3.5 w-3.5 shrink-0 text-white"
                        fill="currentColor"
                        stroke="#0097b2"
                        strokeWidth={2}
                        aria-hidden
                      />
                    ) : null}
                    <span className="truncate">@{empresaUsername}</span>
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={handleFechar}
                className="absolute right-1 top-0.5 shrink-0 rounded-lg p-1.5 text-white hover:bg-white/15"
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
          <button
            type="button"
            onClick={() => {
              setPasso(1)
              setSelecionado(null)
              setVerMaisAberto(false)
            }}
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </button>
          <p className="min-w-0 flex-1 truncate text-sm font-bold text-[#001f3f]">
            {selecionado?.nome ?? 'Produto'}
          </p>
          <button
            type="button"
            onClick={handleFechar}
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto" data-modal-scroll-lock-scrollable>
        {carregando ? (
          <p className="py-12 text-center text-sm text-gray-400">Carregando produtos…</p>
        ) : passo === 1 ? (
          <div className="space-y-6 pb-8 pt-4">
            <h2 className="px-4 text-center text-sm font-bold uppercase tracking-wide text-[#001f3f]">
              Escolha o produto
            </h2>
            {totalProdutos === 0 ? (
              <p className="px-4 text-center text-sm text-gray-500">Nenhum produto disponível no momento.</p>
            ) : (
              secoes.map((sec) => (
                <section key={sec.categoriaId} className="space-y-2">
                  <h3 className="px-4 text-left text-sm font-bold text-[#0097b2]">{sec.categoriaNome}</h3>
                  <div className="flex gap-3 overflow-x-auto px-4 pb-1 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {sec.produtos.map((p, idx) => (
                      <div key={p.id} className={idx === 0 ? 'ml-0' : ''}>
                        <MiniCardProdutoVisitante
                          item={p}
                          taxaUsd={taxaUsd}
                          notaMediaEmpresa={notaMedia ?? null}
                          visitanteId={visitanteId}
                          favoritoInicial={favProdutos.has(p.id)}
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
                        />
                      </div>
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        ) : selecionado ? (
          <div className="space-y-4 px-4 py-4 pb-8">
            <p className="text-left text-base font-bold text-[#001f3f]">{selecionado.nome}</p>

            <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-gray-100">
              {fotos[fotoIdx] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fotos[fotoIdx]} alt="" className="h-full w-full object-cover" />
              ) : null}
              {fotos.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => setFotoIdx((i) => (i - 1 + fotos.length) % fotos.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/45 p-2 text-white"
                    aria-label="Foto anterior"
                  >
                    <ChevronLeft className="h-5 w-5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setFotoIdx((i) => (i + 1) % fotos.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/45 p-2 text-white"
                    aria-label="Próxima foto"
                  >
                    <ChevronRight className="h-5 w-5" aria-hidden />
                  </button>
                  <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
                    {fotos.map((_, i) => (
                      <span
                        key={i}
                        className={`h-1.5 w-1.5 rounded-full ${i === fotoIdx ? 'bg-white' : 'bg-white/50'}`}
                      />
                    ))}
                  </div>
                </>
              ) : null}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xl font-bold" style={{ color: VERDE }}>
                  {formatarUsd(precoFinal)}
                </p>
                {pct > 0 ? (
                  <span className="rounded bg-[#00D443]/15 px-2 py-0.5 text-xs font-bold uppercase text-[#00D443]">
                    Em oferta −{pct}%
                  </span>
                ) : null}
              </div>
              {precoBrl > 0 ? (
                <p className="mt-1 text-sm font-medium text-black">
                  <span aria-hidden>🇧🇷 </span>
                  {formatarBrl(precoBrl)}
                  <span className="font-normal text-gray-500"> (cotação do dia)</span>
                </p>
              ) : null}
            </div>

            <dl className="space-y-1.5 text-sm text-gray-700">
              {selecionado.categoria_nome ? (
                <div>
                  <dt className="inline font-semibold text-gray-500">Categoria: </dt>
                  <dd className="inline">{selecionado.categoria_nome}</dd>
                </div>
              ) : null}
              {selecionado.subcategoria_nome ? (
                <div>
                  <dt className="inline font-semibold text-gray-500">Subcategoria: </dt>
                  <dd className="inline">{selecionado.subcategoria_nome}</dd>
                </div>
              ) : null}
              {selecionado.marca_nome ? (
                <div>
                  <dt className="inline font-semibold text-gray-500">Marca: </dt>
                  <dd className="inline">{selecionado.marca_nome}</dd>
                </div>
              ) : null}
            </dl>

            {selecionado.descricao ? (
              <p className="text-sm leading-relaxed text-gray-600">{selecionado.descricao}</p>
            ) : null}

            {mostrarEmpresaNoDetalhe ? (
              <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-[#f5f5f5] p-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-gray-200">
                  {avatarEmpresa ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarEmpresa} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[#001f3f]">{empresaNome}</p>
                  {empresaUsername ? (
                    <p className="truncate text-xs text-gray-500">@{empresaUsername}</p>
                  ) : null}
                </div>
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
                <button
                  type="button"
                  onClick={abrirSite}
                  className="flex flex-col items-center gap-1 text-[#0097b2]"
                  aria-label="Ver no site"
                >
                  <ExternalLink className="h-7 w-7" aria-hidden />
                  <span className="text-[10px] font-semibold text-gray-600">Site</span>
                </button>
                <div className="flex flex-col items-center gap-1">
                  <BotaoEstrelaFavorito
                    usuarioId={visitanteId}
                    alvoId={selecionado.id}
                    tipo="produto"
                    inicial={favProdutos.has(selecionado.id)}
                    size={28}
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
              </div>
            </ChevronPasta>

            <BotaoChamarCorrida variant="empresa" empresaId={empresaId} />
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
    </div>
  )
}
