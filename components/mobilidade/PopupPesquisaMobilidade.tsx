'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Car,
  ChevronDown,
  ChevronUp,
  MapPin,
  Smartphone,
  Users,
  X,
  Sparkles,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useModalScrollLock } from '@/lib/useModalScrollLock'
import type { MobilidadePesquisaState } from '@/lib/mobilidadePesquisaParams'
import {
  carregarRotasTabeladasCidade,
  cidadeTripliceParaTabelado,
  ehCruzamentoFronteira,
  inferirCidadeDePonto,
  modalidadeRecomendada,
  modalidadesDisponiveis,
  sugerirRotaParaDestino,
  type ModalidadeMobilidadeId,
  type PagamentoMobilidadeId,
  PAGAMENTOS_ORDEM,
} from '@/lib/mobilidadePopupPesquisa'
import type { RotaTabelada } from '@/lib/servicosTabeladosCatalogo'
import { descricaoPeriodoRota } from '@/lib/servicosTabeladosCatalogo'

type Props = {
  aberto: boolean
  onFechar: () => void
  pesquisa: MobilidadePesquisaState
  /** Cidade do destino quando veio de empresa do mapa. */
  destinoCidadeEmpresa?: string | null
  destinoNomeEmpresa?: string | null
}

const ICONES: Record<ModalidadeMobilidadeId, typeof Car> = {
  motorista_app: Smartphone,
  van: Users,
  taxista: Car,
  guia: MapPin,
}

