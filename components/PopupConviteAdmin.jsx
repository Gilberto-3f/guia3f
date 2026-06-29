'use client'

import { useState } from 'react'
import { ShieldCheck, X } from 'lucide-react'

/**
 * @param {{
 *   isOpen: boolean
 *   funcao: string
 *   comunidade?: string
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
        className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => {
            if (!loading) void onRecusar()
          }}
          className="absolute right-3 top-3 text-gray-500 hover:text-gray-800"
          aria-label="Recusar convite"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>

        <div className="px-5 pb-6 pt-8 text-center text-gray-900">
          <div className="mb-3 flex justify-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#0097b2]/10">
              <ShieldCheck className="h-8 w-8 text-[#0097b2]" strokeWidth={1.75} aria-hidden />
            </span>
          </div>
          <h2 id="popup-convite-admin-titulo" className="text-lg font-bold text-gray-900">
            Convite para administração
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-700">
            <strong>{convidadoPor}</strong> convidou você para atuar como{' '}
            <strong>{funcao}</strong>
            {comunidade ? (
              <>
                {' '}
                na comunidade <strong>{comunidade}</strong>
              </>
            ) : null}
            . Ao aceitar, a pasta <strong>Administração</strong> ficará disponível no seu menu com acesso à
            Dashboard ADM.
          </p>

          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                void onAceitar()
              }}
              className="w-full rounded-xl bg-[#0097b2] py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {loading ? 'Processando…' : 'Aceitar função'}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                void onRecusar()
              }}
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 disabled:opacity-50"
            >
              Recusar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
