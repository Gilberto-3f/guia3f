'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { LayoutGrid, Search, Star } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  ORDEM_CATEGORIA_COMERCIO,
  ROTULO_CATEGORIA_COMERCIO,
  categoriaCombinaChaveComercio,
} from '@/lib/comissoesCategorias'

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
  { id: 'todos', bandeira: null, label: 'Todas as cidades', match: [] },
  { id: 'foz', bandeira: '🇧🇷', label: 'Brasil — Foz do Iguaçu', match: ['foz do iguacu', 'foz do iguaçu'] },
  { id: 'cde', bandeira: '🇵🇾', label: 'Paraguai — Ciudad del Este', match: ['ciudad del este'] },
  { id: 'puerto', bandeira: '🇦🇷', label: 'Argentina — Puerto Iguazú', match: ['puerto iguazu', 'puerto iguazú'] },
]

const ABAS_CATEGORIA = ['Todas', ...ORDEM_CATEGORIA_COMERCIO]

function normalizarTexto(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function cidadeCombinaFiltro(cidade, filtroId) {
  if (filtroId === 'todos') return true
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
  const [busca, setBusca] = useState('')
  const [filtroCidade, setFiltroCidade] = useState('todos')
  const [somenteFavoritos, setSomenteFavoritos] = useState(false)
  const [categoriaAba, setCategoriaAba] = useState(/** @type {string} */ ('Todas'))
  const [ofertas, setOfertas] = useState(/** @type {Array<Record<string, unknown>>} */ ([]))
  const [favoritosEmpresaIds, setFavoritosEmpresaIds] = useState(/** @type {Set<string>} */ (new Set()))
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(/** @type {string | null} */ (null))
  const [semComunidade, setSemComunidade] = useState(false)
  const [favLoadingId, setFavLoadingId] = useState(/** @type {string | null} */ (null))

  const carregarFavoritos = useCallback(async (uid) => {
    const { data, error } = await supabase
      .from('favoritos')
      .select('alvo_id, empresa_id')
      .eq('usuario_id', uid)
      .eq('alvo_tipo', 'empresa')

    if (error) {
      const { data: legado } = await supabase.from('favoritos').select('empresa_id').eq('usuario_id', uid)
      const ids = new Set(
        (legado ?? []).map((r) => String(r.empresa_id ?? '')).filter(Boolean)
      )
      setFavoritosEmpresaIds(ids)
      return
    }

    const ids = new Set()
    for (const row of data ?? []) {
      const id = String(row.alvo_id ?? row.empresa_id ?? '').trim()
      if (id) ids.add(id)
    }
    setFavoritosEmpresaIds(ids)
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
        const { error } = await supabase
          .from('favoritos')
          .delete()
          .eq('usuario_id', uid)
          .eq('alvo_id', empresaId)
          .eq('alvo_tipo', 'empresa')
        if (error) throw error
        setFavoritosEmpresaIds((prev) => {
          const next = new Set(prev)
          next.delete(empresaId)
          return next
        })
      } else {
        const { error } = await supabase.from('favoritos').insert({
          usuario_id: uid,
          alvo_id: empresaId,
          alvo_tipo: 'empresa',
        })
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

  const bandeiraBtnCls = (ativo) =>
    `flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-lg transition ${
      ativo
        ? 'border-[#0097b2] bg-[#0097b2]/15 ring-2 ring-[#0097b2]/40'
        : 'border-gray-200 bg-white hover:border-gray-300'
    }`

  return (
    <div className="space-y-4 px-1 pb-2">
      <h1 className="text-xl font-bold text-[#001f3f]">Comissões</h1>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar empresa pelo nome…"
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 outline-none ring-[#0097b2]/30 focus:border-[#0097b2] focus:ring-2"
          aria-label="Buscar empresa pelo nome"
        />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Cidade</p>
        <div className="flex items-center gap-2">
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
              {c.bandeira ? (
                <span aria-hidden>{c.bandeira}</span>
              ) : (
                <LayoutGrid className="h-5 w-5 text-[#0097b2]" strokeWidth={2} aria-hidden />
              )}
            </button>
          ))}
          <button
            type="button"
            className={bandeiraBtnCls(somenteFavoritos)}
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
        </div>
      </div>

      <div className="overflow-hidden rounded-xl bg-[#0097b2]" role="tablist" aria-label="Categorias de comércio">
        <div className="flex gap-1 p-1">
          {ABAS_CATEGORIA.map((cat) => {
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
                onClick={() => setCategoriaAba(cat)}
                className={`flex min-h-[3rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-2 text-center transition-all sm:flex-row sm:gap-1.5 sm:px-2 sm:py-2.5 ${
                  ativo ? 'bg-white font-semibold text-[#0097b2] shadow-sm' : 'text-white hover:bg-white/15'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden />
                <span className="max-w-full text-[0.65rem] font-medium leading-tight min-[400px]:text-xs">{rotulo}</span>
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
