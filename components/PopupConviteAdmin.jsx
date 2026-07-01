'use client'

import { useState } from 'react'
import { ShieldCheck, X } from 'lucide-react'

/**
 * @param {{
 *   isOpen: boolean
 *   funcao: string
 *   comunidade?: string
 *   pais?: string
 *   convidadoPor?: string
 *   onAceitar: () => void | Promise<void>
 *   onRecusar: () => void | Promise<void>
 *   loading?: boolean
 * }} props
 */
export default function PopupConviteAdmin({
  isOpen,
  funcao,
  comunidade = '',
  pais = '',
  convidadoPor = 'ADM GERAL',
  onAceitar,
  onRecusar,
  loading = false,
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/50 p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Fechar"
        onClick={() => {
          if (!loading) void onRecusar()
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="popup-convite-admin-titulo"
        className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl bg-[#0097b2] text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => {
            if (!loading) void onRecusar()
          }}
          className="absolute right-3 top-3 text-white/80 hover:text-white"
          aria-label="Recusar convite"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>

        <div className="px-5 pb-6 pt-8 text-center">
          <div className="mb-3 flex justify-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15">
              <ShieldCheck className="h-8 w-8 text-white" strokeWidth={1.75} aria-hidden />
            </span>
          </div>
          <h2 id="popup-convite-admin-titulo" className="text-lg font-bold text-white">
            Convite para administração
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/95">
            <strong className="text-white">{convidadoPor}</strong> convidou você para atuar como{' '}
            <strong className="text-white">{funcao}</strong>
            {comunidade ? (
              <>
                {' '}
                na comunidade <strong className="text-white">{comunidade}</strong>
              </>
            ) : null}
            {pais ? (
              <>
                {' '}
                ({pais})
              </>
            ) : null}
            . Ao aceitar, a pasta <strong className="text-white">Admin</strong> ficará disponível no seu menu com
            acesso à Dashboard ADM.
          </p>

          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                void onAceitar()
              }}
              className="w-full rounded-xl bg-[#00D443] py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {loading ? 'Processando…' : 'Aceitar função'}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                void onRecusar()
              }}
              className="w-full rounded-xl border border-white/40 bg-white/10 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Recusar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
