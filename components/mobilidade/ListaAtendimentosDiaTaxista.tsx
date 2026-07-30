'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import AvatarImage from '@/components/AvatarImage'
import type { AtendimentoDiaItem } from '@/app/api/mobilidade/atendimentos-dia/route'
import { useTranslations } from 'next-intl'

function formatBrl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Lista accordion de atendimentos do dia (visão taxista). */
export default function ListaAtendimentosDiaTaxista() {
  const t = useTranslations('Mobilidade')
  const [itens, setItens] = useState<AtendimentoDiaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [abertoId, setAbertoId] = useState<string | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let ativo = true
    void (async () => {
      try {
        const res = await fetch('/api/mobilidade/atendimentos-dia')
        const json = (await res.json()) as {
          atendimentos?: AtendimentoDiaItem[]
          error?: string
        }
        if (!ativo) return
        if (!res.ok) {
          setErro(String(json.error ?? t('atendimentosErro')))
          return
        }
        setItens(Array.isArray(json.atendimentos) ? json.atendimentos : [])
      } catch {
        if (ativo) setErro(t('atendimentosErro'))
      } finally {
        if (ativo) setLoading(false)
      }
    })()
    return () => {
      ativo = false
    }
  }, [t])

  if (loading) {
    return <p className="px-1 py-4 text-center text-sm text-gray-500">{t('atendimentosCarregando')}</p>
  }

  if (erro) {
    return <p className="px-1 py-2 text-center text-sm text-rose-600">{erro}</p>
  }

  if (itens.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-white/40 bg-[#0097b2]/80 px-3 py-6 text-center text-sm text-white/90">
        {t('atendimentosVazio')}
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {itens.map((a) => {
        const aberto = abertoId === a.solicitacao_id
        const nome = a.turista_nome || t('atendimentoTurista')
        const user = a.turista_username
          ? `@${String(a.turista_username).replace(/^@+/, '')}`
          : null
        return (
          <li key={a.solicitacao_id}>
            <button
              type="button"
              onClick={() => setAbertoId(aberto ? null : a.solicitacao_id)}
              className="flex w-full items-center gap-3 rounded-xl bg-[#0097b2] px-3 py-3 text-left text-white shadow-sm"
            >
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-white/20 ring-2 ring-white/50">
                {a.turista_foto ? (
                  <AvatarImage src={a.turista_foto} alt="" fill className="object-cover" sizes="44px" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{nome}</p>
                {user ? <p className="truncate text-xs text-white/85">{user}</p> : null}
              </div>
              {aberto ? (
                <ChevronUp className="h-5 w-5 shrink-0 text-white" aria-hidden />
              ) : (
                <ChevronDown className="h-5 w-5 shrink-0 text-white" aria-hidden />
              )}
            </button>
            {aberto ? (
              <div className="mt-1 space-y-1 rounded-xl bg-[#007a8f] px-3 py-3 text-sm text-white">
                <p>
                  <span className="font-semibold text-white/80">{t('origemLabel')}: </span>
                  {a.origem_nome || '—'}
                </p>
                <p>
                  <span className="font-semibold text-white/80">{t('destinoLabel')}: </span>
                  {a.destino_nome || '—'}
                </p>
                <p>
                  <span className="font-semibold text-white/80">{t('atendimentoValor')}: </span>
                  {a.valor_estimado != null ? formatBrl(a.valor_estimado) : '—'}
                </p>
                <p className="text-xs uppercase tracking-wide text-white/70">{a.status}</p>
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
