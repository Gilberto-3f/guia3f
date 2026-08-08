'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import { profissionalTemCategoriaMobilidade } from '@/lib/mobilidadeStatusProfissional'
import {
  JUSTIFICATIVAS_RECUSA_MOBILIDADE,
  type JustificativaRecusaMobilidadeId,
} from '@/lib/mobilidadeRecusaJustificativas'
import {
  profissionalChegouNaPartida,
  RAIO_CHEGADA_METROS,
} from '@/lib/mobilidadeChegada'
import AvaliacaoCorridaMobilidade from '@/components/mobilidade/AvaliacaoCorridaMobilidade'
import DrawerAtendimentoMobilidade, {
  type OfertaAtendimentoUi,
} from '@/components/mobilidade/DrawerAtendimentoMobilidade'
import DrawerAtendimentoAtivoMobilidade, {
  type AtendimentoAtivoUi,
} from '@/components/mobilidade/DrawerAtendimentoAtivoMobilidade'
import PopupChegadaProfissionalMobilidade from '@/components/mobilidade/PopupChegadaProfissionalMobilidade'
import {
  avisarCorridaAtivaAtualizada,
  ehAtendimentoImediatoAtivo,
  MOBILIDADE_ABRIR_DRAWER_ATIVO,
} from '@/lib/mobilidadeAtendimentoAtivoEventos'

type Oferta = OfertaAtendimentoUi & {
  /** Marcador interno: confirmação de agendamento (API dedicada). */
  _fluxo?: 'oferta' | 'agendamento_confirmacao'
}

export type CorridaAtivaMobilidade = {
  solicitacao_id: string
  status?: string | null
  origem_nome: string | null
  destino_nome: string | null
  modalidade: string | null
  valor_estimado: number | null
  pagamento: string | null
  lugares?: number | null
  data_agendada?: string | null
  conversa_id: string | null
  manifesto_id: string | null
  lat_origem?: number | null
  lng_origem?: number | null
  lat_destino?: number | null
  lng_destino?: number | null
  prof_lat?: number | null
  prof_lng?: number | null
  turista?: {
    usuario_id: string
    nome: string
    username: string | null
    foto_url: string | null
    verificado: boolean
    nota_media: number | null
  } | null
}

type Props = {
  /** Notifica a página (mapa: trajeto profissional → partida). */
  onCorridaChange?: (corrida: CorridaAtivaMobilidade | null) => void
}

