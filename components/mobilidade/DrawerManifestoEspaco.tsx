'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronUp, MapPin, Users, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import AvatarImage from '@/components/AvatarImage'
import UsuarioHandleVerificado from '@/components/UsuarioHandleVerificado'
import { useModalScrollLock } from '@/lib/useModalScrollLock'
import type { ManifestoDiarioRow } from '@/app/api/profissional/manifesto/route'
import type { ParadaItinerarioRow } from '@/lib/itinerarioParadas'
import { MANIFESTO_CAPACIDADE_PADRAO } from '@/lib/mobilidadePainelProfissional'

const COR = '#0097b2'

type Props = {
  aberto: boolean
  onFechar: () => void
}

function hojeIsoLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatarDataBr(iso: string): string {
  const s = String(iso).slice(0, 10)
  const [y, m, d] = s.split('-')
  if (!y || !m || !d) return s
  return `${d}/${m}`
}

function formatarDataBrCompleta(iso: string): string {
  const s = String(iso).slice(0, 10)
  const [y, m, d] = s.split('-')
  if (!y || !m || !d) return s
  return `${d}/${m}/${y}`
}

/**
 * Drawer Manifesto no Espaço Profissional: lista do dia em destaque + demais datas.
 * Clique → detalhe com abas LISTA e ITINERÁRIO.
 */
