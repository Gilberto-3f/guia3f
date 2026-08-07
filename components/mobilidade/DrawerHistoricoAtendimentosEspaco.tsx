'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronUp, History, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import AvatarImage from '@/components/AvatarImage'
import { useModalScrollLock } from '@/lib/useModalScrollLock'
import type { AtendimentoDiaItem } from '@/app/api/mobilidade/atendimentos-dia/route'

const COR = '#0097b2'

type Props = {
  aberto: boolean
  onFechar: () => void
}

type Aba = 'hoje' | 'historico'

function formatBrl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Drawer Histórico de atendimentos (guia/van / taxista). */
export default function DrawerHistoricoAtendimentosEspaco({ aberto, onFechar }: Props) {
  const t = useTranslations('Mobilidade')
  useModalScrollLock(aberto)

  const [aba, setAba] = useState<Aba>('hoje')
  const [itens, setItens] = useState<AtendimentoDiaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [abertoId, setAbertoId] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro('')
    try {
      const qs = aba === 'historico' ? '?historico=1' : ''
      const res = await fetch(`/api/mobilidade/atendimentos-dia${qs}`)
      const json = (await res.json()) as { atendimentos?: AtendimentoDiaItem[]; error?: string }
      if (!res.ok) {
        setErro(String(json.error ?? t('atendimentosErro')))
        setItens([])
        return
      }
      setItens(Array.isArray(json.atendimentos) ? json.atendimentos : [])
    } catch {
      setErro(t('atendimentosErro'))
      setItens([])
    } finally {
      setLoading(false)
    }
  }, [aba, t])

  useEffect(() => {
    if (!aberto) {
      setAba('hoje')
      setAbertoId(null)
      return
    }
    void carregar()
  }, [aberto, carregar])

  if (!aberto) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex flex-col bg-white"
      style={{ height: 'var(--app-height, 100dvh)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-historico-atendimentos-titulo"
    >
      <div className="shrink-0 pt-safe" style={{ backgroundColor: COR }}>
        <div className="flex h-12 items-center gap-2 px-3">
          <History className="h-5 w-5 shrink-0 text-white" aria-hidden />
          <h2
            id="drawer-historico-atendimentos-titulo"
            className="min-w-0 flex-1 truncate text-base font-bold uppercase tracking-wide text-white"
          >
            {t('espacoAcao.historico.titulo')}
          </h2>
          <button
            type="button"
            onClick={onFechar}
            className="rounded-lg p-2 text-white/90 hover:bg-white/15"
            aria-label={t('fechar')}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4" data-modal-scroll-lock-scrollable>
        <div className="mb-3 flex rounded-lg bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => setAba('hoje')}
            className={`flex-1 rounded-md py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
              aba === 'hoje' ? 'text-white shadow-sm' : 'text-gray-600'
            }`}
            style={aba === 'hoje' ? { backgroundColor: '#00D443' } : undefined}
          >
            {t('historicoAbaHoje')}
          </button>
          <button
            type="button"
            onClick={() => setAba('historico')}
            className={`flex-1 rounded-md py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
              aba === 'historico' ? 'text-white shadow-sm' : 'text-gray-600'
            }`}
            style={aba === 'historico' ? { backgroundColor: '#00D443' } : undefined}
          >
            {t('historicoAbaRecentes')}
          </button>
        </div>

        {loading ? (
          <p className="animate-pulse py-8 text-center text-sm text-gray-400">…</p>
        ) : erro ? (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-center text-sm text-rose-700">{erro}</p>
        ) : itens.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-200 bg-[#f5f5f5] px-3 py-8 text-center text-sm text-gray-500">
            {aba === 'hoje' ? t('atendimentosVazio') : t('historicoAtendimentosVazio')}
          </p>
        ) : (
          <ul className="space-y-2">
            {itens.map((a) => {
              const open = abertoId === a.solicitacao_id
              const nome = a.turista_nome || t('atendimentoTurista')
              const user = a.turista_username
                ? `@${String(a.turista_username).replace(/^@+/, '')}`
                : null
              return (
                <li key={a.solicitacao_id}>
                  <button
                    type="button"
                    onClick={() => setAbertoId(open ? null : a.solicitacao_id)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-white shadow-sm"
                    style={{ backgroundColor: COR }}
                  >
                    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-white/20 ring-2 ring-white/50">
                      {a.turista_foto ? (
                        <AvatarImage
                          src={a.turista_foto}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="44px"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{nome}</p>
                      {user ? <p className="truncate text-xs text-white/85">{user}</p> : null}
                    </div>
                    {open ? (
                      <ChevronUp className="h-5 w-5 shrink-0" aria-hidden />
                    ) : (
                      <ChevronDown className="h-5 w-5 shrink-0" aria-hidden />
                    )}
                  </button>
                  {open ? (
                    <div className="mt-1 space-y-1 rounded-xl bg-[#f5f5f5] px-3 py-3 text-sm text-gray-800">
                      <p>
                        <span className="font-semibold text-gray-500">{t('origemLabel')}: </span>
                        {a.origem_nome || '—'}
                      </p>
                      <p>
                        <span className="font-semibold text-gray-500">{t('destinoLabel')}: </span>
                        {a.destino_nome || '—'}
                      </p>
                      <p>
                        <span className="font-semibold text-gray-500">{t('atendimentoValor')}: </span>
                        {a.valor_estimado != null ? formatBrl(a.valor_estimado) : '—'}
                      </p>
                      <p className="text-xs uppercase tracking-wide text-gray-500">{a.status}</p>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>,
    document.body,
  )
}
