'use client'

import { useEffect, useMemo, useState } from 'react'
import { Car, Handshake, Smartphone, UserRound } from 'lucide-react'
import ChevronPasta from '@/app/[locale]/(app-shell)/empresa/components/menu-empresa/hospedagem/ChevronPasta'
import { useFinanceiroAdm, type ConfiguracoesComissoes } from '../../../hooks/useFinanceiroAdm'

const AZUL = '#0097b2'
const VERDE = '#00D443'

type PastaId = 'empresas' | 'mobilidade' | 'urbana'
type ModeloId = 'com-indicacao' | 'sem-indicacao'

function limitarPercentual(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
}

function CampoPercentual({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string
  value: number
  onChange?: (value: number) => void
  disabled?: boolean
}) {
  return (
    <label className="block text-sm font-medium text-gray-700">
      {label}
      <input
        type="number"
        min={0}
        max={100}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange?.(limitarPercentual(Number(e.target.value)))}
        className={`mt-1 w-full rounded-lg border p-2 text-gray-900 ${
          disabled ? 'border-gray-200 bg-gray-100 text-gray-500' : 'border-gray-300 bg-white'
        }`}
      />
    </label>
  )
}

export function ConfigComissoes() {
  const { config, loading, salvarConfiguracoes, isAdminFinanceiro } = useFinanceiroAdm()
  const [localConfig, setLocalConfig] = useState<ConfiguracoesComissoes | null>(null)
  const [pastaAberta, setPastaAberta] = useState<PastaId | null>(null)
  const [modeloAberto, setModeloAberto] = useState<ModeloId | null>(null)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null)

  useEffect(() => {
    if (config) {
      setLocalConfig(JSON.parse(JSON.stringify(config)) as ConfiguracoesComissoes)
    }
  }, [config])

  const totalComIndicacao = useMemo(() => {
    if (!localConfig) return 0
    const mobilidade = localConfig.mobilidade_tabelada
    return (
      Number(mobilidade?.regular ?? 0) +
      Number(mobilidade?.indicador ?? 0) +
      Number(mobilidade?.plataforma ?? 0)
    )
  }, [localConfig])

  if (!isAdminFinanceiro) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Apenas financeiro/ADM GERAL podem editar comissões.
      </div>
    )
  }

  if (loading || !localConfig) {
    return <div className="p-4 text-sm text-gray-500">Carregando configurações de comissão...</div>
  }

  const updateNested = (path: string[], value: number) => {
    setLocalConfig((prev) => {
      if (!prev) return prev
      const cloned = JSON.parse(JSON.stringify(prev)) as ConfiguracoesComissoes
      let cursor: Record<string, unknown> = cloned as unknown as Record<string, unknown>
      for (let i = 0; i < path.length - 1; i++) {
        cursor = cursor[path[i]] as Record<string, unknown>
      }
      cursor[path[path.length - 1]] = limitarPercentual(value)
      return cloned
    })
    setFeedback(null)
  }

  const handleSalvar = async () => {
    if (totalComIndicacao !== 100) {
      setFeedback({
        tipo: 'erro',
        texto: `No modelo com indicação, os percentuais devem somar 100%. Total atual: ${totalComIndicacao}%.`,
      })
      return
    }

    setSaving(true)
    setFeedback(null)
    const res = await salvarConfiguracoes(localConfig)
    setFeedback(
      res.success
        ? { tipo: 'sucesso', texto: 'Configurações de comissão salvas com sucesso.' }
        : { tipo: 'erro', texto: 'Erro ao salvar configurações.' },
    )
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      {feedback ? (
        <div
          className={`rounded-lg p-3 text-sm ${
            feedback.tipo === 'sucesso' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {feedback.texto}
        </div>
      ) : null}

      <ChevronPasta
        titulo="Parcerias — comissões de empresas"
        aberto={pastaAberta === 'empresas'}
        onToggle={() => setPastaAberta((atual) => (atual === 'empresas' ? null : 'empresas'))}
        icone={Handshake}
        corTitulo={AZUL}
      >
        <p className="mb-3 text-xs text-gray-500">
          Divisão fixa das bonificações cadastradas pelas empresas. Esta regra não altera o valor da rota.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <CampoPercentual
            label="Profissional indicado (%)"
            value={Number(localConfig.empresa_split?.regular ?? 50)}
            disabled
          />
          <CampoPercentual
            label="Parceiro que indicou (%)"
            value={Number(localConfig.empresa_split?.indicador ?? 50)}
            disabled
          />
        </div>
      </ChevronPasta>

      <ChevronPasta
        titulo="Mobilidade - serviços particulares"
        aberto={pastaAberta === 'mobilidade'}
        onToggle={() => setPastaAberta((atual) => (atual === 'mobilidade' ? null : 'mobilidade'))}
        icone={Car}
        corTitulo={AZUL}
      >
        <div className="space-y-4">
          <div className="max-w-xs">
            <CampoPercentual
              label="Taxa sobre o valor tabelado (%)"
              value={Number(localConfig.mobilidade_tabelada?.taxa ?? 0)}
              onChange={(value) => updateNested(['mobilidade_tabelada', 'taxa'], value)}
            />
            <p className="mt-1 text-xs text-gray-500">Valor permitido: de 0% a 100%.</p>
          </div>

          <ChevronPasta
            titulo="Modelo 1 - Com Indicação"
            aberto={modeloAberto === 'com-indicacao'}
            onToggle={() =>
              setModeloAberto((atual) => (atual === 'com-indicacao' ? null : 'com-indicacao'))
            }
            icone={Handshake}
            corTitulo={VERDE}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <CampoPercentual
                label="Profissional executor (%)"
                value={Number(localConfig.mobilidade_tabelada?.regular ?? 0)}
                onChange={(value) => updateNested(['mobilidade_tabelada', 'regular'], value)}
              />
              <CampoPercentual
                label="Parceiro que indicou (%)"
                value={Number(localConfig.mobilidade_tabelada?.indicador ?? 0)}
                onChange={(value) => updateNested(['mobilidade_tabelada', 'indicador'], value)}
              />
              <CampoPercentual
                label="Plataforma (%)"
                value={Number(localConfig.mobilidade_tabelada?.plataforma ?? 0)}
                onChange={(value) => updateNested(['mobilidade_tabelada', 'plataforma'], value)}
              />
            </div>
            <p
              className={`mt-3 text-xs font-semibold ${
                totalComIndicacao === 100 ? 'text-emerald-700' : 'text-red-700'
              }`}
            >
              Total: {totalComIndicacao}% {totalComIndicacao === 100 ? '— válido' : '— deve somar 100%'}
            </p>
          </ChevronPasta>

          <ChevronPasta
            titulo="Modelo 2 - Sem Indicação"
            aberto={modeloAberto === 'sem-indicacao'}
            onToggle={() =>
              setModeloAberto((atual) => (atual === 'sem-indicacao' ? null : 'sem-indicacao'))
            }
            icone={UserRound}
            corTitulo={VERDE}
          >
            <p className="mb-3 text-xs text-gray-500">
              Quando o algoritmo localiza o profissional, o executor recebe integralmente o valor tabelado.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <CampoPercentual label="Profissional executor (%)" value={100} disabled />
              <CampoPercentual label="Plataforma (%)" value={0} disabled />
            </div>
          </ChevronPasta>
        </div>
      </ChevronPasta>

      <ChevronPasta
        titulo="Mobilidade urbana (App Parceiro)"
        aberto={pastaAberta === 'urbana'}
        onToggle={() => setPastaAberta((atual) => (atual === 'urbana' ? null : 'urbana'))}
        icone={Smartphone}
        corTitulo={AZUL}
      >
        <p className="text-sm text-gray-600">
          A plataforma atua somente como canal de venda. Taxa da plataforma: <strong>0% (fixo)</strong>.
        </p>
      </ChevronPasta>

      <button
        type="button"
        onClick={() => void handleSalvar()}
        disabled={saving || totalComIndicacao !== 100}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00D443] px-4 py-3 text-sm font-bold text-white hover:bg-[#00b83b] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-40"
      >
        <UserRound className="h-5 w-5 text-white" strokeWidth={2.25} aria-hidden />
        {saving ? 'SALVANDO...' : 'SALVAR'}
      </button>
    </div>
  )
}

