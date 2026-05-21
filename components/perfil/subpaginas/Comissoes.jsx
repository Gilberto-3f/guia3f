'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { Info, Search, Star } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  ORDEM_CATEGORIA_COMERCIO,
  ROTULO_CATEGORIA_COMERCIO,
  categoriaCombinaChaveComercio,
} from '@/lib/comissoesCategorias'
import {
  deletarFavoritoEmpresa,
  payloadFavoritoEmpresa,
} from '@/lib/favoritosEmpresa'
import { fetchComissoesOfertasData, getComissoesOfertasCache } from '@/lib/fetchComissoesOfertas'

const SEM_PRAZO_DATA = '2099-12-31'

const FILTROS_BANDEIRA = [
  { id: 'foz', bandeira: '🇧🇷', label: 'Brasil — Foz do Iguaçu', match: ['foz do iguacu', 'foz do iguaçu'] },
  { id: 'cde', bandeira: '🇵🇾', label: 'Paraguai — Ciudad del Este', match: ['ciudad del este'] },
  { id: 'puerto', bandeira: '🇦🇷', label: 'Argentina — Puerto Iguazú', match: ['puerto iguazu', 'puerto iguazú'] },
]

function normalizarTexto(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function cidadeCombinaFiltro(cidade, filtroId) {
  const f = FILTROS_BANDEIRA.find((c) => c.id === filtroId)
  if (!f?.match?.length) return true
  const norm = normalizarTexto(cidade)
  return f.match.some((m) => norm.includes(m))
}

/** @type {Record<'pax' | 'percentual' | 'fixo' | 'extra', string>} */
const INFO_BENEFICIO = {
  pax: 'Comissão paga por passageiro direcionado para nossa loja (comprando/consumindo ou não).',
  percentual: 'Comissão é uma porcentagem paga sobre a compra ou consumo do cliente na empresa.',
  fixo: 'Comissão é um valor fixo por passageiro que consumir ou comprar na empresa.',
  extra: 'Um benefício particular e personalizado que a empresa oferece além das comissões.',
}

function listarBeneficiosAtivos(b) {
  /** @type {{ tipo: 'pax' | 'percentual' | 'fixo' | 'extra', label: string, valor: string }[]} */
  const itens = []
  if (b.pax?.ativo) itens.push({ tipo: 'pax', label: 'PAX (por cliente)', valor: `R$ ${b.pax.valor ?? 0}` })
  if (b.percentual?.ativo)
    itens.push({ tipo: 'percentual', label: '% sobre venda', valor: `${b.percentual.valor ?? 0}%` })
  if (b.fixo?.ativo)
    itens.push({ tipo: 'fixo', label: 'Valor fixo por indicação', valor: `R$ ${b.fixo.valor ?? 0}` })
  if (b.extra?.ativo && String(b.extra.texto ?? '').trim()) {
    itens.push({ tipo: 'extra', label: 'Benefício extra', valor: String(b.extra.texto).trim() })
  }
  return itens
}

/**
 * @param {{
 *   tipo: 'pax' | 'percentual' | 'fixo' | 'extra'
 *   aberto: boolean
 *   onToggle: () => void
 *   onFechar: () => void
 * }} props
 */
function BotaoInfoBeneficio({ tipo, aberto, onToggle, onFechar }) {
  const btnRef = useRef(/** @type {HTMLButtonElement | null} */ (null))
  const popupRef = useRef(/** @type {HTMLDivElement | null} */ (null))

  useEffect(() => {
    if (!aberto) return
    const onPointerDown = (e) => {
      const alvo = /** @type {Node} */ (e.target)
      if (btnRef.current?.contains(alvo) || popupRef.current?.contains(alvo)) return
      onFechar()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
    }
  }, [aberto, onFechar])

  return (
    <div className="relative shrink-0 self-start">
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
        className="flex h-7 w-7 items-center justify-center rounded-full text-[#0097b2] transition hover:bg-[#0097b2]/10"
        aria-label={`Informações sobre ${tipo}`}
        aria-expanded={aberto}
      >
        <Info className="h-4 w-4" strokeWidth={2.25} aria-hidden />
      </button>
      {aberto ? (
        <div
          ref={popupRef}
          role="tooltip"
          className="absolute right-0 top-full z-30 mt-1 w-[min(16.5rem,calc(100vw-2.5rem))] rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-xs leading-snug text-gray-700 shadow-lg"
        >
          {INFO_BENEFICIO[tipo]}
        </div>
      ) : null}
    </div>
  )
}

function textoValidadeOferta(oferta) {
  const raw = oferta.beneficios
  const b =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? /** @type {{ por_tempo_limitado?: boolean }} */ (raw)
      : {}
  if (b.por_tempo_limitado !== true) return null
  const data = oferta.data_validade ? String(oferta.data_validade).slice(0, 10) : ''
  if (!data || data === SEM_PRAZO_DATA) return null
  return `Válida até ${new Date(data + 'T12:00:00').toLocaleDateString('pt-BR')}`
}

/**
 * @param {{ usuarioId?: string | null }} props
 */
export default function Comissoes({ usuarioId = null }) {
  const cacheInicial = usuarioId ? getComissoesOfertasCache(usuarioId) : null
  const filtrosRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const inputBuscaRef = useRef(/** @type {HTMLInputElement | null} */ (null))
  const [busca, setBusca] = useState('')
  const [pesquisaAberta, setPesquisaAberta] = useState(false)
  const [filtroCidade, setFiltroCidade] = useState('foz')
  const [somenteFavoritos, setSomenteFavoritos] = useState(false)
  const [categoriaAba, setCategoriaAba] = useState(/** @type {string} */ (ORDEM_CATEGORIA_COMERCIO[0]))
  const [ofertas, setOfertas] = useState(/** @type {Array<Record<string, unknown>>} */ (cacheInicial?.ofertas ?? []))
  const [favoritosEmpresaIds, setFavoritosEmpresaIds] = useState(
    /** @type {Set<string>} */ (new Set(cacheInicial?.favoritosEmpresaIds ?? []))
  )
  const [carregando, setCarregando] = useState(!cacheInicial)
  const [erro, setErro] = useState(/** @type {string | null} */ (cacheInicial?.erro ?? null))
  const [semComunidade, setSemComunidade] = useState(cacheInicial?.semComunidade ?? false)
  const [favLoadingId, setFavLoadingId] = useState(/** @type {string | null} */ (null))
  const [beneficioInfoAberto, setBeneficioInfoAberto] = useState(/** @type {string | null} */ (null))

  const carregar = useCallback(async () => {
    if (!usuarioId) {
      setOfertas([])
      setErro('Faça login para ver as ofertas.')
      setSemComunidade(false)
      setCarregando(false)
      return
    }

    const tinhaCache = !!getComissoesOfertasCache(usuarioId)
    if (!tinhaCache) {
      setCarregando(true)
      setErro(null)
      setSemComunidade(false)
    }

    try {
      const { ofertas: lista, favoritosEmpresaIds: favIds, semComunidade: semCom, erro: err } =
        await fetchComissoesOfertasData(supabase, usuarioId)
      setOfertas(lista)
      setFavoritosEmpresaIds(new Set(favIds))
      setSemComunidade(semCom)
      setErro(err)
    } catch (e) {
      console.error('[Comissoes] carregar:', e)
      setErro('Não foi possível carregar as ofertas de comissão.')
      setOfertas([])
    } finally {
      setCarregando(false)
    }
  }, [usuarioId])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const toggleFavoritoEmpresa = async (empresaId) => {
    if (!usuarioId || !empresaId) return
    const uid = usuarioId

    setFavLoadingId(empresaId)
    const eraFav = favoritosEmpresaIds.has(empresaId)

    try {
      if (eraFav) {
        await deletarFavoritoEmpresa(supabase, uid, empresaId)
        setFavoritosEmpresaIds((prev) => {
          const next = new Set(prev)
          next.delete(empresaId)
          return next
        })
      } else {
        const { error } = await supabase.from('favoritos').insert(payloadFavoritoEmpresa(uid, empresaId))
        if (error) throw error
        setFavoritosEmpresaIds((prev) => new Set(prev).add(empresaId))
      }
    } catch (e) {
      console.error('[Comissoes] favorito:', e)
    } finally {
      setFavLoadingId(null)
    }
  }

  const cards = useMemo(() => {
    const termo = normalizarTexto(busca)
    return ofertas.filter((oferta) => {
      const emp = oferta.empresas
      const empresa =
        emp && typeof emp === 'object' && !Array.isArray(emp) ? /** @type {Record<string, unknown>} */ (emp) : null
      if (!empresa) return false

      const empresaId = String(empresa.id ?? oferta.empresa_id ?? '')
      const nome = normalizarTexto(empresa.nome_fantasia)
      const user = normalizarTexto(String(empresa.nome_usuario ?? '').replace(/^@+/, ''))
      if (termo && !nome.includes(termo) && !user.includes(termo)) return false

      if (somenteFavoritos && !favoritosEmpresaIds.has(empresaId)) return false
      if (!cidadeCombinaFiltro(String(empresa.cidade ?? ''), filtroCidade)) return false
      if (!categoriaCombinaChaveComercio(String(empresa.categoria ?? ''), categoriaAba)) return false

      return true
    })
  }, [ofertas, busca, filtroCidade, somenteFavoritos, favoritosEmpresaIds, categoriaAba])

  const fecharPesquisa = useCallback(() => {
    setPesquisaAberta(false)
    setBusca('')
  }, [])

  useEffect(() => {
    if (!pesquisaAberta) return
    const t = window.requestAnimationFrame(() => inputBuscaRef.current?.focus())
    return () => window.cancelAnimationFrame(t)
  }, [pesquisaAberta])

  useEffect(() => {
    if (!pesquisaAberta) return
    const onPointerDown = (e) => {
      const el = filtrosRef.current
      if (el && !el.contains(/** @type {Node} */ (e.target))) fecharPesquisa()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
    }
  }, [pesquisaAberta, fecharPesquisa])

  const bandeiraBtnCls = (ativo) =>
    `flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-lg transition ${
      ativo
        ? 'border-[#0097b2] bg-[#0097b2]/15 ring-2 ring-[#0097b2]/40'
        : 'border-gray-200 bg-white hover:border-gray-300'
    }`

  return (
    <div className="space-y-4 px-1 pb-2">
      <h1 className="text-xl font-bold text-[#001f3f]">Comissões</h1>

      <div ref={filtrosRef} className="space-y-2">
        {pesquisaAberta ? (
          <div className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
            <Search className="pointer-events-none h-4 w-4 shrink-0 text-[#0097b2]" strokeWidth={2.25} aria-hidden />
            <input
              ref={inputBuscaRef}
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar empresa pelo nome…"
              className="min-w-0 flex-1 border-0 bg-transparent py-0.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
              aria-label="Buscar empresa pelo nome"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  fecharPesquisa()
                }
              }}
            />
          </div>
        ) : null}

        <div className="flex min-h-11 items-center gap-2">
          {FILTROS_BANDEIRA.map((c) => (
            <button
              key={c.id}
              type="button"
              className={bandeiraBtnCls(!somenteFavoritos && filtroCidade === c.id)}
              onClick={() => {
                setSomenteFavoritos(false)
                setFiltroCidade(c.id)
              }}
              aria-label={c.label}
              title={c.label}
            >
              <span aria-hidden>{c.bandeira}</span>
            </button>
          ))}

          <button
            type="button"
            className={`${bandeiraBtnCls(somenteFavoritos)} ml-auto`}
            onClick={() => setSomenteFavoritos((v) => !v)}
            aria-label="Favoritos"
            aria-pressed={somenteFavoritos}
            title="Empresas favoritas"
          >
            <Star
              className={`h-5 w-5 ${somenteFavoritos ? 'fill-amber-400 text-amber-500' : 'text-gray-400'}`}
              strokeWidth={2}
              aria-hidden
            />
          </button>

          <button
            type="button"
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition ${
              pesquisaAberta
                ? 'border-[#0097b2] bg-[#0097b2] ring-2 ring-[#0097b2]/40'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
            aria-label={pesquisaAberta ? 'Fechar pesquisa' : 'Abrir pesquisa'}
            aria-expanded={pesquisaAberta}
            onClick={() => {
              if (pesquisaAberta) {
                fecharPesquisa()
                return
              }
              setPesquisaAberta(true)
              window.requestAnimationFrame(() => {
                window.requestAnimationFrame(() => inputBuscaRef.current?.focus())
              })
            }}
          >
            <Search
              className={`h-5 w-5 ${pesquisaAberta ? 'text-white' : 'text-[#0097b2]'}`}
              strokeWidth={2.25}
              aria-hidden
            />
          </button>
        </div>
      </div>

      <div
        className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
        role="tablist"
        aria-label="Categorias de comércio"
      >
        <div className="grid grid-cols-4 gap-0.5 p-0.5">
          {ORDEM_CATEGORIA_COMERCIO.map((cat) => {
            const ativo = categoriaAba === cat
            const meta = ROTULO_CATEGORIA_COMERCIO[/** @type {keyof typeof ROTULO_CATEGORIA_COMERCIO} */ (cat)]
            if (!meta) return null
            const { Icon, rotulo } = meta
            return (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={ativo}
                aria-label={rotulo}
                onClick={() => setCategoriaAba(cat)}
                className={`flex min-h-[3.25rem] min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 py-2 text-center transition-all ${
                  ativo
                    ? 'bg-[#0097b2] font-semibold text-white shadow-sm'
                    : 'text-[#0097b2] hover:bg-[#0097b2]/8'
                }`}
              >
                <Icon
                  className={`h-[1.125rem] w-[1.125rem] shrink-0 sm:h-5 sm:w-5 ${ativo ? 'text-white' : 'text-[#0097b2]'}`}
                  aria-hidden
                />
                <span
                  className={`w-full px-0.5 text-[9px] font-medium leading-tight tracking-tight sm:text-[10px] ${
                    ativo ? 'text-white' : 'text-[#0097b2]'
                  }`}
                >
                  {rotulo}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {carregando ? (
        <p className="py-8 text-center text-sm text-gray-500">Carregando ofertas…</p>
      ) : erro ? (
        <p className="py-8 text-center text-sm text-rose-600">{erro}</p>
      ) : semComunidade ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
          Complete seu perfil profissional com uma comunidade para ver ofertas de comissão.
        </div>
      ) : cards.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
          {somenteFavoritos
            ? 'Nenhuma oferta de empresas favoritas. Toque na estrela nos cards para favoritar.'
            : 'Nenhuma empresa encontrada com os filtros atuais.'}
        </div>
      ) : (
        <ul className="space-y-3">
          {cards.map((oferta) => {
            const emp = oferta.empresas
            const empresa =
              emp && typeof emp === 'object' && !Array.isArray(emp) ? /** @type {Record<string, unknown>} */ (emp) : {}
            const empresaId = String(empresa.id ?? oferta.empresa_id ?? '')
            const isFav = favoritosEmpresaIds.has(empresaId)
            const raw = oferta.beneficios
            const beneficios =
              raw && typeof raw === 'object' && !Array.isArray(raw)
                ? /** @type {Record<string, { ativo?: boolean; valor?: number; texto?: string }>} */ (raw)
                : {}
            const itens = listarBeneficiosAtivos(beneficios)
            const validadeTxt = textoValidadeOferta(oferta)
            const nomeFantasia = String(empresa.nome_fantasia ?? 'Empresa')
            const username = String(empresa.nome_usuario ?? '')
              .replace(/^@+/, '')
              .trim()
            const fotoUrl = empresa.foto_url ? String(empresa.foto_url) : null
            const favBusy = favLoadingId === empresaId

            return (
              <li key={String(oferta.id)} className="relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <button
                  type="button"
                  disabled={favBusy}
                  onClick={() => void toggleFavoritoEmpresa(empresaId)}
                  className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-sm ring-1 ring-gray-200 transition hover:bg-amber-50 disabled:opacity-50"
                  aria-label={isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                  aria-pressed={isFav}
                >
                  <Star
                    className={`h-5 w-5 ${isFav ? 'fill-amber-400 text-amber-500' : 'text-gray-400'}`}
                    strokeWidth={2}
                    aria-hidden
                  />
                </button>

                <div className="flex items-center gap-3 border-b border-gray-100 px-3 py-3 pr-12">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    {fotoUrl ? (
                      <Image src={fotoUrl} alt="" fill className="object-cover" sizes="48px" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">—</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-gray-900">{nomeFantasia}</p>
                    {username ? (
                      <p className="truncate text-xs font-medium text-[#0097b2]">@{username}</p>
                    ) : (
                      <p className="text-xs text-gray-400">—</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2 px-3 py-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Oferta da Empresa</p>
                  {itens.length === 0 ? (
                    <p className="text-sm text-gray-500">Nenhum benefício cadastrado nesta proposta.</p>
                  ) : (
                    <ul className="space-y-2">
                      {itens.map((item) => {
                        const infoKey = `${String(oferta.id)}-${item.tipo}`
                        return (
                          <li key={infoKey} className="rounded-lg bg-gray-50 px-3 py-2">
                            <div className="flex items-center gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-gray-700">{item.label}</p>
                                <p className="text-sm font-semibold text-[#001f3f]">{item.valor}</p>
                              </div>
                              <BotaoInfoBeneficio
                                tipo={item.tipo}
                                aberto={beneficioInfoAberto === infoKey}
                                onToggle={() =>
                                  setBeneficioInfoAberto((atual) => (atual === infoKey ? null : infoKey))
                                }
                                onFechar={() => setBeneficioInfoAberto(null)}
                              />
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                  {validadeTxt ? <p className="text-xs text-amber-700">{validadeTxt}</p> : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
