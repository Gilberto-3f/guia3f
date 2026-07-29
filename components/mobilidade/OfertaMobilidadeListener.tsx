'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import { profissionalTemCategoriaMobilidade } from '@/lib/mobilidadeStatusProfissional'

type Oferta = {
  solicitacao_id: string
  modalidade: string | null
  origem_nome: string | null
  destino_nome: string | null
  valor_estimado: number | null
  lugares: number | null
  cruzamento_fronteira: boolean
  oferta_expira_em: string | null
  distancia_km: number
}

function formatBrl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Pré-aceite in-app para profissional online. */
export default function OfertaMobilidadeListener() {
  const t = useTranslations('Mobilidade')
  const { perfilEhProfissional, recursosProfissionaisLiberados, profRow, loading } =
    useProfissionalGate()
  const [oferta, setOferta] = useState<Oferta | null>(null)
  const [busy, setBusy] = useState(false)
  const [seg, setSeg] = useState<number | null>(null)

  const elegivel =
    !loading &&
    perfilEhProfissional &&
    recursosProfissionaisLiberados &&
    profissionalTemCategoriaMobilidade(
      Array.isArray(profRow?.categorias) ? (profRow.categorias as string[]) : [],
    )

  const carregar = useCallback(async () => {
    if (!elegivel) return
    try {
      const res = await fetch('/api/mobilidade/ofertas-pendentes')
      const json = (await res.json()) as { ofertas?: Oferta[] }
      if (!res.ok) return
      const first = Array.isArray(json.ofertas) && json.ofertas[0] ? json.ofertas[0] : null
      setOferta(first)
    } catch {
      /* ignore */
    }
  }, [elegivel])

  useEffect(() => {
    if (!elegivel) return
    void carregar()
    const id = setInterval(() => void carregar(), 3000)
    return () => clearInterval(id)
  }, [elegivel, carregar])

  useEffect(() => {
    if (!oferta?.oferta_expira_em) {
      setSeg(null)
      return
    }
    const tick = () => {
      const ms = new Date(oferta.oferta_expira_em!).getTime() - Date.now()
      setSeg(Math.max(0, Math.ceil(ms / 1000)))
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [oferta?.oferta_expira_em])

  const responder = async (aceitar: boolean) => {
    if (!oferta || busy) return
    setBusy(true)
    try {
      await fetch('/api/mobilidade/oferta/responder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          solicitacao_id: oferta.solicitacao_id,
          aceitar,
          justificativa: aceitar ? null : 'recusa_rapida',
        }),
      })
      setOferta(null)
      void carregar()
    } finally {
      setBusy(false)
    }
  }

  if (!elegivel || !oferta) return null

  const warn = seg != null && seg <= 15

  return (
    <div className="fixed inset-x-3 bottom-24 z-[70] rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-black/10 sm:inset-x-auto sm:right-4 sm:w-96">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-[#0097b2]">{t('ofertaProfTitulo')}</p>
          <p className="mt-1 text-xs text-gray-500">
            {oferta.origem_nome || '—'} → {oferta.destino_nome || '—'}
          </p>
        </div>
        {seg != null ? (
          <span
            className={`rounded-full px-2 py-1 text-xs font-bold text-white ${
              warn ? 'bg-amber-400' : 'bg-[#0097b2]'
            }`}
          >
            {seg}s
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-sm text-gray-700">
        {oferta.modalidade || '—'}
        {oferta.valor_estimado != null ? ` · ${formatBrl(oferta.valor_estimado)}` : ''}
        {` · ${oferta.lugares ?? 1} pax`}
        {` · ~${oferta.distancia_km} km`}
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void responder(false)}
          className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700"
        >
          {t('ofertaRecusar')}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void responder(true)}
          className="flex-1 rounded-xl bg-[#00D443] py-2.5 text-sm font-bold text-white"
        >
          {t('ofertaAceitar')}
        </button>
      </div>
    </div>
  )
}
