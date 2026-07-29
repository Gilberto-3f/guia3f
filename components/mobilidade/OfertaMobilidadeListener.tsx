'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import { profissionalTemCategoriaMobilidade } from '@/lib/mobilidadeStatusProfissional'
import {
  JUSTIFICATIVAS_RECUSA_MOBILIDADE,
  type JustificativaRecusaMobilidadeId,
} from '@/lib/mobilidadeRecusaJustificativas'
import ChatCorridaMobilidade from '@/components/mobilidade/ChatCorridaMobilidade'

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

type CorridaAtiva = {
  solicitacao_id: string
  origem_nome: string | null
  destino_nome: string | null
  modalidade: string | null
  valor_estimado: number | null
  conversa_id: string | null
  manifesto_id: string | null
}

function formatBrl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Pré-aceite + chat + concluir corrida (manifesto). */
export default function OfertaMobilidadeListener() {
  const t = useTranslations('Mobilidade')
  const { perfilEhProfissional, recursosProfissionaisLiberados, profRow, loading } =
    useProfissionalGate()
  const [oferta, setOferta] = useState<Oferta | null>(null)
  const [busy, setBusy] = useState(false)
  const [seg, setSeg] = useState<number | null>(null)
  const [mostrarRecusa, setMostrarRecusa] = useState(false)
  const [justificativa, setJustificativa] = useState<JustificativaRecusaMobilidadeId | null>(null)
  const [erroRecusa, setErroRecusa] = useState('')
  const [corrida, setCorrida] = useState<CorridaAtiva | null>(null)
  const [erroConcluir, setErroConcluir] = useState('')

  const elegivel =
    !loading &&
    perfilEhProfissional &&
    recursosProfissionaisLiberados &&
    profissionalTemCategoriaMobilidade(
      Array.isArray(profRow?.categorias) ? (profRow.categorias as string[]) : [],
    )

  const carregarCorrida = useCallback(async () => {
    if (!elegivel) return
    try {
      const res = await fetch('/api/mobilidade/corrida-ativa')
      const json = (await res.json()) as { corrida?: CorridaAtiva | null }
      if (!res.ok) return
      setCorrida(json.corrida ?? null)
    } catch {
      /* ignore */
    }
  }, [elegivel])

  const carregarOferta = useCallback(async () => {
    if (!elegivel || corrida) return
    try {
      const res = await fetch('/api/mobilidade/ofertas-pendentes')
      const json = (await res.json()) as { ofertas?: Oferta[] }
      if (!res.ok) return
      const first = Array.isArray(json.ofertas) && json.ofertas[0] ? json.ofertas[0] : null
      setOferta(first)
    } catch {
      /* ignore */
    }
  }, [elegivel, corrida])

  useEffect(() => {
    if (!elegivel) return
    void carregarCorrida()
    const id = setInterval(() => void carregarCorrida(), 4000)
    return () => clearInterval(id)
  }, [elegivel, carregarCorrida])

  useEffect(() => {
    if (!elegivel || corrida) return
    void carregarOferta()
    const id = setInterval(() => void carregarOferta(), 3000)
    return () => clearInterval(id)
  }, [elegivel, carregarOferta, corrida])

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

  const aceitar = async () => {
    if (!oferta || busy) return
    setBusy(true)
    setMostrarRecusa(false)
    try {
      const res = await fetch('/api/mobilidade/oferta/responder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          solicitacao_id: oferta.solicitacao_id,
          aceitar: true,
        }),
      })
      if (res.ok) {
        setOferta(null)
        await carregarCorrida()
      }
    } finally {
      setBusy(false)
    }
  }

  const confirmarRecusa = async () => {
    if (!oferta || busy || !justificativa) {
      setErroRecusa(t('recusaEscolhaObrigatoria'))
      return
    }
    setBusy(true)
    setErroRecusa('')
    try {
      const res = await fetch('/api/mobilidade/oferta/responder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          solicitacao_id: oferta.solicitacao_id,
          aceitar: false,
          justificativa,
        }),
      })
      if (!res.ok) {
        const json = (await res.json()) as { error?: string }
        setErroRecusa(String(json.error ?? t('recusaErro')))
        return
      }
      setOferta(null)
      setMostrarRecusa(false)
      setJustificativa(null)
      void carregarOferta()
    } finally {
      setBusy(false)
    }
  }

  const concluir = async (forcar = false) => {
    if (!corrida || busy) return
    setBusy(true)
    setErroConcluir('')
    try {
      const res = await fetch(`/api/mobilidade/solicitar/${corrida.solicitacao_id}/concluir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(forcar ? { forcar: true } : {}),
      })
      const json = (await res.json()) as {
        error?: string
        manifesto_pendente_checkin?: boolean
      }
      if (!res.ok) {
        setErroConcluir(String(json.error ?? t('concluirErro')))
        return
      }
      setCorrida(null)
      setErroConcluir('')
    } finally {
      setBusy(false)
    }
  }

  if (!elegivel) return null

  if (corrida) {
    return (
      <div className="fixed inset-x-3 bottom-24 z-[70] rounded-2xl bg-white p-3 shadow-2xl ring-1 ring-black/10 sm:inset-x-auto sm:right-4 sm:w-96">
        <div className="mb-2">
          <p className="text-sm font-bold text-[#00D443]">{t('corridaEmAndamento')}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {corrida.origem_nome || '—'} → {corrida.destino_nome || '—'}
          </p>
          {corrida.manifesto_id ? (
            <p className="mt-1 text-[11px] font-medium text-[#0097b2]">{t('manifestoRegistrado')}</p>
          ) : null}
        </div>
        {corrida.conversa_id ? (
          <ChatCorridaMobilidade conversaId={corrida.conversa_id} compact />
        ) : null}
        {erroConcluir ? (
          <div className="mt-2 space-y-1">
            <p className="text-xs text-rose-600">{erroConcluir}</p>
            {erroConcluir.toLowerCase().includes('check-in') ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void concluir(true)}
                className="text-xs font-semibold text-[#0097b2] underline"
              >
                {t('concluirSemManifesto')}
              </button>
            ) : null}
          </div>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => void concluir(false)}
          className="mt-3 w-full rounded-xl bg-[#0097b2] py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {t('concluirCorrida')}
        </button>
      </div>
    )
  }

  if (!oferta) return null

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

      {mostrarRecusa ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-semibold text-gray-700">{t('recusaTitulo')}</p>
          <ul className="space-y-1.5">
            {JUSTIFICATIVAS_RECUSA_MOBILIDADE.map((id) => (
              <li key={id}>
                <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 px-2.5 py-2 text-xs text-gray-700">
                  <input
                    type="radio"
                    name="just-recusa"
                    checked={justificativa === id}
                    onChange={() => setJustificativa(id)}
                    className="mt-0.5"
                  />
                  <span>{t(`recusa.${id}`)}</span>
                </label>
              </li>
            ))}
          </ul>
          {erroRecusa ? <p className="text-xs text-rose-600">{erroRecusa}</p> : null}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setMostrarRecusa(false)
                setErroRecusa('')
              }}
              className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700"
            >
              {t('voltar')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void confirmarRecusa()}
              className="flex-1 rounded-xl bg-rose-500 py-2.5 text-sm font-bold text-white"
            >
              {t('ofertaRecusar')}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setMostrarRecusa(true)
              setJustificativa(null)
              setErroRecusa('')
            }}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700"
          >
            {t('ofertaRecusar')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void aceitar()}
            className="flex-1 rounded-xl bg-[#00D443] py-2.5 text-sm font-bold text-white"
          >
            {t('ofertaAceitar')}
          </button>
        </div>
      )}
    </div>
  )
}