function formatBrl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function PopupPesquisaMobilidade({
  aberto,
  onFechar,
  pesquisa,
  destinoCidadeEmpresa = null,
  destinoNomeEmpresa = null,
}: Props) {
  const t = useTranslations('Mobilidade')
  useModalScrollLock(aberto)

  const [etapa, setEtapa] = useState<1 | 2 | 3>(1)
  const [expandidos, setExpandidos] = useState<Partial<Record<ModalidadeMobilidadeId, boolean>>>({})
  const [modalidade, setModalidade] = useState<ModalidadeMobilidadeId | null>(null)
  const [rotas, setRotas] = useState<RotaTabelada[]>([])
  const [carregandoValores, setCarregandoValores] = useState(false)
  const [pagamento, setPagamento] = useState<PagamentoMobilidadeId>('pix')
  const [lugares, setLugares] = useState(1)
  const [dataHora, setDataHora] = useState('')
  const [pedirAcompanhamento, setPedirAcompanhamento] = useState(false)
  const [buscando, setBuscando] = useState(false)

  const destinoLabel =
    pesquisa.destino.nome ||
    destinoNomeEmpresa ||
    (pesquisa.destinoEmpresaId ? t('destinoEmpresa') : '—')
  const origemLabel =
    pesquisa.origem.nome ||
    (pesquisa.origem.lat != null
      ? `${pesquisa.origem.lat.toFixed(4)}, ${pesquisa.origem.lng?.toFixed(4)}`
      : '—')

  const cidadeOrigem = useMemo(
    () => inferirCidadeDePonto(pesquisa.origem),
    [pesquisa.origem],
  )
  const cidadeDestino = useMemo(
    () =>
      inferirCidadeDePonto(pesquisa.destino, destinoCidadeEmpresa) ??
      inferirCidadeDePonto({ nome: destinoLabel, lat: null, lng: null }, destinoCidadeEmpresa),
    [pesquisa.destino, destinoCidadeEmpresa, destinoLabel],
  )

  const cruzamento = ehCruzamentoFronteira(cidadeOrigem, cidadeDestino)
  const disponiveis = useMemo(() => {
    let lista = modalidadesDisponiveis(cruzamento)
    // Guia dentro da cidade só se pedir acompanhamento exclusivo
    if (!cruzamento && !pedirAcompanhamento) {
      lista = lista.filter((id) => id !== 'guia')
    }
    if (!cruzamento && pedirAcompanhamento && !lista.includes('guia')) {
      lista = [...lista, 'guia']
    }
    return lista
  }, [cruzamento, pedirAcompanhamento])

  useEffect(() => {
    if (!aberto) return
    setEtapa(1)
    setModalidade(null)
    setBuscando(false)
  }, [aberto])

  useEffect(() => {
    if (!aberto) return
    const tab = cidadeTripliceParaTabelado(cidadeOrigem)
    if (!tab) {
      setRotas([])
      return
    }
    let ativo = true
    setCarregandoValores(true)
    void (async () => {
      const lista = await carregarRotasTabeladasCidade(supabase, tab)
      if (ativo) {
        setRotas(lista)
        setCarregandoValores(false)
      }
    })()
    return () => {
      ativo = false
    }
  }, [aberto, cidadeOrigem])

  const valoresPorMod = useMemo(() => {
    const destTxt = destinoLabel
    const out: Partial<Record<ModalidadeMobilidadeId, { valor: number | null; rota: RotaTabelada | null; parceiro?: boolean }>> =
      {}
    for (const id of disponiveis) {
      if (id === 'motorista_app') {
        out[id] = { valor: null, rota: null, parceiro: true }
        continue
      }
      const rota = sugerirRotaParaDestino(rotas, id, destTxt)
      out[id] = {
        valor: rota ? rota.valorRota : null,
        rota,
      }
    }
    return out
  }, [disponiveis, rotas, destinoLabel])

  const recomendada = useMemo(
    () =>
      modalidadeRecomendada(
        cruzamento,
        Object.fromEntries(
          Object.entries(valoresPorMod).map(([k, v]) => [k, v?.valor ?? null]),
        ) as Partial<Record<ModalidadeMobilidadeId, number | null>>,
      ),
    [cruzamento, valoresPorMod],
  )

  useEffect(() => {
    if (!aberto || modalidade) return
    if (disponiveis.includes(recomendada)) setModalidade(recomendada)
    else if (disponiveis[0]) setModalidade(disponiveis[0])
  }, [aberto, recomendada, disponiveis, modalidade])

  if (!aberto) return null

  const labelMod = (id: ModalidadeMobilidadeId) => t(`mod.${id}.label`)
  const beneficiosKeys = (id: ModalidadeMobilidadeId): string[] => {
    const n = Number(t(`mod.${id}.beneficiosCount`))
    return Array.from({ length: Number.isFinite(n) ? n : 0 }, (_, i) => `mod.${id}.b${i + 1}`)
  }
  const extrasKeys = (id: ModalidadeMobilidadeId): string[] => {
    const n = Number(t(`mod.${id}.extrasCount`))
    return Array.from({ length: Number.isFinite(n) ? n : 0 }, (_, i) => `mod.${id}.e${i + 1}`)
  }

  const avancar = () => {
    if (!modalidade) return
    setEtapa(2)
  }

  const procurar = () => {
    setEtapa(3)
    setBuscando(true)
    window.setTimeout(() => setBuscando(false), 1800)
  }

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 flex max-h-[78%] flex-col rounded-t-2xl bg-white shadow-2xl ring-1 ring-black/10">
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
        <div>
          <h2 className="text-base font-bold text-[#0097b2]">{t('popupTitulo')}</h2>
          <p className="text-xs text-gray-500">
            {t('popupEtapa', { n: etapa })}
            {cruzamento ? ` · ${t('badgeFronteira')}` : ` · ${t('badgeUrbano')}`}
          </p>
        </div>
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
        {etapa === 1 ? (
          <div className="space-y-3">
            <div className="rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-700">
              <p>
                <span className="font-semibold text-gray-500">{t('origemLabel')}: </span>
                {origemLabel}
              </p>
              <p className="mt-1">
                <span className="font-semibold text-gray-500">{t('destinoLabel')}: </span>
                {destinoLabel}
              </p>
            </div>

            {!cruzamento ? (
              <label className="flex items-start gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={pedirAcompanhamento}
                  onChange={(e) => setPedirAcompanhamento(e.target.checked)}
                  className="mt-0.5"
                />
                <span>{t('pedirAcompanhamentoGuia')}</span>
              </label>
            ) : null}

            {carregandoValores ? (
              <p className="text-sm text-gray-500">{t('carregandoValores')}</p>
            ) : null}

            <ul className="space-y-2">
              {disponiveis.map((id) => {
                const Icon = ICONES[id]
                const info = valoresPorMod[id]
                const abertoCard = Boolean(expandidos[id])
                const ehRec = id === recomendada
                return (
                  <li key={id}>
                    <div
                      className={`rounded-xl border-2 p-3 transition-colors ${
                        modalidade === id
                          ? 'border-[#00D443] bg-green-50/40'
                          : ehRec
                            ? 'border-amber-400 bg-amber-50/50'
                            : 'border-gray-200 bg-white'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setModalidade(id)}
                        className="flex w-full items-start gap-3 text-left"
                      >
                        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[#0097b2]" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-gray-900">{labelMod(id)}</span>
                            {ehRec ? (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-400/90 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                                <Sparkles className="h-3 w-3" aria-hidden />
                                {t('seloRecomendado')}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-0.5 text-sm font-semibold text-[#0097b2]">
                            {info?.parceiro
                              ? t('valorParceiro')
                              : info?.valor != null
                                ? formatBrl(info.valor)
                                : t('valorIndisponivel')}
                          </p>
                          {info?.rota && descricaoPeriodoRota(info.rota) ? (
                            <p className="mt-0.5 text-xs text-gray-500">{descricaoPeriodoRota(info.rota)}</p>
                          ) : null}
                          {info?.rota && !info.parceiro ? (
                            <p className="mt-0.5 text-xs text-gray-400">
                              {t('rotaSugerida')}: {info.rota.destinoFinal}
                            </p>
                          ) : null}
                        </div>
                        <span
                          className={`mt-1 h-4 w-4 shrink-0 rounded-full border-2 ${
                            modalidade === id ? 'border-[#00D443] bg-[#00D443]' : 'border-gray-300'
                          }`}
                          aria-hidden
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandidos((prev) => ({ ...prev, [id]: !prev[id] }))
                        }
                        className="mt-2 flex w-full items-center justify-center gap-1 text-xs font-semibold text-[#0097b2]"
                      >
                        {abertoCard ? t('ocultarBeneficios') : t('verBeneficios')}
                        {abertoCard ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                      {abertoCard ? (
                        <div className="mt-2 space-y-2 border-t border-gray-100 pt-2 text-xs text-gray-600">
                          <p className="font-semibold text-gray-800">{t('beneficiosTitulo')}</p>
                          <ul className="list-disc space-y-1 pl-4">
                            {beneficiosKeys(id).map((k) => (
                              <li key={k}>{t(k)}</li>
                            ))}
                          </ul>
                          {extrasKeys(id).length > 0 ? (
                            <>
                              <p className="font-semibold text-gray-800">{t('extrasTitulo')}</p>
                              <ul className="list-disc space-y-1 pl-4">
                                {extrasKeys(id).map((k) => (
                                  <li key={k}>{t(k)}</li>
                                ))}
                              </ul>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}

        {etapa === 2 ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-gray-50 px-3 py-2 text-sm">
              <p className="font-semibold text-gray-800">
                {modalidade ? labelMod(modalidade) : '—'}
              </p>
              <p className="text-gray-600">
                {origemLabel} → {destinoLabel}
              </p>
              <p className="mt-1 font-semibold text-[#0097b2]">
                {modalidade && valoresPorMod[modalidade]?.parceiro
                  ? t('valorParceiro')
                  : modalidade && valoresPorMod[modalidade]?.valor != null
                    ? formatBrl(valoresPorMod[modalidade]!.valor!)
                    : t('valorIndisponivel')}
              </p>
              <p className="mt-1 text-xs text-gray-500">{t('pagamentoDepoisHint')}</p>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#0097b2]">
                {t('formaPagamento')}
              </p>
              <div className="flex flex-wrap gap-2">
                {PAGAMENTOS_ORDEM.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPagamento(id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                      pagamento === id
                        ? 'bg-[#0097b2] text-white'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {t(`pag.${id}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-dashed border-gray-300 p-3">
              <p className="text-sm font-bold text-gray-800">{t('agendarTitulo')}</p>
              <label className="mt-2 block text-xs text-gray-600">
                {t('lugaresLabel')}
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={lugares}
                  onChange={(e) => setLugares(Math.max(1, Number(e.target.value) || 1))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
                <span className="mt-1 block text-[11px] text-gray-400">{t('lugaresHint')}</span>
              </label>
              <label className="mt-2 block text-xs text-gray-600">
                {t('dataHoraLabel')}
                <input
                  type="datetime-local"
                  value={dataHora}
                  onChange={(e) => setDataHora(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
            </div>
          </div>
        ) : null}

        {etapa === 3 ? (
          <div className="space-y-3 py-4 text-center">
            {buscando ? (
              <>
                <div className="mx-auto h-10 w-10 animate-pulse rounded-full bg-[#0097b2]/30" />
                <p className="font-semibold text-gray-800">{t('procurandoProfissional')}</p>
                <p className="text-sm text-gray-500">{t('procurandoHint')}</p>
              </>
            ) : (
              <>
                <p className="font-semibold text-gray-800">{t('semProfissionalTitulo')}</p>
                <p className="text-sm text-gray-500">{t('semProfissionalDesc')}</p>
                {dataHora ? (
                  <p className="text-xs text-[#0097b2]">{t('agendamentoRegistradoLocal')}</p>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEtapa(2)}
                    className="text-sm font-semibold text-[#0097b2] underline"
                  >
                    {t('voltarAgendar')}
                  </button>
                )}
              </>
            )}
          </div>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-gray-100 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {etapa === 1 ? (
          <button
            type="button"
            disabled={!modalidade}
            onClick={avancar}
            className="w-full rounded-xl bg-[#00D443] py-3 text-sm font-bold uppercase text-white disabled:opacity-50"
          >
            {t('avancar')}
          </button>
        ) : null}
        {etapa === 2 ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEtapa(1)}
              className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700"
            >
              {t('voltar')}
            </button>
            <button
              type="button"
              onClick={procurar}
              className="flex-1 rounded-xl bg-[#00D443] py-3 text-sm font-bold uppercase text-white"
            >
              {t('procurar')}
            </button>
          </div>
        ) : null}
        {etapa === 3 && !buscando ? (
          <button
            type="button"
            onClick={onFechar}
            className="w-full rounded-xl bg-[#0097b2] py-3 text-sm font-bold uppercase text-white"
          >
            {t('fechar')}
          </button>
        ) : null}
      </div>
    </div>
  )
}
