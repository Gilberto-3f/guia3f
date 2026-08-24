'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import DrawerAtendimentoAtivoMobilidade, {
  type AtendimentoAtivoUi,
} from '@/components/mobilidade/DrawerAtendimentoAtivoMobilidade'
import PopupChegadaTuristaMobilidade from '@/components/mobilidade/PopupChegadaTuristaMobilidade'
import PopupFinalizacaoSemCheckinTurista from '@/components/mobilidade/PopupFinalizacaoSemCheckinTurista'
import {
  avisarCorridaTuristaPoll,
  ehAtendimentoImediatoAtivo,
  MOBILIDADE_ABRIR_DRAWER_ATIVO,
  MOBILIDADE_CORRIDA_ATIVA,
  avisarCorridaAtivaAtualizada,
} from '@/lib/mobilidadeAtendimentoAtivoEventos'
import { modalidadeUsaDeslocamentoProprio } from '@/lib/mobilidadeOfertaAtendimento'
import {
  MOBILIDADE_POLL_CORRIDA_ATIVA_MS,
  MOBILIDADE_POLL_CORRIDA_IDLE_MS,
} from '@/lib/mobilidadePoll'
import { propsUmToque } from '@/lib/umToque'

type ProfissionalCorrida = {
  usuario_id: string
  nome: string
  username: string | null
  foto_url: string | null
  verificado: boolean
  nota_media: number | null
  whatsapp: string | null
}

type CorridaTurista = {
  solicitacao_id: string
  status: string
  origem_nome: string | null
  destino_nome: string | null
  destino_empresa_id?: string | null
  manifesto_id?: string | null
  modalidade: string | null
  valor_estimado: number | null
  pagamento: string | null
  lugares: number | null
  data_agendada: string | null
  conversa_id: string | null
  lat_origem?: number | null
  lng_origem?: number | null
  lat_destino?: number | null
  lng_destino?: number | null
  prof_lat?: number | null
  prof_lng?: number | null
  profissional_username: string | null
  profissional_whatsapp: string | null
  profissional: ProfissionalCorrida | null
  finalizacao_sem_checkin?: {
    pendente: boolean
    motivo_profissional: string
    confirmado_turista?: boolean
  } | null
}

const STATUS_ATIVO = new Set(['aceita', 'a_caminho', 'no_local', 'em_viagem'])

type Props = {
  onCorridaChange?: (corrida: CorridaTurista | null) => void
}

/**
 * Drawer de atendimento ativo do turista + popup "Profissional CHEGOU!!!".
 * Reabre pelo card flutuante (imediato) ou barra inferior (agendado).
 */
