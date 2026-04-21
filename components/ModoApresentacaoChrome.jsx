'use client'

import { useModoApresentacao } from '@/context/ModoApresentacaoContext'

export default function ModoApresentacaoChrome() {
  const { modoAtivo, perfilSimulado, desativarModo, avisoBloqueio, limparAviso } = useModoApresentacao()

  return (
    <>
      {modoAtivo && perfilSimulado ? (
        <div
          className="fixed left-0 right-0 top-0 z-[60] flex items-center justify-between gap-2 border-b border-amber-600 bg-amber-500 px-3 py-2 text-sm text-white shadow-md"
          style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
        >
          <span className="min-w-0 flex-1 truncate">
            🎭 MODO APRESENTAÇÃO — Visualizando como {perfilSimulado.icone} {perfilSimulado.nome}
          </span>
          <button
            type="button"
            onClick={() => desativarModo()}
            className="shrink-0 rounded-md bg-red-600 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white hover:bg-red-700"
          >
            Sair
          </button>
        </div>
      ) : null}

      {avisoBloqueio ? (
        <div
          className="fixed bottom-24 left-1/2 z-[60] max-w-[min(92vw,24rem)] -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-2 text-center text-sm text-white shadow-lg"
          role="status"
        >
          <button type="button" className="w-full text-left" onClick={() => limparAviso()}>
            {avisoBloqueio}
          </button>
        </div>
      ) : null}
    </>
  )
}
