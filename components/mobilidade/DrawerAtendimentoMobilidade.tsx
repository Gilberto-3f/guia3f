'use client'

import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Check, X, Bell } from 'lucide-react'
import AvatarImage from '@/components/AvatarImage'
import UsuarioHandleVerificado from '@/components/UsuarioHandleVerificado'
import { useModalScrollLock } from '@/lib/useModalScrollLock'
import { ofertaWarnAmarelo } from '@/lib/mobilidadeMatching'
import {
  formatDataHoraAtendimentoCurta,
  handleUsuarioAtendimento,
  modalidadeUsaManifesto,
  type ParceiroRecomendacaoOferta,
} from '@/lib/mobilidadeOfertaAtendimento'

const RODAPE_PB = 'p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]'

const COR = '#0097b2'
const VERDE = '#00D443'

export type TuristaOfertaAtendimento = {
  nome: string
  username: string | null
  foto_url: string | null
  verificado: boolean
  nota_media?: number | null
}

export type OfertaAtendimentoUi = {
  solicitacao_id: string
  modalidade: string | null
  origem_nome: string | null
  destino_nome: string | null
  valor_estimado: number | null
  lugares: number | null
  pagamento: string | null
  data_agendada: string | null
  cruzamento_fronteira: boolean
  oferta_expira_em: string | null
  distancia_km: number
  contratacao_direcionada: boolean
  turista: TuristaOfertaAtendimento | null
  recomendacao?: ParceiroRecomendacaoOferta | null
}

type Props = {
  oferta: OfertaAtendimentoUi
  busy?: boolean
  segundosRestantes?: number | null
  /** Conteúdo extra (ex.: painel de motivos de recusa). */
  rodapeExtra?: ReactNode
  onAceitar: () => void
  onRecusar: () => void
  /** Se true, oculta botões padrão (quando rodapeExtra assume o fluxo). */
  ocultarBotoes?: boolean
}

function formatBrl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function labelPagamento(pagamento: string, t: (key: string) => string): string {
  const map: Record<string, string> = {
    dinheiro: 'pag.dinheiro',
    pix: 'pag.pix',
    cartao: 'pag.cartao',
    cartao_credito: 'pag.cartao',
    cartao_debito: 'pag.cartao',
  }
  const key = map[pagamento]
  if (!key) return pagamento
  try {
    return t(key)
  } catch {
    return pagamento
  }
}

/** Mensagem principal conforme livre/dirigida × imediato/agendado × taxista/guia-van. */
function mensagemPrincipalAtendimento(
  oferta: OfertaAtendimentoUi,
  t: ReturnType<typeof useTranslations<'Mobilidade'>>,
): string {
  const handle = handleUsuarioAtendimento(oferta.turista?.username)
  const dataCurta = formatDataHoraAtendimentoCurta(oferta.data_agendada)
  const manifesto = modalidadeUsaManifesto(oferta.modalidade)
  const agendado = Boolean(dataCurta)
  const dirigida = Boolean(oferta.contratacao_direcionada)

  if (dirigida && agendado && dataCurta) {
    return manifesto
      ? t('msgDirigidaAgendadaManifesto', { user: handle, quando: dataCurta })
      : t('msgDirigidaAgendadaTaxista', { user: handle, quando: dataCurta })
  }
  if (dirigida) {
    return manifesto
      ? t('msgDirigidaImediataManifesto', { user: handle })
      : t('msgDirigidaImediataTaxista', { user: handle })
  }
  if (agendado && dataCurta) {
    return manifesto
      ? t('msgAgendadaManifesto', { quando: dataCurta })
      : t('msgAgendadaTaxista', { quando: dataCurta })
  }
  return manifesto ? t('msgImediataManifesto') : t('msgImediataTaxista')
}