export default function DrawerManifestoEspaco({ aberto, onFechar }: Props) {
  const t = useTranslations('Mobilidade')
  useModalScrollLock(aberto)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [manifestos, setManifestos] = useState<ManifestoDiarioRow[]>([])
  const [selecionado, setSelecionado] = useState<ManifestoDiarioRow | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro('')
    try {
      const res = await fetch('/api/profissional/manifesto')
      const json = (await res.json()) as { ok?: boolean; manifestos?: ManifestoDiarioRow[]; error?: string }
      if (!res.ok) {
        setErro(String(json.error ?? t('manifestoErro')))
        setManifestos([])
        return
      }
      setManifestos(Array.isArray(json.manifestos) ? json.manifestos : [])
    } catch {
      setErro(t('manifestoErro'))
      setManifestos([])
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (!aberto) {
      setSelecionado(null)
      return
    }
    void carregar()
  }, [aberto, carregar])

  const hoje = hojeIsoLocal()
  const doDia = useMemo(
    () => manifestos.find((m) => String(m.data_manifesto).slice(0, 10) === hoje) ?? null,
    [manifestos, hoje],
  )
  const outros = useMemo(
    () => manifestos.filter((m) => String(m.data_manifesto).slice(0, 10) !== hoje),
    [manifestos, hoje],
  )

  if (!aberto) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex flex-col bg-white"
      style={{ height: 'var(--app-height, 100dvh)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-manifesto-titulo"
    >
      <div className="shrink-0 pt-safe" style={{ backgroundColor: COR }}>
        <div className="flex h-12 items-center gap-2 px-3">
          <Users className="h-5 w-5 shrink-0 text-white" aria-hidden />
          <h2
            id="drawer-manifesto-titulo"
            className="min-w-0 flex-1 truncate text-base font-bold uppercase tracking-wide text-white"
          >
            {selecionado ? t('manifestoListaPassageiros') : t('espacoAcao.manifesto.titulo')}
          </h2>
          <button
            type="button"
            onClick={() => {
              if (selecionado) {
                setSelecionado(null)
                return
              }
              onFechar()
            }}
            className="rounded-lg p-2 text-white/90 hover:bg-white/15"
            aria-label={selecionado ? t('retornar') : t('fechar')}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4" data-modal-scroll-lock-scrollable>
        {selecionado ? (
          <DetalheManifesto manifesto={selecionado} />
        ) : (
          <>
            {loading ? (
              <p className="animate-pulse py-8 text-center text-sm text-gray-400">…</p>
            ) : null}
            {erro ? (
              <p className="rounded-xl bg-rose-50 px-3 py-2 text-center text-sm text-rose-700">{erro}</p>
            ) : null}

            {!loading && !erro ? (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    if (doDia) setSelecionado(doDia)
                  }}
                  disabled={!doDia}
                  className="w-full rounded-2xl px-4 py-4 text-left text-white shadow-md disabled:opacity-70"
                  style={{ backgroundColor: COR }}
                >
                  <p className="text-lg font-extrabold uppercase leading-tight tracking-wide">
                    {t('manifestoDeHoje')}
                  </p>
                  <p className="mt-1 text-sm font-normal text-white/90">
                    {doDia
                      ? `${doDia.qtd_passageiros} PAX — ${formatarDataBr(doDia.data_manifesto)}`
                      : `0 PAX — ${formatarDataBr(hoje)}`}
                    {doDia
                      ? ` · ${doDia.qtd_passageiros}/${MANIFESTO_CAPACIDADE_PADRAO}`
                      : ` · 0/${MANIFESTO_CAPACIDADE_PADRAO}`}
                  </p>
                </button>

                <p className="pt-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {t('manifestoOutrasListas')}
                </p>

                {outros.length === 0 ? (
                  <p className="py-4 text-center text-sm text-gray-400">{t('manifestoSemOutras')}</p>
                ) : (
                  outros.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelecionado(m)}
                      className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-4 text-left shadow-sm ring-1 ring-black/5"
                    >
                      <p className="text-base font-extrabold leading-tight" style={{ color: COR }}>
                        {t('manifestoListaPassageiros')}
                      </p>
                      <p className="mt-1 text-sm text-gray-600">
                        {formatarDataBrCompleta(m.data_manifesto)} — {m.qtd_passageiros} PAX
                      </p>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}

function DetalheManifesto({ manifesto }: { manifesto: ManifestoDiarioRow }) {
  const t = useTranslations('Mobilidade')
  const [aba, setAba] = useState<'lista' | 'itinerario'>('lista')

  const empresasUnicas = useMemo(() => {
    const map = new Map<string, ParadaItinerarioRow & { turistas: { id: string; nome: string; username: string | null; foto: string | null }[] }>()
    for (const p of manifesto.itinerario ?? []) {
      const eid = p.empresa_id
      const tid = p.turista_id
      const pass = manifesto.passageiros.find((x) => x.turista_id === tid)
      const turista = {
        id: tid ?? '',
        nome: pass?.nome_social || pass?.nome || t('atendimentoTurista'),
        username: pass?.username ?? null,
        foto: pass?.foto_url ?? null,
      }
      const cur = map.get(eid)
      if (cur) {
        if (turista.id && !cur.turistas.some((x) => x.id === turista.id)) cur.turistas.push(turista)
      } else {
        map.set(eid, { ...p, turistas: turista.id ? [turista] : [] })
      }
    }
    return [...map.values()]
  }, [manifesto, t])

  return (
    <div className="space-y-4">
      <p className="text-center text-sm text-gray-600">
        {formatarDataBrCompleta(manifesto.data_manifesto)} · {manifesto.qtd_passageiros} PAX
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setAba('lista')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold uppercase text-white ${
            aba === 'lista' ? 'opacity-100' : 'opacity-70'
          }`}
          style={{ backgroundColor: COR }}
        >
          <Users className="h-4 w-4" aria-hidden />
          {t('manifestoAbaLista')}
        </button>
        <button
          type="button"
          onClick={() => setAba('itinerario')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold uppercase text-white ${
            aba === 'itinerario' ? 'opacity-100' : 'opacity-70'
          }`}
          style={{ backgroundColor: COR }}
        >
          <MapPin className="h-4 w-4" aria-hidden />
          {t('manifestoAbaItinerario')}
        </button>
      </div>

      {aba === 'lista' ? (
        <ul className="space-y-2">
          {manifesto.passageiros.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">{t('manifestoSemPassageiros')}</p>
          ) : (
            manifesto.passageiros.map((p) => <CardPassageiroManifesto key={p.id} passageiro={p} />)
          )}
        </ul>
      ) : (
        <ul className="space-y-2">
          {empresasUnicas.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">{t('manifestoSemParadas')}</p>
          ) : (
            empresasUnicas.map((e) => <CardEmpresaItinerario key={e.empresa_id} empresa={e} />)
          )}
        </ul>
      )}
    </div>
  )
}

function formatarDataNasc(iso: string | null | undefined): string {
  if (!iso) return '—'
  const s = String(iso).slice(0, 10)
  const [y, m, d] = s.split('-')
  if (!y || !m || !d) return s
  return `${d}/${m}/${y}`
}

function CardPassageiroManifesto({
  passageiro: p,
}: {
  passageiro: ManifestoDiarioRow['passageiros'][number]
}) {
  const [aberto, setAberto] = useState(false)
  const handle = String(p.username ?? '')
    .replace(/^@+/, '')
    .trim()
  const nome = p.nome_social || p.nome

  return (
    <li className="overflow-hidden rounded-xl border border-gray-100 bg-[#f5f5f5]">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center gap-3 p-3 text-left"
        aria-expanded={aberto}
      >
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-gray-200">
          {p.foto_url ? (
            <AvatarImage src={p.foto_url} alt="" fill className="object-cover" sizes="48px" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-sm font-bold text-[#0097b2]">
              {(nome || 'T').charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">{p.nome}</p>
          {handle ? (
            <UsuarioHandleVerificado
              username={handle}
              verificado={false}
              asButton={false}
              className="text-xs text-gray-500"
            />
          ) : null}
        </div>
        {aberto ? (
          <ChevronUp className="h-5 w-5 shrink-0 text-gray-400" aria-hidden />
        ) : (
          <ChevronDown className="h-5 w-5 shrink-0 text-gray-400" aria-hidden />
        )}
      </button>
      {aberto ? (
        <div className="space-y-1 border-t border-gray-200/80 px-3 py-2.5 text-xs text-gray-600">
          <p>
            <span className="font-semibold text-gray-700">Nasc.:</span> {formatarDataNasc(p.data_nascimento)}
          </p>
          <p>
            <span className="font-semibold text-gray-700">Doc.:</span> {p.documento?.trim() || '—'}
          </p>
          {p.contratacao_rotulo ? (
            <p className="text-[10px] text-gray-500">Entrada: {p.contratacao_rotulo}</p>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

function CardEmpresaItinerario({
  empresa,
}: {
  empresa: ParadaItinerarioRow & {
    turistas: { id: string; nome: string; username: string | null; foto: string | null }[]
  }
}) {
  const t = useTranslations('Mobilidade')
  const [aberto, setAberto] = useState(false)
  const handleEmpresa = '' // username empresa não vem na row; só nome

  return (
    <li className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center gap-3 p-3 text-left"
      >
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100">
          {empresa.empresa_foto ? (
            <AvatarImage src={empresa.empresa_foto} alt="" fill className="object-cover" sizes="48px" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-sm font-bold text-[#0097b2]">
              {(empresa.empresa_nome || 'E').charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">{empresa.empresa_nome}</p>
          {handleEmpresa ? (
            <p className="truncate text-xs text-gray-500">@{handleEmpresa}</p>
          ) : (
            <p className="truncate text-xs text-gray-500">{empresa.categoria}</p>
          )}
        </div>
        {aberto ? (
          <ChevronUp className="h-5 w-5 shrink-0 text-[#0097b2]" aria-hidden />
        ) : (
          <ChevronDown className="h-5 w-5 shrink-0 text-[#0097b2]" aria-hidden />
        )}
      </button>
      {aberto ? (
        <div className="border-t border-gray-100 bg-[#f5f5f5] px-3 py-3">
          <p className="mb-2 text-xs font-semibold text-gray-600">{t('manifestoQuemDesejaVisitar')}</p>
          {empresa.turistas.length === 0 ? (
            <p className="text-xs text-gray-400">—</p>
          ) : (
            <ul className="space-y-2">
              {empresa.turistas.map((tu) => {
                const h = String(tu.username ?? '')
                  .replace(/^@+/, '')
                  .trim()
                return (
                  <li key={tu.id} className="flex items-center gap-2">
                    <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-gray-200">
                      {tu.foto ? (
                        <AvatarImage src={tu.foto} alt="" fill className="object-cover" sizes="32px" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-[10px] font-bold text-[#0097b2]">
                          {(tu.nome || 'T').charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-gray-800">{tu.nome}</p>
                      {h ? <p className="truncate text-[10px] text-gray-500">@{h}</p> : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : null}
    </li>
  )
}
