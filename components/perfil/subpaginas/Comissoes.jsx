'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Search, Utensils, Ticket, ShoppingBag, Hotel } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const SEM_PRAZO_DATA = '2099-12-31'

const SLUG_PARA_OFERTA_CATEGORIA = {
  motorista_app: 'Motorista de APP',
  guia: 'Guia de Turismo',
  van: 'Motorista de Van',
  taxista: 'Taxista',
  anfitriao: 'Anfitrião',
  anfitrião: 'Anfitrião',
}

const FILTROS_CIDADE = [
  { id: 'todos', label: 'Todas', bandeira: null },
  { id: 'foz', label: 'Foz do Iguaçu', bandeira: '🇧🇷', match: ['foz do iguacu', 'foz do iguaçu'] },
  { id: 'cde', label: 'Ciudad del Este', bandeira: '🇵🇾', match: ['ciudad del este'] },
  { id: 'puerto', label: 'Puerto Iguazú', bandeira: '🇦🇷', match: ['puerto iguazu', 'puerto iguazú'] },
]

const FILTROS_CATEGORIA = [
  { id: 'todos', label: 'Todas', icon: null, match: [] },
  { id: 'gastronomia', label: 'Restaurantes', icon: Utensils, match: ['gastronomia', 'restaurantes'] },
  { id: 'passeios', label: 'Atrativos', icon: Ticket, match: ['passeios', 'atrativos'] },
  { id: 'lojas', label: 'Lojas', icon: ShoppingBag, match: ['lojas'] },
  { id: 'hospedagem', label: 'Hospedagem', icon: Hotel, match: ['hospedagem'] },
]

function normalizarTexto(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/**
 * @param {string | null | undefined} cidade
 * @param {string} filtroId
 */
function cidadeCombinaFiltro(cidade, filtroId) {
  if (filtroId === 'todos') return true
  const f = FILTROS_CIDADE.find((c) => c.id === filtroId)
  if (!f?.match?.length) return true
  const norm = normalizarTexto(cidade)
  return f.match.some((m) => norm.includes(m))
}

/**
 * @param {string | null | undefined} categoria
 * @param {string} filtroId
 */
function categoriaCombinaFiltro(categoria, filtroId) {
  if (filtroId === 'todos') return true
  const f = FILTROS_CATEGORIA.find((c) => c.id === filtroId)
  if (!f?.match?.length) return true
  const norm = normalizarTexto(categoria)
  return f.match.some((m) => norm === m || norm.includes(m))
}

/**
 * @param {Record<string, unknown>} oferta
 */
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

/**
 * @param {Record<string, { ativo?: boolean; valor?: number; texto?: string }>} b
 */
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

/**
 * @param {Record<string, unknown>} oferta
 */
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
  const [filtroCategoria, setFiltroCategoria] = useState('todos')
  const [ofertas, setOfertas] = useState(/** @type {Array<Record<string, unknown>>} */ ([]))
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(/** @type {string | null} */ (null))
  const [semComunidade, setSemComunidade] = useState(false)

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
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const cards = useMemo(() => {
    const termo = normalizarTexto(busca)
    return ofertas.filter((oferta) => {
      const emp = oferta.empresas
      const empresa =
        emp && typeof emp === 'object' && !Array.isArray(emp) ? /** @type {Record<string, unknown>} */ (emp) : null
      if (!empresa) return false

      const nome = normalizarTexto(empresa.nome_fantasia)
      const user = normalizarTexto(String(empresa.nome_usuario ?? '').replace(/^@+/, ''))
      if (termo && !nome.includes(termo) && !user.includes(termo)) return false

      if (!cidadeCombinaFiltro(String(empresa.cidade ?? ''), filtroCidade)) return false
      if (!categoriaCombinaFiltro(String(empresa.categoria ?? ''), filtroCategoria)) return false

      return true
    })
  }, [ofertas, busca, filtroCidade, filtroCategoria])

  const chipCls = (ativo) =>
    `shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
      ativo
        ? 'border-[#0097b2] bg-[#0097b2]/10 text-[#007d94]'
        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
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
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTROS_CIDADE.map((c) => (
            <button key={c.id} type="button" className={chipCls(filtroCidade === c.id)} onClick={() => setFiltroCidade(c.id)}>
              {c.bandeira ? <span className="mr-1" aria-hidden>{c.bandeira}</span> : null}
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Categoria</p>
        <div className="flex flex-wrap gap-2">
          {FILTROS_CATEGORIA.map((c) => {
            const Icon = c.icon
            return (
              <button
                key={c.id}
                type="button"
                className={`${chipCls(filtroCategoria === c.id)} inline-flex items-center gap-1.5`}
                onClick={() => setFiltroCategoria(c.id)}
              >
                {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden /> : null}
                {c.label}
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
          Nenhuma empresa encontrada com os filtros atuais.
        </div>
      ) : (
        <ul className="space-y-3">
          {cards.map((oferta) => {
            const emp = oferta.empresas
            const empresa =
              emp && typeof emp === 'object' && !Array.isArray(emp) ? /** @type {Record<string, unknown>} */ (emp) : {}
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

            return (
              <li key={String(oferta.id)} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center gap-3 border-b border-gray-100 px-3 py-3">
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