/** Drawer de atendimento (profissional) — layout + mensagens condicionais. */
export default function DrawerAtendimentoMobilidade({
  oferta,
  busy = false,
  segundosRestantes = null,
  rodapeExtra = null,
  onAceitar,
  onRecusar,
  ocultarBotoes = false,
}: Props) {
  const t = useTranslations('Mobilidade')
  useModalScrollLock(true)

  const turista = oferta.turista
  const username = String(turista?.username ?? '').replace(/^@+/, '') || 'usuario'
  const dataHoraAgenda = formatDataHoraAtendimentoCurta(oferta.data_agendada)
  const dirigida = Boolean(oferta.contratacao_direcionada)
  const warn = segundosRestantes != null && ofertaWarnAmarelo(segundosRestantes, dirigida)
  const relogioTxt =
    segundosRestantes == null
      ? ''
      : dirigida && segundosRestantes >= 60
        ? `${Math.floor(segundosRestantes / 60)}:${String(segundosRestantes % 60).padStart(2, '0')}`
        : `${segundosRestantes}s`
  const mensagemPrincipal = mensagemPrincipalAtendimento(oferta, t)
  const rec = oferta.recomendacao ?? null
  const recHandle = handleUsuarioAtendimento(rec?.username)

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-white"
      style={{ height: 'var(--app-height, 100dvh)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-atendimento-titulo"
    >
      <div className="shrink-0 pt-safe" style={{ backgroundColor: COR }}>
        <div className="flex h-12 items-center gap-2 px-3">
          <Bell className="h-5 w-5 shrink-0 text-white" aria-hidden />
          <h2
            id="drawer-atendimento-titulo"
            className="min-w-0 flex-1 truncate text-base font-bold uppercase tracking-wide text-white"
          >
            {t('drawerNovoAtendimento')}
          </h2>
          {segundosRestantes != null ? (
            <span
              className={`rounded-lg px-2 py-1 text-xs font-bold text-white ${
                warn ? 'bg-amber-400' : 'bg-white/20'
              }`}
            >
              {relogioTxt}
            </span>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4" data-modal-scroll-lock-scrollable>
        {/* Card do turista */}
        <div className="flex items-center gap-3">
          <div
            className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-100"
            style={{ boxShadow: `0 0 0 3px ${COR}` }}
          >
            {turista?.foto_url ? (
              <AvatarImage
                src={turista.foto_url}
                alt=""
                fill
                className="object-cover"
                sizes="64px"
              />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold leading-tight text-gray-900">
              {turista?.nome || t('atendimentoTuristaFallback')}
            </p>
            <UsuarioHandleVerificado
              username={username}
              verificado={Boolean(turista?.verificado)}
              verificadoTipo="profissional"
              notaMedia={turista?.nota_media ?? null}
              asButton={false}
              className="justify-start text-sm font-normal leading-tight text-gray-600"
            />
          </div>
        </div>

        {/* Resumo da corrida (partida + destino) — mesmo modelo drawers 2/3 */}
        <div className="mt-5 rounded-xl px-3 py-2.5 text-sm text-white" style={{ backgroundColor: COR }}>
          <p>
            <span className="font-semibold text-white">{t('origemLabel')}: </span>
            {oferta.origem_nome || '—'}
          </p>
          <p className="mt-1">
            <span className="font-semibold text-white">{t('destinoLabel')}: </span>
            {oferta.destino_nome || '—'}
          </p>
        </div>

        {/* Informações do atendimento */}
        <div className="mt-3 rounded-xl border border-[#0097b2] bg-white px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: COR }}>
            {t('infoAtendimentoTitulo')}
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-gray-800">
            <li>
              <span className="font-semibold text-gray-600">{t('valorCorrida')}: </span>
              {oferta.valor_estimado != null ? formatBrl(oferta.valor_estimado) : t('valorIndisponivel')}
            </li>
            {oferta.pagamento ? (
              <li>
                <span className="font-semibold text-gray-600">{t('formaPagamento')}: </span>
                {labelPagamento(oferta.pagamento, t)}
              </li>
            ) : null}
            <li>
              <span className="font-semibold text-gray-600">{t('resumoPassageiros')}: </span>
              {oferta.lugares ?? 1}
            </li>
            {oferta.distancia_km > 0 ? (
              <li className="text-xs text-gray-500">~{oferta.distancia_km} km</li>
            ) : null}
          </ul>
        </div>

        {/* Para quando? */}
        <div className="mt-3 rounded-xl border border-[#0097b2] bg-white px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: COR }}>
            {t('paraQuandoTitulo')}
          </p>
          {dataHoraAgenda ? (
            <p className="mt-2 text-sm font-semibold text-gray-800">
              {t('agendamentoPara', { quando: dataHoraAgenda })}
            </p>
          ) : (
            <p className="mt-2 text-sm font-bold uppercase" style={{ color: VERDE }}>
              {t('paraQuandoAgora')}
            </p>
          )}
        </div>

        {/* Recomendação (condicional) */}
        {rec ? (
          <div className="mt-4 space-y-3">
            <p className="rounded-xl border border-[#0097b2]/25 bg-[#0097b2]/5 px-3 py-2.5 text-sm leading-relaxed text-gray-800">
              {t('msgRecomendacaoBonificacao', {
                user: recHandle,
                pct: rec.percentual_bonificacao,
              })}
            </p>
            <div
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-white"
              style={{ backgroundColor: COR }}
            >
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 border-white/80 bg-white/20">
                {rec.foto_url ? (
                  <AvatarImage
                    src={rec.foto_url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="48px"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-white">{rec.nome}</p>
                <p className="truncate text-sm text-white/90">{recHandle}</p>
              </div>
            </div>
          </div>
        ) : null}

        {/* Mensagem de aceite / agendamento */}
        <p className="mt-4 rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm leading-relaxed text-gray-800">
          {mensagemPrincipal}
        </p>
      </div>

      <div className={`shrink-0 border-t border-gray-100 ${RODAPE_PB}`}>
        {rodapeExtra}
        {!ocultarBotoes ? (
          <div className={`grid grid-cols-2 gap-2 ${rodapeExtra ? 'mt-2' : ''}`}>
            <button
              type="button"
              disabled={busy}
              onClick={onRecusar}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 py-3 text-sm font-bold uppercase text-white disabled:opacity-50"
            >
              <X className="h-4 w-4" aria-hidden />
              {t('ofertaRecusar')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onAceitar}
              className="flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-bold uppercase text-white disabled:opacity-50"
              style={{ backgroundColor: VERDE }}
            >
              <Check className="h-4 w-4" aria-hidden />
              {t('ofertaAceitar')}
            </button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
