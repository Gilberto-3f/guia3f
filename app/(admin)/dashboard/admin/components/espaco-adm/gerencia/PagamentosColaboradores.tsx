'use client'

import { useEffect, useState } from 'react'
import { useGerenciaAdm } from '../../../hooks/useGerenciaAdm'

export function PagamentosColaboradores() {
  const { pagamentos, listarPagamentosColaboradores, marcarPagamentoComoPago, isAdminGeral } = useGerenciaAdm()
  const [ano, setAno] = useState(new Date().getFullYear())
  const [mes, setMes] = useState(new Date().getMonth() + 1)

  useEffect(() => {
    if (isAdminGeral) {
      void listarPagamentosColaboradores(ano, mes)
    }
  }, [ano, mes, isAdminGeral, listarPagamentosColaboradores])

  if (!isAdminGeral) return null

  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

  const handlePagar = async (id: string) => {
    if (!window.confirm('Marcar este pagamento como pago?')) return
    await marcarPagamentoComoPago(id)
    await listarPagamentosColaboradores(ano, mes)
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm">
      <div className="mb-3 flex gap-2">
        <select
          className="rounded-lg border border-gray-200 px-2 py-1"
          value={mes}
          onChange={(e) => setMes(Number(e.target.value))}
        >
          {meses.map((m, idx) => (
            <option key={m} value={idx + 1}>
              {m}
            </option>
          ))}
        </select>
        <select
          className="rounded-lg border border-gray-200 px-2 py-1"
          value={ano}
          onChange={(e) => setAno(Number(e.target.value))}
        >
          {[ano - 1, ano, ano + 1].map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {pagamentos.length === 0 ? (
        <div className="py-4 text-center text-xs text-gray-500">
          Nenhum pagamento para {meses[mes - 1]} de {ano}.
        </div>
      ) : (
        <div className="space-y-2">
          {pagamentos.map((p) => (
            <div
              key={p.id}
              className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="text-sm font-semibold text-gray-900">{p.colaborador_nome}</div>
                <div className="text-xs text-gray-600">{p.colaborador_email}</div>
                <div className="mt-1 text-[11px] text-gray-500">
                  Base: R$ {p.base_calculo.toLocaleString('pt-BR')} · {p.participacao_percentual}%
                </div>
              </div>
              <div className="text-right text-xs">
                <div className="text-lg font-bold text-emerald-700">R$ {p.valor.toLocaleString('pt-BR')}</div>
                {p.status === 'pago' ? (
                  <div className="text-[11px] text-emerald-700">
                    Pago em {p.pago_em ? new Date(p.pago_em).toLocaleDateString('pt-BR') : ''}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handlePagar(p.id)}
                    className="mt-1 rounded-lg bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                  >
                    Marcar como pago
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

