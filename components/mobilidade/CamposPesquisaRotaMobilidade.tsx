'use client'

import type { Ref } from 'react'
import { useTranslations } from 'next-intl'
import { Building2, MapPin, Navigation, Route, X } from 'lucide-react'
import type { MobilidadePonto } from '@/lib/mobilidadePesquisaParams'
import type { SugestaoDestinoMobilidade } from '@/lib/mobilidadePopupPesquisa'

export const CAMPO_ROTA_CLASS =
  'w-full rounded-xl border border-white/25 bg-[#0097b2] px-3 py-2.5 text-sm text-white placeholder:text-white/70 outline-none focus:ring-2 focus:ring-white/40'

type GpsStatus = 'idle' | 'loading' | 'ok' | 'denied' | 'error'

type Props = {
  origem: MobilidadePonto
  destino: MobilidadePonto
  gpsStatus?: GpsStatus
  sugestoes: SugestaoDestinoMobilidade[]
  mostrarLista: boolean
  listaRef?: Ref<HTMLUListElement>
  onOrigemNomeChange: (nome: string) => void
  onDestinoNomeChange: (nome: string) => void
  onLimparDestino: () => void
  onEscolherSugestao: (s: SugestaoDestinoMobilidade) => void
  onFocusCampo: (campo: 'origem' | 'destino') => void
  onBlurCampo: () => void
}

/** Campos origem/destino iguais ao popup flutuante (sem cabeçalho e sem Pesquisar). */
export default function CamposPesquisaRotaMobilidade({
  origem,
  destino,
  gpsStatus = 'ok',
  sugestoes,
  mostrarLista,
  listaRef,
  onOrigemNomeChange,
  onDestinoNomeChange,
  onLimparDestino,
  onEscolherSugestao,
  onFocusCampo,
  onBlurCampo,
}: Props) {
  const t = useTranslations('Mobilidade')

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#0097b2]">
          <Navigation className="h-3.5 w-3.5" aria-hidden />
          {t('origemLabel')}
        </span>
        <input
          type="text"
          value={origem.nome}
          onChange={(e) => onOrigemNomeChange(e.target.value)}
          onFocus={() => onFocusCampo('origem')}
          onBlur={() => {
            window.setTimeout(() => onBlurCampo(), 200)
          }}
          placeholder={
            gpsStatus === 'loading'
              ? t('origemGpsLoading')
              : gpsStatus === 'denied' || gpsStatus === 'error'
                ? t('origemManualPlaceholder')
                : t('origemPlaceholder')
          }
          className={CAMPO_ROTA_CLASS}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          inputMode="text"
          enterKeyHint="done"
        />
        {gpsStatus === 'denied' ? (
          <p className="mt-1 text-xs text-amber-700">{t('gpsNegadoHint')}</p>
        ) : null}
      </label>

      <div className="block">
        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#0097b2]">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            {t('destinoLabel')}
          </span>
          <span className="relative block">
            <input
              type="text"
              value={destino.nome}
              onChange={(e) => onDestinoNomeChange(e.target.value)}
              onFocus={() => onFocusCampo('destino')}
              onBlur={() => {
                window.setTimeout(() => onBlurCampo(), 200)
              }}
              placeholder={t('destinoPlaceholder')}
              className={`${CAMPO_ROTA_CLASS}${destino.nome.trim() ? ' pr-10' : ''}`}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              inputMode="text"
              enterKeyHint="search"
              role="combobox"
              aria-expanded={mostrarLista}
              aria-autocomplete="list"
            />
            {destino.nome.trim() ? (
              <button
                type="button"
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-white/90 hover:bg-white/15"
                aria-label={t('limparDestino')}
                onMouseDown={(e) => e.preventDefault()}
                onClick={onLimparDestino}
              >
                <X className="h-4 w-4" aria-hidden strokeWidth={2.5} />
              </button>
            ) : null}
          </span>
        </label>

        {mostrarLista ? (
          <ul
            ref={listaRef}
            className="mt-2 max-h-[min(42vh,13.5rem)] min-h-[10.5rem] touch-pan-y overflow-y-auto overscroll-contain rounded-xl border border-gray-200 bg-white py-1 shadow-md"
            style={{ WebkitOverflowScrolling: 'touch' }}
            role="listbox"
            onTouchMove={(e) => e.stopPropagation()}
          >
            {sugestoes.map((s) => (
              <li key={s.id} role="option">
                <button
                  type="button"
                  className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-[#0097b2]/8"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onEscolherSugestao(s)}
                >
                  {s.tipo === 'empresa' ? (
                    s.fotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.fotoUrl}
                        alt=""
                        className="mt-0.5 h-9 w-9 shrink-0 rounded-lg bg-gray-100 object-cover"
                      />
                    ) : (
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0097b2]/15">
                        <Building2 className="h-4 w-4 text-[#0097b2]" aria-hidden />
                      </span>
                    )
                  ) : (
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0097b2]/15">
                      <Route className="h-4 w-4 text-[#0097b2]" aria-hidden />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-gray-900">{s.label}</span>
                    {s.tipo === 'empresa' ? (
                      <span className="mt-0.5 block text-[11px] leading-snug text-gray-500">
                        {[s.endereco, s.detalhe].filter(Boolean).join(' · ') || t('sugestaoEmpresa')}
                      </span>
                    ) : (
                      <span className="mt-0.5 block text-[11px] text-gray-500">{t('sugestaoRota')}</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
