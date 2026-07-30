'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CalendarDays, ClipboardList, X } from 'lucide-react'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import ToggleStatusMobilidade from '@/components/mobilidade/ToggleStatusMobilidade'
import ListaAtendimentosDiaTaxista from '@/components/mobilidade/ListaAtendimentosDiaTaxista'
import AgendamentoAutomatico from '@/components/perfil/subpaginas/AgendamentoAutomatico'
import { supabase } from '@/lib/supabase'
import {
  MANIFESTO_CAPACIDADE_PADRAO,
  resolverPainelMobilidade,
  type PainelMobilidadeModo,
} from '@/lib/mobilidadePainelProfissional'
import type { MobilidadeStatusId } from '@/lib/mobilidadeStatusProfissional'

type ToastKind = 'offline' | 'online' | null

/**
 * Ferramenta de trabalho do profissional na Mobilidade (por categoria).
 */
export default function PainelTrabalhoMobilidade() {
  const t = useTranslations('Mobilidade')
  const router = useRouter()
  const [modo, setModo] = useState<PainelMobilidadeModo | null>(null)
  const [statusAtual, setStatusAtual] = useState<MobilidadeStatusId>('offline')
  const [toast, setToast] = useState<ToastKind>(null)
  const [paxHoje, setPaxHoje] = useState(0)
  const [dataLabel, setDataLabel] = useState('')
  const [calendarioAberto, setCalendarioAberto] = useState(false)

  useEffect(() => {
    const d = new Date()
    setDataLabel(
      d.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
      }),
    )
  }, [])

  useEffect(() => {
    let ativo = true
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const uid = session?.user?.id
      if (!uid || !ativo) return
      const { data: prof } = await supabase
        .from('profissionais')
        .select('placa_vermelha, categorias')
        .eq('usuario_id', uid)
        .maybeSingle()
      if (!ativo || !prof) {
        if (ativo) setModo('outro')
        return
      }
      const cats = Array.isArray(prof.categorias)
        ? prof.categorias.filter((c): c is string => typeof c === 'string')
        : []
      setModo(resolverPainelMobilidade(Boolean(prof.placa_vermelha), cats))
    })()
    return () => {
      ativo = false
    }
  }, [])

  const carregarManifestoContagem = useCallback(async () => {
    try {
      const res = await fetch('/api/profissional/manifesto')
      const json = (await res.json()) as {
        manifestos?: Array<{
          data_manifesto?: string
          passageiros?: unknown[]
          qtd_passageiros?: number
          status?: string
        }>
      }
      if (!res.ok) return
      const hoje = new Date().toISOString().slice(0, 10)
      const lista = Array.isArray(json.manifestos) ? json.manifestos : []
      const doDia = lista.find((m) => String(m.data_manifesto ?? '').slice(0, 10) === hoje)
      setPaxHoje(Number(doDia?.qtd_passageiros ?? (Array.isArray(doDia?.passageiros) ? doDia.passageiros.length : 0)))
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (modo === 'guia_van') void carregarManifestoContagem()
  }, [modo, carregarManifestoContagem])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 5000)
    return () => window.clearTimeout(id)
  }, [toast])

  const modoRef = useRef(modo)
  modoRef.current = modo

  const onStatusChange = useCallback((prev: MobilidadeStatusId, next: MobilidadeStatusId) => {
    setStatusAtual(next)
    if (next === 'offline' && prev !== 'offline') setToast('offline')
    if (modoRef.current === 'taxista' && next === 'online' && prev !== 'online') setToast('online')
  }, [])

  if (modo == null) {
    return (
      <div className="flex min-h-[120px] items-center justify-center">
        <p className="animate-pulse text-sm text-gray-400">…</p>
      </div>
    )
  }

  if (modo === 'motorista_app') {
    return (
      <div className="mx-3 mt-3 rounded-2xl bg-white p-4 shadow-md ring-1 ring-black/10">
        <p className="text-center text-sm font-extrabold uppercase tracking-wide text-[#0097b2]">
          {t('painelAppTitulo')}
        </p>
        <p className="mt-3 text-center text-sm leading-relaxed text-gray-700">{t('painelAppDesc')}</p>
      </div>
    )
  }

  if (modo === 'outro') {
    return (
      <div className="mx-3 mt-3 rounded-2xl bg-white p-4 text-center text-sm text-gray-600 shadow-md ring-1 ring-black/10">
        {t('painelOutro')}
      </div>
    )
  }

  const online = statusAtual === 'online' || statusAtual === 'em_atendimento'
  const cap = MANIFESTO_CAPACIDADE_PADRAO
  const manifestoLabel = `${String(paxHoje).padStart(2, '0')}/${String(cap).padStart(2, '0')}`

  return (
    <div className="relative z-10 mx-3 mt-3 space-y-3">
      <ToggleStatusMobilidade variant="painel" onStatusChange={onStatusChange} />

      {toast === 'offline' ? (
        <div className="rounded-xl bg-[#E74C3C] px-3 py-3 text-center text-sm font-semibold text-white shadow">
          {t('toastOffline')}
        </div>
      ) : null}

      {toast === 'online' ? (
        <div className="rounded-xl bg-[#00D443] px-3 py-3 text-center text-sm font-semibold text-white shadow">
          {t('toastOnlineTaxista')}
        </div>
      ) : null}

      {modo === 'guia_van' && online ? (
        <div className="space-y-2">
          <p className="text-center text-xs font-semibold capitalize text-gray-600">{dataLabel}</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => router.push('/profissional/manifesto')}
              className="flex flex-col items-center gap-2 rounded-2xl bg-[#0097b2] px-3 py-4 text-white shadow-md"
            >
              <ClipboardList className="h-7 w-7" aria-hidden />
              <span className="text-xs font-bold uppercase tracking-wide">{t('painelManifesto')}</span>
              <span className="text-lg font-extrabold tabular-nums">{manifestoLabel}</span>
            </button>
            <button
              type="button"
              onClick={() => setCalendarioAberto(true)}
              className="flex flex-col items-center gap-2 rounded-2xl bg-[#00D443] px-3 py-4 text-white shadow-md"
            >
              <CalendarDays className="h-7 w-7" aria-hidden />
              <span className="text-xs font-bold uppercase tracking-wide">{t('painelCalendario')}</span>
            </button>
          </div>
        </div>
      ) : null}

      {modo === 'taxista' && online ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#0097b2]">
            {t('atendimentosTitulo')}
          </p>
          <ListaAtendimentosDiaTaxista />
        </div>
      ) : null}

      {calendarioAberto ? (
        <div className="fixed inset-0 z-[70] flex flex-col bg-black/40 p-3 pt-safe">
          <div className="mx-auto flex max-h-[90dvh] w-full max-w-lg flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
              <h3 className="text-base font-bold text-[#0097b2]">{t('painelCalendario')}</h3>
              <button
                type="button"
                onClick={() => setCalendarioAberto(false)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                aria-label={t('fechar')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              <AgendamentoAutomatico />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