function formatBrl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Pré-aceite + chat + concluir corrida (manifesto). */
export default function OfertaMobilidadeListener({ onCorridaChange }: Props = {}) {
  const t = useTranslations('Mobilidade')
  const { perfilEhProfissional, recursosProfissionaisLiberados, profRow, loading } =
    useProfissionalGate()
  const [oferta, setOferta] = useState<Oferta | null>(null)
  const [busy, setBusy] = useState(false)
  const [seg, setSeg] = useState<number | null>(null)
  const [mostrarRecusa, setMostrarRecusa] = useState(false)
  const [justificativa, setJustificativa] = useState<JustificativaRecusaMobilidadeId | null>(null)
  const [justificativaDetalhe, setJustificativaDetalhe] = useState('')
  const [erroRecusa, setErroRecusa] = useState('')
  const [corrida, setCorrida] = useState<CorridaAtivaMobilidade | null>(null)
  const [erroConcluir, setErroConcluir] = useState('')
  const [recebiDinheiro, setRecebiDinheiro] = useState(false)
  const [bonus, setBonus] = useState('')
  const [resumoFin, setResumoFin] = useState<string | null>(null)
  const [solicitacaoAvaliar, setSolicitacaoAvaliar] = useState<string | null>(null)
  const [erroChegada, setErroChegada] = useState('')
  const [drawerAtivoAberto, setDrawerAtivoAberto] = useState(true)
  const detectandoChegadaRef = useRef(false)

  const categoriasProf = (() => {
    const raw = profRow as { categorias?: unknown } | null
    return Array.isArray(raw?.categorias) ? raw.categorias.map(String) : []
  })()

  const elegivel =
    !loading &&
    perfilEhProfissional &&
    recursosProfissionaisLiberados &&
    profissionalTemCategoriaMobilidade(categoriasProf)

  const carregarCorrida = useCallback(async () => {
    if (!elegivel) return
    try {
      const res = await fetch('/api/mobilidade/corrida-ativa')
      if (res.status === 401 || res.status === 403) return 'auth' as const
      const json = (await res.json()) as { corrida?: CorridaAtivaMobilidade | null }
      if (!res.ok) return 'ok' as const
      const next = json.corrida ?? null
      setCorrida((prev) => {
        if (next?.solicitacao_id && next.solicitacao_id !== prev?.solicitacao_id) {
          queueMicrotask(() => setDrawerAtivoAberto(true))
        }
        return next
      })
    } catch {
      /* ignore */
    }
    return 'ok' as const
  }, [elegivel])

  const carregarOferta = useCallback(async () => {
    if (!elegivel || corrida) return 'ok' as const
    try {
      const [rOferta, rAg] = await Promise.all([
        fetch('/api/mobilidade/ofertas-pendentes'),
        fetch('/api/mobilidade/agendamentos-pendentes'),
      ])
      if (
        rOferta.status === 401 ||
        rOferta.status === 403 ||
        rAg.status === 401 ||
        rAg.status === 403
      ) {
        return 'auth' as const
      }
      const json = (await rOferta.json()) as { ofertas?: OfertaAtendimentoUi[] }
      const jag = (await rAg.json()) as {
        agendamentos?: Array<{
          solicitacao_id: string
          status: string
          modalidade: string | null
          origem_nome: string | null
          destino_nome: string | null
          valor_estimado: number | null
          lugares: number | null
          pagamento: string | null
          data_agendada: string | null
          contratacao_direcionada?: boolean
          turista?: OfertaAtendimentoUi['turista']
          recomendacao?: OfertaAtendimentoUi['recomendacao']
        }>
      }
      if (rAg.ok && Array.isArray(jag.agendamentos)) {
        const conf = jag.agendamentos.find((a) => a.status === 'aguardando_confirmacao')
        if (conf) {
          setOferta({
            solicitacao_id: conf.solicitacao_id,
            modalidade: conf.modalidade ?? 'agendamento',
            origem_nome: conf.origem_nome,
            destino_nome: conf.destino_nome,
            valor_estimado: conf.valor_estimado,
            lugares: conf.lugares,
            pagamento: conf.pagamento ?? null,
            data_agendada: conf.data_agendada,
            cruzamento_fronteira: false,
            oferta_expira_em: conf.data_agendada,
            distancia_km: 0,
            contratacao_direcionada: Boolean(conf.contratacao_direcionada),
            turista: conf.turista ?? null,
            recomendacao: conf.recomendacao ?? null,
            _fluxo: 'agendamento_confirmacao',
          })
          return 'ok' as const
        }
      }
      if (!rOferta.ok) return 'ok' as const
      const first = Array.isArray(json.ofertas) && json.ofertas[0] ? json.ofertas[0] : null
      setOferta(first ? { ...first, _fluxo: 'oferta' } : null)
    } catch {
      /* ignore */
    }
    return 'ok' as const
  }, [elegivel, corrida])

  useEffect(() => {
    if (!elegivel) return
    let ativo = true
    let id: ReturnType<typeof setInterval> | null = null
    const boot = window.setTimeout(() => {
      if (!ativo) return
      void (async () => {
        const st = await carregarCorrida()
        if (!ativo || st === 'auth') return
        id = setInterval(() => {
          void (async () => {
            const s = await carregarCorrida()
            if (s === 'auth' && id) clearInterval(id)
          })()
        }, 25_000)
      })()
    }, 2000)
    return () => {
      ativo = false
      window.clearTimeout(boot)
      if (id) clearInterval(id)
    }
  }, [elegivel, carregarCorrida])

  useEffect(() => {
    if (!elegivel || corrida) return
    let ativo = true
    let id: ReturnType<typeof setInterval> | null = null
    const boot = window.setTimeout(() => {
      if (!ativo) return
      void (async () => {
        const st = await carregarOferta()
        if (!ativo || st === 'auth') return
        id = setInterval(() => {
          void (async () => {
            const s = await carregarOferta()
            if (s === 'auth' && id) clearInterval(id)
          })()
        }, 20_000)
      })()
    }, 2500)
    return () => {
      ativo = false
      window.clearTimeout(boot)
      if (id) clearInterval(id)
    }
  }, [elegivel, carregarOferta, corrida])

  useEffect(() => {
    if (!oferta?.oferta_expira_em || oferta._fluxo === 'agendamento_confirmacao') {
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
  }, [oferta?.oferta_expira_em, oferta?._fluxo])

  useEffect(() => {
    onCorridaChange?.(corrida)
  }, [corrida, onCorridaChange])

  useEffect(() => {
    if (!elegivel) onCorridaChange?.(null)
  }, [elegivel, onCorridaChange])

  useEffect(() => {
    if (!corrida) return
    const onAbrir = () => setDrawerAtivoAberto(true)
    window.addEventListener(MOBILIDADE_ABRIR_DRAWER_ATIVO, onAbrir)
    return () => window.removeEventListener(MOBILIDADE_ABRIR_DRAWER_ATIVO, onAbrir)
  }, [corrida])

  /** GPS automático: a_caminho → detectar proximidade da partida. */
  useEffect(() => {
    const st = String(corrida?.status ?? '')
    if (!corrida || (st !== 'a_caminho' && st !== 'aceita')) return
    const oLat = corrida.lat_origem
    const oLng = corrida.lng_origem
    if (oLat == null || oLng == null || !Number.isFinite(oLat) || !Number.isFinite(oLng)) return

    let cancelled = false

    const tentar = async () => {
      if (cancelled || detectandoChegadaRef.current) return
      if (typeof navigator === 'undefined' || !navigator.geolocation) return
      detectandoChegadaRef.current = true
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 12000,
            maximumAge: 10_000,
          })
        })
        if (cancelled) return
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        if (
          !profissionalChegouNaPartida({
            profLat: lat,
            profLng: lng,
            origemLat: oLat,
            origemLng: oLng,
            raioMetros: RAIO_CHEGADA_METROS,
          })
        ) {
          return
        }
        const res = await fetch(`/api/mobilidade/solicitar/${corrida.solicitacao_id}/chegada`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ acao: 'detectar', lat, lng }),
        })
        if (res.ok) await carregarCorrida()
      } catch {
        /* ignore GPS failures */
      } finally {
        detectandoChegadaRef.current = false
      }
    }

    void tentar()
    const id = setInterval(() => void tentar(), 12_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [
    corrida?.solicitacao_id,
    corrida?.status,
    corrida?.lat_origem,
    corrida?.lng_origem,
    carregarCorrida,
  ])

  const confirmarEmbarque = async (recebido: boolean) => {
    if (!corrida || busy) return
    setBusy(true)
    setErroChegada('')
    try {
      const res = await fetch(`/api/mobilidade/solicitar/${corrida.solicitacao_id}/chegada`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: recebido ? 'confirmar' : 'recusar' }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        setErroChegada(String(json.error ?? t('chegadaErro')))
        return
      }
      if (!recebido) {
        setCorrida(null)
        avisarCorridaAtivaAtualizada()
        void carregarOferta()
        return
      }
      await carregarCorrida()
      avisarCorridaAtivaAtualizada()
    } finally {
      setBusy(false)
    }
  }

  const enviarAceite = async () => {
    if (!oferta) return false

    if (oferta._fluxo === 'agendamento_confirmacao') {
      const res = await fetch(`/api/mobilidade/agendamento/${oferta.solicitacao_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'confirmar' }),
      })
      if (!res.ok) {
        const json = (await res.json()) as { error?: string }
        setErroRecusa(String(json.error ?? t('aceiteErro')))
        return false
      }
      setOferta(null)
      await carregarCorrida()
      avisarCorridaAtivaAtualizada()
      return true
    }

    const res = await fetch('/api/mobilidade/oferta/responder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        solicitacao_id: oferta.solicitacao_id,
        aceitar: true,
      }),
    })
    if (!res.ok) {
      const json = (await res.json()) as { error?: string }
      setErroRecusa(String(json.error ?? t('aceiteErro')))
      return false
    }
    setOferta(null)
    await carregarCorrida()
    avisarCorridaAtivaAtualizada()
    return true
  }

  const aceitar = async () => {
    if (!oferta || busy) return
    setMostrarRecusa(false)
    setErroRecusa('')
    // Guia/van: manifesto usa dados do cadastro do turista (sem formulário manual).
    setBusy(true)
    try {
      await enviarAceite()
    } finally {
      setBusy(false)
    }
  }

  const confirmarRecusa = async () => {
    if (!oferta || busy) return
    if (!justificativa) {
      setErroRecusa(t('recusaEscolhaObrigatoria'))
      return
    }
    if (justificativa === 'outro' && !justificativaDetalhe.trim()) {
      setErroRecusa(t('recusaOutroObrigatorio'))
      return
    }
    setBusy(true)
    setErroRecusa('')
    try {
      if (oferta._fluxo === 'agendamento_confirmacao') {
        const res = await fetch(`/api/mobilidade/agendamento/${oferta.solicitacao_id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            acao: 'cancelar',
            rematch: true,
            justificativa,
            justificativa_detalhe: justificativaDetalhe.trim() || null,
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
        setJustificativaDetalhe('')
        void carregarOferta()
        return
      }
      const res = await fetch('/api/mobilidade/oferta/responder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          solicitacao_id: oferta.solicitacao_id,
          aceitar: false,
          justificativa,
          justificativa_detalhe: justificativaDetalhe.trim() || null,
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
      setJustificativaDetalhe('')
      void carregarOferta()
    } finally {
      setBusy(false)
    }
  }

  const concluir = async (forcar = false) => {
    if (!corrida || busy) return
    if (!recebiDinheiro && (corrida.pagamento == null || corrida.pagamento === 'dinheiro')) {
      setErroConcluir(t('pagConfirmeDinheiro'))
      return
    }
    setBusy(true)
    setErroConcluir('')
    try {
      const res = await fetch(`/api/mobilidade/solicitar/${corrida.solicitacao_id}/concluir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          forcar: forcar || undefined,
          pagamento_confirmado: recebiDinheiro,
          bonus_voluntario: bonus.trim() ? Number(bonus.replace(',', '.')) || 0 : 0,
        }),
      })
      const json = (await res.json()) as {
        error?: string
        manifesto_pendente_checkin?: boolean
        financeiro?: {
          valorCorrida?: number
          valorRegular?: number
          bonusVoluntario?: number
        } | null
      }
      if (!res.ok) {
        setErroConcluir(String(json.error ?? t('concluirErro')))
        return
      }
      if (json.financeiro) {
        const parts = [
          json.financeiro.valorCorrida != null
            ? t('finValorCorrida', { v: formatBrl(json.financeiro.valorCorrida) })
            : null,
          json.financeiro.valorRegular != null && json.financeiro.valorRegular > 0
            ? t('finSuaComissao', { v: formatBrl(json.financeiro.valorRegular) })
            : null,
          json.financeiro.bonusVoluntario != null && json.financeiro.bonusVoluntario > 0
            ? t('finBonus', { v: formatBrl(json.financeiro.bonusVoluntario) })
            : null,
        ].filter(Boolean)
        setResumoFin(parts.join(' · ') || t('corridaConcluida'))
      } else {
        setResumoFin(t('corridaConcluida'))
      }
      setSolicitacaoAvaliar(corrida.solicitacao_id)
      setCorrida(null)
      avisarCorridaAtivaAtualizada()
      setErroConcluir('')
      setRecebiDinheiro(false)
      setBonus('')
    } finally {
      setBusy(false)
    }
  }

  if (!elegivel) return null

  if (resumoFin) {
    return (
      <div className="fixed inset-x-3 bottom-24 z-[70] rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-black/10 sm:inset-x-auto sm:right-4 sm:w-96">
        <p className="text-sm font-bold text-[#00D443]">{t('corridaConcluida')}</p>
        <p className="mt-2 text-xs text-gray-600">{resumoFin}</p>
        <p className="mt-1 text-[11px] text-gray-400">{t('finExtratoHint')}</p>
        {solicitacaoAvaliar ? (
          <div className="mt-3">
            <AvaliacaoCorridaMobilidade
              solicitacaoId={solicitacaoAvaliar}
              titulo={t('avaliacaoTuristaTitulo')}
            />
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setResumoFin(null)
            setSolicitacaoAvaliar(null)
          }}
          className="mt-3 w-full rounded-xl bg-[#0097b2] py-2.5 text-sm font-bold text-white"
        >
          {t('fechar')}
        </button>
      </div>
    )
  }

  if (corrida) {
    const st = String(corrida.status ?? 'a_caminho')
    const atendimentoAtivo: AtendimentoAtivoUi = {
      solicitacao_id: corrida.solicitacao_id,
      status: st,
      origem_nome: corrida.origem_nome,
      destino_nome: corrida.destino_nome,
      valor_estimado: corrida.valor_estimado,
      pagamento: corrida.pagamento,
      lugares: corrida.lugares ?? null,
      data_agendada: corrida.data_agendada ?? null,
      modalidade: corrida.modalidade,
      conversa_id: corrida.conversa_id,
      manifesto_id: corrida.manifesto_id,
      parte: corrida.turista
        ? {
            nome: corrida.turista.nome,
            username: corrida.turista.username,
            foto_url: corrida.turista.foto_url,
            verificado: corrida.turista.verificado,
            nota_media: corrida.turista.nota_media,
          }
        : null,
    }

    const rodapePagamento = (
      <div className="mb-3 space-y-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
        <label className="flex items-start gap-2 text-xs text-gray-700">
          <input
            type="checkbox"
            checked={recebiDinheiro}
            onChange={(e) => setRecebiDinheiro(e.target.checked)}
            className="mt-0.5"
          />
          <span>{t('pagRecebiDinheiro')}</span>
        </label>
        <label className="block text-xs text-gray-600">
          {t('bonusLabel')}
          <input
            type="number"
            min={0}
            step="0.01"
            value={bonus}
            onChange={(e) => setBonus(e.target.value)}
            placeholder="0,00"
            className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
          />
        </label>
      </div>
    )

    return (
      <>
        <DrawerAtendimentoAtivoMobilidade
          aberto={drawerAtivoAberto}
          papel="profissional"
          atendimento={atendimentoAtivo}
          busy={busy}
          erroConcluir={erroConcluir || null}
          rodapeExtra={rodapePagamento}
          onFechar={() => setDrawerAtivoAberto(false)}
          onConcluir={() => void concluir(false)}
          onConcluirSemManifesto={() => void concluir(true)}
        />
        {!drawerAtivoAberto &&
        !ehAtendimentoImediatoAtivo({
          status: st,
          data_agendada: corrida.data_agendada,
        }) ? (
          <button
            type="button"
            onClick={() => setDrawerAtivoAberto(true)}
            className="fixed inset-x-3 bottom-24 z-[70] rounded-2xl px-4 py-3 text-left text-sm font-bold text-white shadow-2xl sm:inset-x-auto sm:right-4 sm:w-96"
            style={{ backgroundColor: st === 'em_viagem' || st === 'no_local' ? '#00D443' : '#0097b2' }}
          >
            {t('drawerAtivoReabrir')}
          </button>
        ) : null}
        <PopupChegadaProfissionalMobilidade
          aberto={st === 'no_local'}
          busy={busy}
          erro={erroChegada}
          onSim={() => void confirmarEmbarque(true)}
          onNao={() => void confirmarEmbarque(false)}
        />
      </>
    )
  }

  if (!oferta) return null

  const painelRecusa = mostrarRecusa ? (
    <div
      className="mb-2 space-y-3 rounded-2xl px-3 py-3 text-white shadow-md"
      style={{ backgroundColor: '#0097b2' }}
    >
      <p className="text-xs font-semibold text-white">{t('recusaTitulo')}</p>
      <ul className="space-y-1.5">
        {JUSTIFICATIVAS_RECUSA_MOBILIDADE.map((id) => (
          <li key={id}>
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-white/30 bg-white/10 px-2.5 py-2 text-xs text-white">
              <input
                type="radio"
                name="just-recusa"
                checked={justificativa === id}
                onChange={() => {
                  setJustificativa(id)
                  if (id !== 'outro') setJustificativaDetalhe('')
                }}
                className="mt-0.5 accent-white"
              />
              <span>{t(`recusa.${id}`)}</span>
            </label>
          </li>
        ))}
      </ul>
      {justificativa === 'outro' ? (
        <label className="block text-xs text-white/90">
          {t('recusaOutroLabel')}
          <textarea
            value={justificativaDetalhe}
            onChange={(e) => setJustificativaDetalhe(e.target.value)}
            rows={2}
            maxLength={280}
            placeholder={t('recusaOutroPlaceholder')}
            className="mt-1 w-full rounded-lg border border-white/40 bg-white px-2.5 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-white/50"
          />
        </label>
      ) : null}
      {erroRecusa ? <p className="text-xs font-medium text-amber-200">{erroRecusa}</p> : null}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setMostrarRecusa(false)
            setErroRecusa('')
            setJustificativaDetalhe('')
          }}
          className="flex-1 rounded-xl bg-white py-2.5 text-sm font-semibold text-[#0097b2] disabled:opacity-50"
        >
          {t('voltar')}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void confirmarRecusa()}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white py-2.5 text-sm font-bold uppercase text-[#0097b2] disabled:opacity-50"
        >
          {t('ofertaRecusar')}
        </button>
      </div>
    </div>
  ) : null

  return (
    <>
      <DrawerAtendimentoMobilidade
        oferta={oferta}
        busy={busy}
        segundosRestantes={oferta._fluxo === 'agendamento_confirmacao' ? null : seg}
        ocultarBotoes={mostrarRecusa}
        rodapeExtra={painelRecusa}
        onAceitar={() => void aceitar()}
        onRecusar={() => {
          setMostrarRecusa(true)
          setJustificativa(null)
          setJustificativaDetalhe('')
          setErroRecusa('')
        }}
      />
    </>
  )
}
