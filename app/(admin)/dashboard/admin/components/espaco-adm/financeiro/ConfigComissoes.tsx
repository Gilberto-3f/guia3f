'use client'

import { useEffect, useState } from 'react'
import { useFinanceiroAdm, type ConfiguracoesComissoes } from '../../../hooks/useFinanceiroAdm'

export function ConfigComissoes() {
  const { config, loading, salvarConfiguracoes, isAdminFinanceiro } = useFinanceiroAdm()
  const [localConfig, setLocalConfig] = useState<ConfiguracoesComissoes | null>(null)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null)

  useEffect(() => {
    if (config) {
      setLocalConfig(JSON.parse(JSON.stringify(config)) as ConfiguracoesComissoes)
    }
  }, [config])

  if (!isAdminFinanceiro) {
    return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Apenas financeiro/ADM GERAL podem editar comissões.</div>
  }

  if (loading || !localConfig) {
    return <div className="p-4 text-sm text-gray-500">Carregando configurações de comissão...</div>
  }

  const setCfg = (next: Partial<ConfiguracoesComissoes>) => {
    setLocalConfig((prev) => (prev ? { ...prev, ...next } : prev))
  }

  const handleSalvar = async () => {
    if (!localConfig) return
    setSaving(true)
    setFeedback(null)
    const res = await salvarConfiguracoes(localConfig)
    if (res.success) {
      setFeedback({ tipo: 'sucesso', texto: 'Configurações de comissão salvas com sucesso.' })
    } else {
      setFeedback({ tipo: 'erro', texto: 'Erro ao salvar configurações.' })
    }
    setSaving(false)
  }

  const updateNested = (path: string[], value: number) => {
    setLocalConfig((prev) => {
      if (!prev) return prev
      const cloned = JSON.parse(JSON.stringify(prev)) as ConfiguracoesComissoes
      let cursor: any = cloned
      for (let i = 0; i < path.length - 1; i++) {
        cursor = cursor[path[i]]
      }
      cursor[path[path.length - 1]] = value
      return cloned
    })
  }

  return (
    <div className="space-y-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-sm font-bold text-gray-900">Configuração de Comissões</div>
      {feedback ? (
        <div
          className={`rounded-lg p-2 text-sm ${
            feedback.tipo === 'sucesso' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {feedback.texto}
        </div>
      ) : null}

      {/* 1. Comissão de Empresa */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="font-bold text-[#001f3f] mb-4">1. Comissão de Empresa</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Profissional Regular</label>
            <input
              type="number"
              value={localConfig.empresa_split?.regular || 50}
              disabled
              className="w-full border rounded-lg p-2 bg-gray-100"
            />
            <p className="text-xs text-gray-500 mt-1">Fixo 50%</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Parceiro que indicou</label>
            <input
              type="number"
              value={localConfig.empresa_split?.indicador || 50}
              disabled
              className="w-full border rounded-lg p-2 bg-gray-100"
            />
            <p className="text-xs text-gray-500 mt-1">Fixo 50%</p>
          </div>
        </div>
      </div>

      {/* 2. Serviço Particular */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="font-bold text-[#001f3f] mb-4">2. Serviço Particular</h3>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">Taxa sobre valor tabelado (%)</label>
          <input
            type="number"
            value={localConfig.servico_particular?.taxa || 20}
            onChange={(e) => updateNested(['servico_particular', 'taxa'], Number(e.target.value) || 0)}
            className="w-32 border rounded-lg p-2"
          />
        </div>

        {/* Modelo 1 - Com Indicação */}
        <div className="border-t pt-4 mt-4">
          <h4 className="font-medium mb-2">Modelo 1 - Com Indicação</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm">Profissional Regular (%)</label>
              <input
                type="number"
                value={localConfig.servico_particular?.modelo_com_indicacao?.regular || 50}
                onChange={(e) =>
                  updateNested(['servico_particular', 'modelo_com_indicacao', 'regular'], Number(e.target.value) || 0)
                }
                className="w-full border rounded-lg p-2"
              />
            </div>
            <div>
              <label className="block text-sm">Parceiro que indicou (%)</label>
              <input
                type="number"
                value={localConfig.servico_particular?.modelo_com_indicacao?.indicador || 30}
                onChange={(e) =>
                  updateNested(['servico_particular', 'modelo_com_indicacao', 'indicador'], Number(e.target.value) || 0)
                }
                className="w-full border rounded-lg p-2"
              />
            </div>
            <div>
              <label className="block text-sm">Empresa Parceira (%)</label>
              <input
                type="number"
                value={localConfig.servico_particular?.modelo_com_indicacao?.empresa_parceira || 10}
                onChange={(e) =>
                  updateNested(
                    ['servico_particular', 'modelo_com_indicacao', 'empresa_parceira'],
                    Number(e.target.value) || 0
                  )
                }
                className="w-full border rounded-lg p-2"
              />
            </div>
            <div>
              <label className="block text-sm">Plataforma (%)</label>
              <input
                type="number"
                value={localConfig.servico_particular?.modelo_com_indicacao?.plataforma || 10}
                onChange={(e) =>
                  updateNested(['servico_particular', 'modelo_com_indicacao', 'plataforma'], Number(e.target.value) || 0)
                }
                className="w-full border rounded-lg p-2"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Total deve ser 100%</p>
        </div>

        {/* Modelo 2 - Sem Indicação */}
        <div className="border-t pt-4 mt-4">
          <h4 className="font-medium mb-2">Modelo 2 - Sem Indicação</h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm">Profissional Regular (%)</label>
              <input
                type="number"
                value={localConfig.servico_particular?.modelo_sem_indicacao?.regular || 70}
                onChange={(e) =>
                  updateNested(['servico_particular', 'modelo_sem_indicacao', 'regular'], Number(e.target.value) || 0)
                }
                className="w-full border rounded-lg p-2"
              />
            </div>
            <div>
              <label className="block text-sm">Empresa Parceira (%)</label>
              <input
                type="number"
                value={localConfig.servico_particular?.modelo_sem_indicacao?.empresa_parceira || 10}
                onChange={(e) =>
                  updateNested(
                    ['servico_particular', 'modelo_sem_indicacao', 'empresa_parceira'],
                    Number(e.target.value) || 0
                  )
                }
                className="w-full border rounded-lg p-2"
              />
            </div>
            <div>
              <label className="block text-sm">Plataforma (%)</label>
              <input
                type="number"
                value={localConfig.servico_particular?.modelo_sem_indicacao?.plataforma || 20}
                onChange={(e) =>
                  updateNested(
                    ['servico_particular', 'modelo_sem_indicacao', 'plataforma'],
                    Number(e.target.value) || 0
                  )
                }
                className="w-full border rounded-lg p-2"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Total deve ser 100%</p>
        </div>
      </div>

      {/* 3. Tickets e Reservas (PREÇO NET) */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="font-bold text-[#001f3f] mb-4">3. Tickets e Reservas (PREÇO NET)</h3>
        <p className="text-sm text-gray-600 mb-4">
          Valor de revenda para o turista é o mesmo do balcão. O NET é o valor com desconto + comissão = preço de balcão.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm">Profissional que indicou (%)</label>
            <input
              type="number"
              value={localConfig.tickets_reservas?.profissional_indicador || 70}
              onChange={(e) => updateNested(['tickets_reservas', 'profissional_indicador'], Number(e.target.value) || 0)}
              className="w-full border rounded-lg p-2"
            />
          </div>
          <div>
            <label className="block text-sm">Parceiro que indicou (%)</label>
            <input
              type="number"
              value={localConfig.tickets_reservas?.parceiro_indicador || 20}
              onChange={(e) => updateNested(['tickets_reservas', 'parceiro_indicador'], Number(e.target.value) || 0)}
              className="w-full border rounded-lg p-2"
            />
          </div>
          <div>
            <label className="block text-sm">Empresa Parceira (%)</label>
            <input
              type="number"
              value={localConfig.tickets_reservas?.empresa_parceira || 5}
              onChange={(e) => updateNested(['tickets_reservas', 'empresa_parceira'], Number(e.target.value) || 0)}
              className="w-full border rounded-lg p-2"
            />
          </div>
          <div>
            <label className="block text-sm">Plataforma (%)</label>
            <input
              type="number"
              value={localConfig.tickets_reservas?.plataforma || 5}
              onChange={(e) => updateNested(['tickets_reservas', 'plataforma'], Number(e.target.value) || 0)}
              className="w-full border rounded-lg p-2"
            />
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">Total deve ser 100%</p>
      </div>

      {/* 4. Mobilidade Tabelada */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="font-bold text-[#001f3f] mb-4">4. Mobilidade Tabelada</h3>
        <div className="mb-4">
          <label className="block text-sm">Taxa sobre valor da corrida (%)</label>
          <input
            type="number"
            value={localConfig.mobilidade_tabelada?.taxa || 15}
            onChange={(e) => updateNested(['mobilidade_tabelada', 'taxa'], Number(e.target.value) || 0)}
            className="w-32 border rounded-lg p-2"
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm">Profissional Regular (%)</label>
            <input
              type="number"
              value={localConfig.mobilidade_tabelada?.regular || 60}
              onChange={(e) => updateNested(['mobilidade_tabelada', 'regular'], Number(e.target.value) || 0)}
              className="w-full border rounded-lg p-2"
            />
          </div>
          <div>
            <label className="block text-sm">Parceiro que indicou (%)</label>
            <input
              type="number"
              value={localConfig.mobilidade_tabelada?.indicador || 30}
              onChange={(e) => updateNested(['mobilidade_tabelada', 'indicador'], Number(e.target.value) || 0)}
              className="w-full border rounded-lg p-2"
            />
          </div>
          <div>
            <label className="block text-sm">Plataforma (%)</label>
            <input
              type="number"
              value={localConfig.mobilidade_tabelada?.plataforma || 10}
              onChange={(e) => updateNested(['mobilidade_tabelada', 'plataforma'], Number(e.target.value) || 0)}
              className="w-full border rounded-lg p-2"
            />
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">Total deve ser 100%</p>
      </div>

      {/* 5. Mobilidade Urbana */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="font-bold text-[#001f3f] mb-4">5. Mobilidade Urbana (App Parceiro)</h3>
        <p className="text-sm text-gray-600">Taxa plataforma: 0% (FIXO)</p>
      </div>

      <button
        type="button"
        onClick={handleSalvar}
        disabled={saving}
        className="rounded-xl bg-[#0097b2] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving ? 'Salvando...' : '💾 Salvar configurações'}
      </button>
    </div>
  )
}

