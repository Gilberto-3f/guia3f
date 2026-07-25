'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, BadgeCheck, ChevronLeft, ChevronRight, ExternalLink, Eye, MessageCircle, X } from 'lucide-react'
import { useRouter } from '@/i18n/navigation'
import { supabase } from '@/lib/supabase'
import { useModalScrollLock } from '@/lib/useModalScrollLock'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import { contaVerificadaDocumentacao } from '@/lib/contaVerificada'
import { carregarCotacoesMap, converterMoedas, type CotacaoMap } from '@/lib/comprasCdeHub'
import { normalizarMoedaPadrao, type MoedaPadraoLoja } from '@/lib/comprasCdeMoedaPadrao'
import PrecoProdutoCde from '@/components/compras-cde/PrecoProdutoCde'
import BotaoEstrelaFavorito from '@/components/favoritos/BotaoEstrelaFavorito'
import BotaoChamarCorrida from '@/components/BotaoChamarCorrida'
import ChevronPasta from '@/app/[locale]/(app-shell)/empresa/components/menu-empresa/hospedagem/ChevronPasta'
import PopupRecomendarPrato from '@/components/gastronomia/PopupRecomendarPrato'
import { filtrarFavoritoIdsPorUsuario } from '@/lib/favoritosTurista'
import { mapPratoRow, precoFinalUsd, SELECT_PRATO, type PratoCardapioRow } from '@/lib/cardapioCatalogo'
import { openWhatsAppChat, mensagemWhatsappPrato } from '@/lib/whatsapp-empresa'

const COR = '#0097b2'
const VERDE = '#00D443'

type SecaoCategoria = {
  categoriaId: string
  categoriaNome: string
  pratos: PratoCardapioRow[]
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
  /** Abrir já no detalhe deste prato. */
  pratoIdInicial?: string | null
  /** Mostra card azul da empresa no detalhe (ex.: hub/favoritos). Catálogo (botão dinâmico) já tem cabeçalho. */
  mostrarEmpresaNoDetalhe?: boolean
}

