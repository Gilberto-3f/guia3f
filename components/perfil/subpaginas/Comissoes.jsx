'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { Search, Star } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  ORDEM_CATEGORIA_COMERCIO,
  ROTULO_CATEGORIA_COMERCIO,
  categoriaCombinaChaveComercio,
} from '@/lib/comissoesCategorias'
import {
  deletarFavoritoEmpresa,
  listarEmpresaIdsFavoritasPorUsuario,
  payloadFavoritoEmpresa,
} from '@/lib/favoritosEmpresa'

const SEM_PRAZO_DATA = '2099-12-31'

const SLUG_PARA_OFERTA_CATEGORIA = {
  motorista_app: 'Motorista de APP',
  guia: 'Guia de Turismo',
  van: 'Motorista de Van',
  taxista: 'Taxista',
  anfitriao: 'Anfitrião',
  anfitrião: 'Anfitrião',
}

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

function ofertaVigente(oferta) {
  const raw = oferta.beneficios
  const b =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? /** @type {{ por_tempo_limitado?: boolean }} */ (raw)
      : {}
  if (b.por_tempo_limitado !== true) return true
  const data = oferta.data_validade ? String(oferta.data_validade).slice(0, 10) : ''
  if (!data || data === SEM_PRAZO_DATA) return true
  const hoje = new Date().toISOString().slice(0, 10)
  return data >= hoje
}

function listarBeneficiosAtivos(b) {
  /** @type {{ label: string, valor: string }[]} */
  const itens = []
  if (b.pax?.ativo) itens.push({ label: 'PAX (por cliente)', valor: `R$ ${b.pax.valor ?? 0}` })
  if (b.percentual?.ativo) itens.push({ label: '% sobre venda', valor: `${b.percentual.valor ?? 0}%` })
  if (b.fixo?.ativo) itens.push({ label: 'Valor fixo por indicação', valor: `R$ ${b.fixo.valor ?? 0}` })
  if (b.extra?.ativo && String(b.extra.texto ?? '').trim()) {
    itens.push({ label: 'Benefício extra', valor: String(b.extra.texto).trim() })
  }
  return itens
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

export default function Comissoes() {
  const filtrosRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const inputBuscaRef = useRef(/** @type {HTMLInputElement | null} */ (null))
  const [busca, setBusca] = useState('')
  const [pesquisaAberta, setPesquisaAberta] = useState(false)
  const [filtroCidade, setFiltroCidade] = useState('foz')
  const [somenteFavoritos, setSomenteFavoritos] = useState(false)
  const [categoriaAba, setCategoriaAba] = useState(/** @type {string} */ (ORDEM_CATEGORIA_COMERCIO[0]))
  const [ofertas, setOfertas] = useState(/** @type {Array<Record<string, unknown>>} */ ([]))
  const [favoritosEmpresaIds, setFavoritosEmpresaIds] = useState(/** @type {Set<string>} */ (new Set()))
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(/** @type {string | null} */ (null))
  const [semComunidade, setSemComunidade] = useState(false)
  const [favLoadingId, setFavLoadingId] = useState(/** @type {string | null} */ (null))

  const carregarFavoritos = useCallback(async (uid) => {
    try {
      const ids = await listarEmpresaIdsFavoritasPorUsuario(supabase, uid)
      setFavoritosEmpresaIds(new Set(ids))
    } catch (e) {
      console.error('[Comissoes] favoritos:', e)
      setFavoritosEmpresaIds(new Set())
    }
  }, [])

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    setSemComunidade(false)

    const {
      data: { session },
    } = await supabase.auth.getSession()
    const uid = session?.user?.id ?? null
    if (!uid) {
      setOfertas([])
      setErro('Faça login para ver as ofertas.')
      setCarregando(false)
      return
    }

    await carregarFavoritos(uid)

    const { data: prof } = await supabase.from('profissionais').select('categorias').eq('usuario_id', uid).maybeSingle()
    const slugs = Array.isArray(prof?.categorias) ? prof.categorias.map((c) => String(c).toLowerCase()) : []
    const categoriasOferta = [
      ...new Set(slugs.map((s) => SLUG_PARA_OFERTA_CATEGORIA[/** @type {keyof typeof SLUG_PARA_OFERTA_CATEGORIA} */ (s)]).filter(Boolean)),
    ]

    if (categoriasOferta.length === 0) {
      setSemComunidade(true)
      setOfertas([])
      setCarregando(false)
      return
    }

    const { data, error } = await supabase
      .from('comissao_oferta')
      .select(
        `
        id,
        empresa_id,
        categoria_profissional,
        beneficios,
        data_validade,
        created_at,
        empresas (
          id,
          nome_fantasia,
          nome_usuario,
          foto_url,
          cidade,
          categoria
        )
      `
      )
      .eq('status', 'aprovada')
      .in('categoria_profissional', categoriasOferta)
      .order('created_at', { ascending: false })

    if (error) {
      setErro('Não foi possível carregar as ofertas de comissão.')
      setOfertas([])
      setCarregando(false)
      return
    }

    const vistos = new Set()
    const dedup = []
    for (const row of data ?? []) {
      const empId = String(row.empresa_id ?? '')
      if (!empId || vistos.has(empId)) continue
      if (!ofertaVigente(row)) continue
      vistos.add(empId)
      dedup.push(row)
    }

    setOfertas(dedup)
    setCarregando(false)
  }, [carregarFavoritos])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const toggleFavoritoEmpresa = async (empresaId) => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const uid = session?.user?.id
    if (!uid || !empresaId) return

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
                      {itens.map((item) => (
                        <li key={item.label} className="rounded-lg bg-gray-50 px-3 py-2">
                          <p className="text-xs font-medium text-gray-700">{item.label}</p>
                          <p className="text-sm font-semibold text-[#001f3f]">{item.valor}</p>
                        </li>
                      ))}
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
