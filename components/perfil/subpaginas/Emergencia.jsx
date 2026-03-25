'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * @param {{ onFecharModal?: () => void }} props
 */
export default function Emergencia({ onFecharModal }) {
  const router = useRouter()
  const [fluxo, setFluxo] = useState(/** @type {string | null} */ (null))

  const fluxos = {
    item: {
      titulo: '🔍 Item esquecido',
      descricao: 'Descreva o item esquecido. Taxa indicativa: R$ 25,00.',
      acao: () => {
        window.alert('Solicitação registrada. Um profissional parceiro entrará em contato em breve.')
      },
    },
    perdido: {
      titulo: '🗺️ Estou perdido(a)',
      descricao: 'Compartilhe sua localização com a equipe do Guia 3F.',
      acao: () => {
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              window.alert(
                `Localização enviada (aprox.): ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`
              )
            },
            () => window.alert('Não foi possível obter a localização. Verifique as permissões do navegador.')
          )
        } else {
          window.alert('Geolocalização não disponível neste dispositivo.')
        }
      },
    },
    socorro: {
      titulo: '🆘 SOCORRO',
      descricao: '⚠️ Situação de risco real — use os serviços de emergência locais (190/192/193).',
      acao: () => {
        window.alert('Em emergência real, ligue 190 (polícia), 192 (SAMU) ou 193 (bombeiros).')
      },
    },
    adm: {
      titulo: '📞 Contatar ADM',
      descricao: 'Fale com um administrador pelo canal oficial.',
      acao: () => {
        router.push('/canal')
      },
    },
  }

  return (
    <div className="px-1">
      <div className="grid gap-3">
        {Object.entries(fluxos).map(([key, value]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFluxo(key)}
            className="rounded-xl border border-gray-200 p-4 text-left transition hover:border-[#0097b2]/50 hover:bg-gray-50"
          >
            <div className="font-bold text-gray-900">{value.titulo}</div>
            <div className="mt-1 text-sm text-gray-500">{value.descricao}</div>
          </button>
        ))}
      </div>

      {fluxo && fluxos[fluxo] ? (
        <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">{fluxos[fluxo].titulo}</h3>
            <p className="mt-2 text-sm text-gray-600">{fluxos[fluxo].descricao}</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-700"
                onClick={() => setFluxo(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg bg-[#0097b2] py-2 text-sm font-medium text-white"
                onClick={() => {
                  fluxos[fluxo].acao()
                  setFluxo(null)
                  onFecharModal?.()
                }}
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
