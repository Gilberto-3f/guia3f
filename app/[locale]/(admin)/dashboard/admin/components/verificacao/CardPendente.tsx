'use client'

import { useState } from 'react'
import { BotaoAprovar } from './BotaoAprovar'
import { BotaoReprovar } from './BotaoReprovar'
import { VisualizadorDocs } from './VisualizadorDocs'
import { StatusBadge } from '../shared/StatusBadge'
import { usePermissao } from '../../hooks/usePermissao'

export type CadastroPendente = {
  id: string
  nome: string
  username: string
  label: string
  dataCadastro: string
  alerta: string | null
  docsVerificado: boolean
  docsVerificadoEm?: string | null
  placaVermelha?: boolean
  raw: Record<string, unknown>
}

export function CardPendente({
  item,
  tipo,
  checked,
  onToggle,
  onAprovar,
  onReprovar,
  onDocsVerificado,
}: {
  item: CadastroPendente
  tipo: 'turistas' | 'profissionais' | 'empresas'
  checked: boolean
  onToggle: () => void
  onAprovar: () => void
  onReprovar: (motivo: string) => void
  onDocsVerificado: () => void
}) {
  const [modalAberto, setModalAberto] = useState(false)
  const { podeExecutarRecurso } = usePermissao()

  return (
    <>
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <label className="flex min-w-0 items-start gap-3 sm:flex-[2]">
            <input type="checkbox" className="mt-1 h-4 w-4" checked={checked} onChange={onToggle} disabled={!item.docsVerificado} />
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-gray-900">
                {item.nome} · <span className="font-semibold text-gray-600">{item.username}</span> ·{' '}
                <span className="font-semibold text-gray-700">{item.label}</span>
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Cadastro: {item.dataCadastro} {item.alerta ? <span className="ml-2">{item.alerta}</span> : null}
                {item.placaVermelha ? <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-blue-700">Placa vermelha</span> : null}
              </div>
              <div className="mt-2">
                {item.docsVerificado ? (
                  <StatusBadge tone="ok">Documentos verificados {item.docsVerificadoEm ? `em ${item.docsVerificadoEm}` : ''}</StatusBadge>
                ) : (
                  <StatusBadge tone="danger">Documentos não verificados</StatusBadge>
                )}
              </div>
            </div>
          </label>

          <div className="flex flex-wrap items-center gap-2 sm:flex-[1] sm:justify-end">
            <button
              type="button"
              onClick={() => setModalAberto(true)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              Docs
            </button>
            {!item.docsVerificado ? (
              <button
                type="button"
                onClick={onDocsVerificado}
                className="rounded-xl bg-blue-100 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-200"
              >
                Marcar verificado
              </button>
            ) : null}
            {podeExecutarRecurso('aprovar') ? <BotaoAprovar onConfirm={onAprovar} /> : null}
            {podeExecutarRecurso('reprovar') ? <BotaoReprovar onConfirm={onReprovar} /> : null}
          </div>
        </div>
      </div>
      <VisualizadorDocs
        aberto={modalAberto}
        onClose={() => setModalAberto(false)}
        pendente={item.raw}
        tipo={tipo}
        onMarcarVerificado={onDocsVerificado}
      />
    </>
  )
}