export default function DrawerCardapio({
  isOpen,
  onClose,
  empresaId,
  empresaNome,
  empresaUsername = null,
  empresaFotoUrl = null,
  notaMedia = null,
  empresaVerificada: empresaVerificadaProp = null,
  pratoIdInicial = null,
  mostrarEmpresaNoDetalhe = false,
}: Props) {
  useModalScrollLock(isOpen)
  const router = useRouter()
  const { perfilEhProfissional, perfilEhEmpresa } = useProfissionalGate()

  const [passo, setPasso] = useState<1 | 2>(() => (pratoIdInicial ? 2 : 1))
  const [carregando, setCarregando] = useState(true)
  const [secoes, setSecoes] = useState<SecaoCategoria[]>([])
  const [selecionado, setSelecionado] = useState<PratoCardapioRow | null>(null)
  const [fotoIdx, setFotoIdx] = useState(0)
  const [cotacoes, setCotacoes] = useState<CotacaoMap>({ USD: 0.2, EUR: 0.18, ARS: 180, PYG: 1500 })
  const [empresaVerificada, setEmpresaVerificada] = useState(() =>
    empresaVerificadaProp != null ? Boolean(empresaVerificadaProp) : false,
  )
  const [notaEmpresaLive, setNotaEmpresaLive] = useState<number | null>(null)
  const [fotoEmpresaLive, setFotoEmpresaLive] = useState<string | null>(null)
  const [usernameEmpresaLive, setUsernameEmpresaLive] = useState<string | null>(null)
  const [whatsappComercial, setWhatsappComercial] = useState<string | null>(null)
  const [moedaPadrao, setMoedaPadrao] = useState<MoedaPadraoLoja>('USD')
  const [visitanteId, setVisitanteId] = useState<string | null>(null)
  const [favPratos, setFavPratos] = useState<Set<string>>(() => new Set())
  const [recomendarAberto, setRecomendarAberto] = useState(false)
  const [verMaisAberto, setVerMaisAberto] = useState(false)

  /** Hub/favoritos abrem direto no detalhe — evita flash do cabeçalho da lista. */
  const abrirDiretoNoDetalhe = Boolean(pratoIdInicial)

  const reset = useCallback(() => {
    setPasso(abrirDiretoNoDetalhe ? 2 : 1)
    setSelecionado(null)
    setFotoIdx(0)
    setNotaEmpresaLive(null)
    setFotoEmpresaLive(null)
    setUsernameEmpresaLive(null)
    setWhatsappComercial(null)
    setRecomendarAberto(false)
    setVerMaisAberto(false)
  }, [abrirDiretoNoDetalhe])

  const handleFechar = useCallback(() => {
    reset()
    onClose()
  }, [onClose, reset])

  const carregar = useCallback(async () => {
    if (!empresaId) return
    setCarregando(true)
    try {
      const [empRes, pratosRes, cotMap, sess] = await Promise.all([
        supabase
          .from('empresas')
          .select(
            'whatsapp_comercial, whatsapp, docs_verificado, status, foto_url, nome_usuario, nota_media, moeda_padrao',
          )
          .eq('id', empresaId)
          .maybeSingle(),
        supabase
          .from('cardapio_pratos')
          .select(SELECT_PRATO)
          .eq('empresa_id', empresaId)
          .eq('ativo', true)
          .order('created_at', { ascending: false }),
        carregarCotacoesMap(supabase),
        supabase.auth.getSession(),
      ])

      const emp = empRes.data as Record<string, unknown> | null
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
      const wa =
        emp?.whatsapp_comercial != null && String(emp.whatsapp_comercial).trim()
          ? String(emp.whatsapp_comercial)
          : emp?.whatsapp != null
            ? String(emp.whatsapp)
            : null
      setWhatsappComercial(wa)
      setMoedaPadrao(normalizarMoedaPadrao(emp?.moeda_padrao))

      setCotacoes(cotMap)

      const pratos = (pratosRes.data ?? []).map((r) => mapPratoRow(r as Record<string, unknown>))
      const map = new Map<string, SecaoCategoria>()
      for (const p of pratos) {
        const key = p.categoria_id ?? 'outros'
        if (!map.has(key)) {
          map.set(key, {
            categoriaId: key,
            categoriaNome: p.categoria_nome || 'Outros',
            pratos: [],
          })
        }
        map.get(key)!.pratos.push(p)
      }
      const listaSecoes = [...map.values()].sort((a, b) => a.categoriaNome.localeCompare(b.categoriaNome))
      setSecoes(listaSecoes)

      const uid = sess.data.session?.user?.id ?? null
      setVisitanteId(uid)
      if (uid && pratos.length) {
        const favs = await filtrarFavoritoIdsPorUsuario(
          supabase,
          uid,
          'prato',
          pratos.map((p) => p.id),
        )
        setFavPratos(favs)
      } else {
        setFavPratos(new Set())
      }

      if (pratoIdInicial) {
        const found = pratos.find((p) => p.id === pratoIdInicial)
        if (found) {
          setSelecionado(found)
          setFotoIdx(0)
          setPasso(2)
        }
      }
    } catch (e) {
      console.error('[DrawerCardapio]', e)
      setSecoes([])
    } finally {
      setCarregando(false)
    }
  }, [empresaId, pratoIdInicial, empresaVerificadaProp])

  useEffect(() => {
    if (!isOpen) return
    if (empresaVerificadaProp != null) setEmpresaVerificada(Boolean(empresaVerificadaProp))
    reset()
    void carregar()
  }, [isOpen, carregar, reset, empresaVerificadaProp])

  const fotos = selecionado?.fotos?.length
    ? selecionado.fotos
    : selecionado?.foto_url
      ? [selecionado.foto_url]
      : []

  const precoFinal = selecionado ? precoFinalUsd(selecionado.preco_usd, selecionado.percentual_desconto) : 0
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

  const abrirSite = () => {
    const url = selecionado?.site_url?.trim()
    if (!url) {
      window.alert('Link do site não cadastrado para este prato.')
      return
    }
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`
    window.open(href, '_blank', 'noopener,noreferrer')
  }

  const abrirWhatsapp = () => {
    if (!selecionado) return
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const pratoUrl = origin
      ? `${origin}/cardapio/prato/${selecionado.id}?ref=whatsapp`
      : `/cardapio/prato/${selecionado.id}?ref=whatsapp`
    const ok = openWhatsAppChat(
      whatsappComercial,
      mensagemWhatsappPrato({
        nomePrato: selecionado.nome,
        username: usernameExibir,
        pratoUrl,
      }),
    )
    if (!ok) window.alert('WhatsApp comercial da loja não configurado.')
  }

  const totalPratos = useMemo(() => secoes.reduce((acc, s) => acc + s.pratos.length, 0), [secoes])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[140] flex flex-col bg-white"
      role="dialog"
      aria-modal="true"
      aria-label="Cardápio"
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
            {selecionado?.categoria_nome || (carregando ? '…' : 'Prato')}
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
          <p className="py-12 text-center text-sm text-gray-400">Carregando cardápio…</p>
        ) : passo === 1 && !abrirDiretoNoDetalhe ? (
          <div className="space-y-5 pb-8 pt-3">
            {totalPratos === 0 ? (
              <p className="px-4 text-center text-sm text-gray-500">Nenhum prato disponível no momento.</p>
            ) : (
              secoes.map((sec) => (
                <section key={sec.categoriaId} className="space-y-2">
                  <h3 className="px-4 text-center text-sm font-bold text-[#0097b2]">
                    {sec.categoriaNome} • {sec.pratos.length}
                  </h3>
                  <div className="flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <div className="w-[11%] shrink-0 snap-none" aria-hidden />
                    {sec.pratos.map((p) => {
                      const capa = p.fotos[0] ?? p.foto_url
                      const pctP = Number(p.percentual_desconto) || 0
                      const finalUsd = precoFinalUsd(p.preco_usd, pctP)
                      return (
                        <article
                          key={p.id}
                          className="box-border flex w-[78%] max-w-[280px] shrink-0 snap-center flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
                        >
                          <div className="flex items-center gap-1.5 px-3 pt-3">
                            <p className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-[#001f3f]">
                              {p.nome}
                            </p>
                            {pctP > 0 ? (
                              <span
                                className="shrink-0 text-sm font-bold text-[#00D443]"
                                aria-label={`Em oferta −${pctP}%`}
                              >
                                %
                              </span>
                            ) : null}
                            {!perfilEhEmpresa ? (
                              <BotaoEstrelaFavorito
                                usuarioId={visitanteId}
                                alvoId={p.id}
                                tipo="prato"
                                inicial={favPratos.has(p.id)}
                                size={18}
                                onChange={(salvo) => {
                                  setFavPratos((prev) => {
                                    const next = new Set(prev)
                                    if (salvo) next.add(p.id)
                                    else next.delete(p.id)
                                    return next
                                  })
                                }}
                              />
                            ) : null}
                          </div>
                          <div className="relative mt-2 aspect-[4/3] w-full shrink-0 overflow-hidden bg-gray-100">
                            {capa ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={capa} alt="" className="absolute inset-0 h-full w-full object-cover" />
                            ) : null}
                          </div>
                          <div className="flex flex-col gap-1 p-3">
                            <PrecoProdutoCde
                              precoUsd={finalUsd}
                              precoUsdCheio={pctP > 0 ? p.preco_usd : null}
                              cotacoes={cotacoes}
                              moedaPadrao={moedaPadrao}
                              destacarUsd
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setSelecionado(p)
                                setFotoIdx(0)
                                setPasso(2)
                              }}
                              className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white"
                              style={{ backgroundColor: VERDE }}
                            >
                              <Eye className="h-4 w-4" aria-hidden />
                              VER PRATO
                            </button>
                          </div>
                        </article>
                      )
                    })}
                    <div className="w-[11%] shrink-0 snap-none" aria-hidden />
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
                      tipo="prato"
                      inicial={favPratos.has(selecionado.id)}
                      size={28}
                      className="!opacity-100"
                      onChange={(salvo) => {
                        setFavPratos((prev) => {
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
        ) : null}
      </div>

      {selecionado ? (
        <PopupRecomendarPrato
          aberto={recomendarAberto}
          onFechar={() => setRecomendarAberto(false)}
          prato={{
            id: selecionado.id,
            nome: selecionado.nome,
            precoUsd: precoFinal,
            precoBrl: precoBrl > 0 ? precoBrl : null,
            empresaId,
            empresaNome,
            empresaUsername: usernameExibir,
            categoriaId: selecionado.categoria_id,
          }}
        />
      ) : null}
    </div>
  )
}