export default function ChegadaTuristaMobilidadeListener({ onCorridaChange }: Props = {}) {
  const t = useTranslations('Mobilidade')
  const { perfilEhTurista, perfilEhEmpresa, perfilEhProfissional, roleEfetivo, loading } =
    useProfissionalGate()
  const [corrida, setCorrida] = useState<CorridaTurista | null>(null)
  const [drawerAberto, setDrawerAberto] = useState(false)
  const [chegadaDismissedId, setChegadaDismissedId] = useState<string | null>(null)
  const [busyFinalizacao, setBusyFinalizacao] = useState(false)
  const [erroFinalizacao, setErroFinalizacao] = useState('')
  const solicitacaoAnteriorRef = useRef<string | null>(null)

  const elegivel =
    !loading &&
    !perfilEhProfissional &&
    (perfilEhTurista || perfilEhEmpresa || roleEfetivo === 'admin')

  const carregar = useCallback(async () => {
    if (!elegivel) return
    try {
      const res = await fetch('/api/mobilidade/corrida-ativa-turista')
      if (!res.ok) return
      const json = (await res.json()) as { corrida?: CorridaTurista | null }
      let next = json.corrida ?? null
      if (next?.solicitacao_id && !next.conversa_id) {
        try {
          const rChat = await fetch('/api/mobilidade/chat/abrir', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ solicitacao_id: next.solicitacao_id }),
          })
          const jChat = (await rChat.json()) as { conversa_id?: string }
          if (jChat.conversa_id) {
            next = { ...next, conversa_id: String(jChat.conversa_id) }
          }
        } catch {
          /* ignore */
        }
      }
      if (next?.solicitacao_id && next.solicitacao_id !== solicitacaoAnteriorRef.current) {
        solicitacaoAnteriorRef.current = next.solicitacao_id
        const imediato = ehAtendimentoImediatoAtivo({
          status: next.status,
          data_agendada: next.data_agendada,
        })
        // Imediato: mapa + card flutuante. Agendado: drawer (sem rota ao vivo).
        setDrawerAberto(!imediato)
        setChegadaDismissedId(null)
      }
      if (!next) {
        solicitacaoAnteriorRef.current = null
      }
      setCorrida(next)
      avisarCorridaTuristaPoll(
        next
          ? {
              solicitacao_id: next.solicitacao_id,
              status: next.status,
              data_agendada: next.data_agendada,
              modalidade: next.modalidade,
              profissional: next.profissional
                ? {
                    nome: next.profissional.nome,
                    username: next.profissional.username,
                    foto_url: next.profissional.foto_url,
                    verificado: next.profissional.verificado,
                    nota_media: next.profissional.nota_media,
                  }
                : null,
            }
          : null,
      )
    } catch {
      /* ignore */
    }
  }, [elegivel])

  useEffect(() => {
    onCorridaChange?.(corrida)
  }, [corrida, onCorridaChange])

  useEffect(() => {
    if (!elegivel) onCorridaChange?.(null)
  }, [elegivel, onCorridaChange])

  useEffect(() => {
    if (!elegivel) return
    const intervalo = corrida ? MOBILIDADE_POLL_CORRIDA_ATIVA_MS : MOBILIDADE_POLL_CORRIDA_IDLE_MS
    void carregar()
    const id = setInterval(() => void carregar(), intervalo)
    const onRefresh = () => void carregar()
    window.addEventListener(MOBILIDADE_CORRIDA_ATIVA, onRefresh)
    return () => {
      clearInterval(id)
      window.removeEventListener(MOBILIDADE_CORRIDA_ATIVA, onRefresh)
    }
  }, [elegivel, carregar, corrida?.solicitacao_id])

  useEffect(() => {
    if (!elegivel) return
    const onAbrir = () => setDrawerAberto(true)
    window.addEventListener(MOBILIDADE_ABRIR_DRAWER_ATIVO, onAbrir)
    return () => window.removeEventListener(MOBILIDADE_ABRIR_DRAWER_ATIVO, onAbrir)
  }, [elegivel])

  if (!elegivel || !corrida) return null
  if (!STATUS_ATIVO.has(String(corrida.status))) return null

  const pro = corrida.profissional
  const atendimento: AtendimentoAtivoUi = {
    solicitacao_id: corrida.solicitacao_id,
    status: String(corrida.status),
    origem_nome: corrida.origem_nome,
    destino_nome: corrida.destino_nome,
    valor_estimado: corrida.valor_estimado,
    pagamento: corrida.pagamento,
    lugares: corrida.lugares,
    data_agendada: corrida.data_agendada,
    modalidade: corrida.modalidade,
    conversa_id: corrida.conversa_id,
    manifesto_id: corrida.manifesto_id ?? null,
    destino_empresa_id: corrida.destino_empresa_id ?? null,
    lat_origem: corrida.lat_origem ?? null,
    lng_origem: corrida.lng_origem ?? null,
    lat_destino: corrida.lat_destino ?? null,
    lng_destino: corrida.lng_destino ?? null,
    prof_lat: corrida.prof_lat ?? null,
    prof_lng: corrida.prof_lng ?? null,
    parte: pro
      ? {
          nome: pro.nome,
          username: pro.username,
          foto_url: pro.foto_url,
          verificado: pro.verificado,
          nota_media: pro.nota_media,
        }
      : null,
  }

  const st = String(corrida.status)
  const fin = corrida.finalizacao_sem_checkin
  const mostrarFinalizacao =
    Boolean(fin?.pendente) && !fin?.confirmado_turista
  const mostrarChegada =
    st === 'no_local' &&
    chegadaDismissedId !== corrida.solicitacao_id &&
    modalidadeUsaDeslocamentoProprio(corrida.modalidade) &&
    !mostrarFinalizacao

  const responderFinalizacao = async (opts: { confirma: boolean; outro?: string }) => {
    if (busyFinalizacao) return
    setBusyFinalizacao(true)
    setErroFinalizacao('')
    try {
      const res = await fetch(
        `/api/mobilidade/solicitar/${corrida.solicitacao_id}/confirmar-finalizacao`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            confirma: opts.confirma,
            outro: opts.outro ?? null,
          }),
        },
      )
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        setErroFinalizacao(String(json.error ?? t('finalizarSemCheckinErro')))
        return
      }
      avisarCorridaAtivaAtualizada()
      await carregar()
    } catch {
      setErroFinalizacao(t('finalizarSemCheckinErro'))
    } finally {
      setBusyFinalizacao(false)
    }
  }
  const imediato = ehAtendimentoImediatoAtivo({
    status: st,
    data_agendada: corrida.data_agendada,
  })

  return (
    <>
      <DrawerAtendimentoAtivoMobilidade
        aberto={drawerAberto}
        papel="turista"
        atendimento={atendimento}
        onFechar={() => setDrawerAberto(false)}
      />
      {!drawerAberto && !imediato ? (
          <button
            type="button"
            {...propsUmToque(() => setDrawerAberto(true))}
            className="fixed inset-x-3 bottom-24 z-[70] rounded-2xl px-4 py-3 text-left text-sm font-bold text-white shadow-2xl sm:inset-x-auto sm:right-4 sm:w-96"
          style={{ backgroundColor: st === 'em_viagem' || st === 'no_local' ? '#00D443' : '#0097b2' }}
        >
          {t('drawerAtivoReabrir')}
        </button>
      ) : null}
      <PopupChegadaTuristaMobilidade
        aberto={mostrarChegada}
        usernameProfissional={corrida.profissional_username ?? pro?.username ?? null}
        onFechar={() => setChegadaDismissedId(corrida.solicitacao_id)}
        onOk={() => setChegadaDismissedId(corrida.solicitacao_id)}
      />
      <PopupFinalizacaoSemCheckinTurista
        aberto={mostrarFinalizacao}
        busy={busyFinalizacao}
        erro={erroFinalizacao || null}
        onConfirmar={() => void responderFinalizacao({ confirma: true })}
        onRecusar={() => void responderFinalizacao({ confirma: false })}
      />
    </>
  )
}
