'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import { useModalScrollLock } from '@/lib/useModalScrollLock'
import {
  MOBILIDADE_OFERTA_TIMEOUT_MS,
  MOBILIDADE_OFERTA_WARN_MS,
} from '@/lib/mobilidadeMatching'
import ChatCorridaMobilidade from '@/components/mobilidade/ChatCorridaMobilidade'
import AvaliacaoCorridaMobilidade from '@/components/mobilidade/AvaliacaoCorridaMobilidade'

export type OfertaResultadoUi = {
  profissionalId: string
  nome: string
  username: string | null
  fotoUrl: string | null
  distanciaKm: number
  expiraEm: string
}

export type ResultadoCorridaMobilidade = {
  solicitacaoId: string
  status: string
  oferta: OfertaResultadoUi | null
  backupsOcultos: number
  matchErro?: string
  dataHoraAgendada?: string
}

type Props = {
  aberto: boolean
  resultado: ResultadoCorridaMobilidade | null
  onFechar: () => void
  onReabrirAgendar?: () => void
}

/**
 * Popup leve na página Mobilidade após PROCURAR nos drawers.
 * (Trajeto/ETA no mapa ficam para fase futura.)
 */
export default function PopupResultadoCorridaMobilidade({
  aberto,
  resultado,
  onFechar,
  onReabrirAgendar,
}: Props) {
  const t = useTranslations('Mobilidade')
  useModalScrollLock(aberto)

  const [matchStatus, setMatchStatus] = useState<string | null>(null)
  const [oferta, setOferta] = useState<OfertaResultadoUi | null>(null)
  const [backups, setBackups] = useState(0)
  const [buscando, setBuscando] = useState(false)
  const [segRestantes, setSegRestantes] = useState<number | null>(null)
  const [conversaId, setConversaId] = useState<string | null>(null)
  const [matchErro, setMatchErro] = useState('')

  useEffect(() => {
    if (!aberto || !resultado) return
    setMatchStatus(resultado.status)
    setOferta(resultado.oferta)
    setBackups(resultado.backupsOcultos)
    setMatchErro(resultado.matchErro ?? '')
    setConversaId(null)
    const st = resultado.status
    setBuscando(
      Boolean(resultado.oferta) &&
        st !== 'aceita' &&
        st !== 'sem_profissional' &&
        st !== 'agendada' &&
        st !== 'aguardando_confirmacao',
    )
  }, [aberto, resultado])

  useEffect(() => {
    if (!aberto || !resultado?.solicitacaoId) return
    const solicitacaoId = resultado.solicitacaoId
    if (matchStatus === 'sem_profissional' || matchStatus === 'cancelada') return

    if (matchStatus === 'aceita') {
      if (!conversaId) {
        void fetch('/api/mobilidade/chat/abrir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ solicitacao_id: solicitacaoId }),
        })
          .then((r) => r.json())
          .then((j: { conversa_id?: string }) => {
            if (j.conversa_id) setConversaId(String(j.conversa_id))
          })
          .catch(() => {})
      }
      let cancelled = false
      const pollAceita = async () => {
        try {
          const res = await fetch(`/api/mobilidade/solicitar/${solicitacaoId}`)
          const json = (await res.json()) as Record<string, unknown>
          if (cancelled || !res.ok) return
          if (String(json.status ?? '') === 'concluida') {
            setMatchStatus('concluida')
            setBuscando(false)
          }
        } catch {
          /* ignore */
        }
      }
      void pollAceita()
      const id = setInterval(() => void pollAceita(), 4000)
      return () => {
        cancelled = true
        clearInterval(id)
      }
    }

    let cancelled = false
    const poll = async () => {
      try {
        const res = await fetch(`/api/mobilidade/solicitar/${solicitacaoId}`)
        const json = (await res.json()) as Record<string, unknown>
        if (cancelled || !res.ok) return
        const st = String(json.status ?? '')
        setMatchStatus(st)
        setBackups(Number(json.backups_ocultos ?? 0))
        const of = json.oferta as OfertaResultadoUi | null
        setOferta(of && of.profissionalId ? of : null)
        if (st === 'aceita' || st === 'sem_profissional') setBuscando(false)
        if (st === 'oferecida') setBuscando(true)
        const cid = json.conversa_id != null ? String(json.conversa_id).trim() : ''
        if (st === 'aceita' && cid) setConversaId(cid)
      } catch {
        /* ignore */
      }
    }

    void poll()
    const id = setInterval(() => void poll(), 2500)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [aberto, resultado?.solicitacaoId, matchStatus, conversaId])

  useEffect(() => {
    if (!oferta?.expiraEm || matchStatus !== 'oferecida') {
      setSegRestantes(null)
      return
    }
    const tick = () => {
      const ms = new Date(oferta.expiraEm).getTime() - Date.now()
      setSegRestantes(Math.max(0, Math.ceil(ms / 1000)))
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [oferta?.expiraEm, matchStatus])

  if (!aberto || !resultado) return null

  const dataHora = resultado.dataHoraAgendada ?? ''
  const warnAmarelo =
    segRestantes != null &&
    segRestantes * 1000 <= MOBILIDADE_OFERTA_TIMEOUT_MS - MOBILIDADE_OFERTA_WARN_MS

  const mostrarFechar =
    matchStatus === 'aceita' ||
    matchStatus === 'sem_profissional' ||
    matchStatus === 'concluida' ||
    matchStatus === 'agendada' ||
    matchStatus === 'aguardando_confirmacao' ||
    matchStatus === 'cancelada' ||
    Boolean(matchErro)

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center">
      <div
        className="flex max-h-[min(85dvh,36rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="resultado-corrida-titulo"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 id="resultado-corrida-titulo" className="text-base font-bold text-[#0097b2]">
            {t('resultadoTitulo')}
          </h2>
          <button
            type="button"
            onClick={onFechar}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            aria-label={t('fechar')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3" data-modal-scroll-lock-scrollable>
          <div className="space-y-3 py-1 text-center">
            {matchErro ? <p className="text-sm text-rose-600">{matchErro}</p> : null}

            {matchStatus === 'agendada' || matchStatus === 'aguardando_confirmacao' ? (
              <div className="space-y-3 rounded-xl border-2 border-[#0097b2] bg-[#0097b2]/10 px-3 py-4 text-left">
                <p className="text-center text-sm font-bold text-[#0097b2]">{t('agendamentoTitulo')}</p>
                <p className="text-sm text-gray-600">{t('agendamentoDesc')}</p>
                {oferta?.nome ? <p className="font-semibold text-gray-900">{oferta.nome}</p> : null}
                {dataHora ? (
                  <p className="text-xs text-gray-500">
                    {new Date(dataHora.length === 16 ? `${dataHora}:00` : dataHora).toLocaleString()}
                  </p>
                ) : null}
                {resultado.solicitacaoId ? (
                  <button
                    type="button"
                    onClick={() => {
                      void (async () => {
                        await fetch(`/api/mobilidade/agendamento/${resultado.solicitacaoId}`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ acao: 'cancelar' }),
                        })
                        setMatchStatus('cancelada')
                        setOferta(null)
                      })()
                    }}
                    className="w-full text-sm font-semibold text-rose-600 underline"
                  >
                    {t('agendamentoCancelar')}
                  </button>
                ) : null}
              </div>
            ) : null}

            {matchStatus === 'concluida' ? (
              <div className="space-y-3">
                <div className="rounded-xl border-2 border-[#0097b2] bg-[#0097b2]/10 px-3 py-4">
                  <p className="text-center text-sm font-bold text-[#0097b2]">{t('corridaConcluida')}</p>
                </div>
                {resultado.solicitacaoId ? (
                  <AvaliacaoCorridaMobilidade solicitacaoId={resultado.solicitacaoId} />
                ) : null}
              </div>
            ) : null}

            {matchStatus === 'aceita' && oferta ? (
              <div className="space-y-3 text-left">
                <div className="rounded-xl border-2 border-[#00D443] bg-green-50 px-3 py-4">
                  <p className="text-center text-sm font-bold text-[#00D443]">{t('matchAceito')}</p>
                  <p className="mt-2 font-semibold text-gray-900">{oferta.nome}</p>
                  {oferta.username ? (
                    <p className="text-sm text-gray-500">
                      @{String(oferta.username).replace(/^@+/, '')}
                    </p>
                  ) : null}
                </div>
                {conversaId ? <ChatCorridaMobilidade conversaId={conversaId} /> : null}
              </div>
            ) : null}

            {(matchStatus === 'oferecida' || buscando) && oferta ? (
              <div className="rounded-xl border border-gray-200 px-3 py-4 text-left">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-gray-800">{t('matchOfertaTitulo')}</p>
                  {segRestantes != null ? (
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold tabular-nums text-white ${
                        warnAmarelo ? 'bg-amber-400' : 'bg-[#0097b2]'
                      }`}
                    >
                      {segRestantes}s
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 font-semibold text-gray-900">{oferta.nome}</p>
                {oferta.username ? (
                  <p className="text-sm text-gray-500">
                    @{String(oferta.username).replace(/^@+/, '')}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-gray-500">
                  ~{oferta.distanciaKm} km · {t('matchBackups', { n: backups })}
                </p>
                <p className="mt-2 text-xs text-gray-400">{t('matchAguardandoAceite')}</p>
              </div>
            ) : null}

            {buscando && !oferta && matchStatus !== 'sem_profissional' ? (
              <>
                <div className="mx-auto h-10 w-10 animate-pulse rounded-full bg-[#0097b2]/30" />
                <p className="font-semibold text-gray-800">{t('procurandoProfissional')}</p>
              </>
            ) : null}

            {matchStatus === 'sem_profissional' && !oferta ? (
              <>
                <p className="font-semibold text-gray-800">{t('semProfissionalTitulo')}</p>
                <p className="text-sm text-gray-500">{t('semProfissionalDesc')}</p>
                {dataHora ? (
                  <p className="text-xs text-[#0097b2]">{t('agendamentoRegistradoLocal')}</p>
                ) : onReabrirAgendar ? (
                  <button
                    type="button"
                    onClick={onReabrirAgendar}
                    className="text-sm font-semibold text-[#0097b2] underline"
                  >
                    {t('voltarAgendar')}
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        {mostrarFechar ? (
          <div className="shrink-0 border-t border-gray-100 p-3">
            <button
              type="button"
              onClick={onFechar}
              className="w-full rounded-xl bg-[#0097b2] py-3 text-sm font-bold uppercase text-white"
            >
              {t('fechar')}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
