'use client'

import { useEffect, useState } from 'react'
import type { ConfigGeral } from '../../types/admin.types'
import { useConfiguracoes } from '../../hooks/useConfiguracoes'

type CampoPolitica = 'politicas_privacidade' | 'termos_uso' | 'regras_ecossistema'

export function PoliticasEditaveis() {
  const { geral, loading, salvarGeral, podeEditarGeral, error: hookError } = useConfiguracoes()
  const [localGeral, setLocalGeral] = useState<ConfigGeral | null>(null)
  const [editando, setEditando] = useState<CampoPolitica | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null)

  useEffect(() => {
    if (geral) setLocalGeral({ ...geral })
  }, [geral])

  const handleSalvarTexto = async () => {
    if (!localGeral) return
    setSalvando(true)
    setMensagem(null)
    try {
      await salvarGeral(localGeral)
      setMensagem({ tipo: 'sucesso', texto: 'Texto salvo com sucesso!' })
      window.setTimeout(() => setMensagem(null), 3000)
      setEditando(null)
    } catch {
      setMensagem({ tipo: 'erro', texto: 'Erro ao salvar' })
    } finally {
      setSalvando(false)
    }
  }

  const handleSalvarPrazos = async () => {
    if (!localGeral) return
    setSalvando(true)
    setMensagem(null)
    try {
      await salvarGeral(localGeral)
      setMensagem({ tipo: 'sucesso', texto: 'Prazos salvos com sucesso!' })
      window.setTimeout(() => setMensagem(null), 3000)
    } catch {
      setMensagem({ tipo: 'erro', texto: 'Erro ao salvar prazos' })
    } finally {
      setSalvando(false)
    }
  }

  if (loading) {
    return <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">Carregando...</div>
  }
  if (hookError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">Erro: {hookError.message}</div>
    )
  }
  if (!localGeral) {
    return <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">Nenhuma configuração encontrada</div>
  }

  const politicas: { chave: CampoPolitica; titulo: string }[] = [
    { chave: 'politicas_privacidade', titulo: '📜 Políticas de Privacidade' },
    { chave: 'termos_uso', titulo: '📋 Termos de Uso' },
    { chave: 'regras_ecossistema', titulo: '🌿 Regras do Ecossistema' },
  ]

  return (
    <div className="space-y-6">
      {mensagem ? (
        <div
          className={`rounded-xl p-3 text-sm ${
            mensagem.tipo === 'sucesso' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
          }`}
        >
          {mensagem.texto}
        </div>
      ) : null}

      {politicas.map((pol) => (
        <div key={pol.chave} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-[#001f3f]">{pol.titulo}</h3>
            {podeEditarGeral && editando !== pol.chave ? (
              <button
                type="button"
                onClick={() => setEditando(pol.chave)}
                className="rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white"
              >
                ✏️ Editar
              </button>
            ) : null}
          </div>

          {editando === pol.chave && podeEditarGeral ? (
            <div className="space-y-3">
              <textarea
                value={localGeral[pol.chave]}
                onChange={(e) => setLocalGeral({ ...localGeral, [pol.chave]: e.target.value })}
                className="w-full rounded-xl border border-gray-200 p-3 font-mono text-sm"
                rows={10}
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditando(null)} className="rounded-xl bg-gray-200 px-4 py-2 text-sm font-semibold">
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleSalvarTexto()}
                  disabled={salvando}
                  className="rounded-xl bg-[#0097b2] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          ) : (
            <pre className="whitespace-pre-wrap rounded-xl bg-gray-50 p-4 font-sans text-sm text-gray-700">
              {localGeral[pol.chave] || '(nenhum texto definido)'}
            </pre>
          )}
        </div>
      ))}

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-4 text-sm font-bold text-[#001f3f]">⏱️ Prazos e limites</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-gray-700">
            Pré-aprovação turista (horas) — 24 a 72
            <input
              type="number"
              value={localGeral.prazo_pre_aprovacao_turista}
              onChange={(e) =>
                setLocalGeral({ ...localGeral, prazo_pre_aprovacao_turista: Number(e.target.value) })
              }
              disabled={!podeEditarGeral}
              className="mt-1 w-full rounded-xl border border-gray-200 p-2 text-sm disabled:opacity-60"
              min={24}
              max={72}
            />
          </label>
          <label className="text-sm font-semibold text-gray-700">
            Verificação documentos (horas) — 12 a 48
            <input
              type="number"
              value={localGeral.prazo_verificacao_documentos}
              onChange={(e) =>
                setLocalGeral({ ...localGeral, prazo_verificacao_documentos: Number(e.target.value) })
              }
              disabled={!podeEditarGeral}
              className="mt-1 w-full rounded-xl border border-gray-200 p-2 text-sm disabled:opacity-60"
              min={12}
              max={48}
            />
          </label>
          <label className="text-sm font-semibold text-gray-700">
            Limite fotos empresa — 10 a 50
            <input
              type="number"
              value={localGeral.limite_fotos_empresa}
              onChange={(e) => setLocalGeral({ ...localGeral, limite_fotos_empresa: Number(e.target.value) })}
              disabled={!podeEditarGeral}
              className="mt-1 w-full rounded-xl border border-gray-200 p-2 text-sm disabled:opacity-60"
              min={10}
              max={50}
            />
          </label>
          <label className="text-sm font-semibold text-gray-700">
            Limite reservas ativas — 1 a 5
            <input
              type="number"
              value={localGeral.limite_reservas_ativas}
              onChange={(e) => setLocalGeral({ ...localGeral, limite_reservas_ativas: Number(e.target.value) })}
              disabled={!podeEditarGeral}
              className="mt-1 w-full rounded-xl border border-gray-200 p-2 text-sm disabled:opacity-60"
              min={1}
              max={5}
            />
          </label>
          <label className="text-sm font-semibold text-gray-700 md:col-span-2">
            Tempo pagamento reserva (minutos) — 5 a 30
            <input
              type="number"
              value={localGeral.tempo_pagamento_reserva}
              onChange={(e) => setLocalGeral({ ...localGeral, tempo_pagamento_reserva: Number(e.target.value) })}
              disabled={!podeEditarGeral}
              className="mt-1 w-full max-w-md rounded-xl border border-gray-200 p-2 text-sm disabled:opacity-60"
              min={5}
              max={30}
            />
          </label>
        </div>

        {podeEditarGeral ? (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={handleSalvarPrazos}
              disabled={salvando}
              className="rounded-xl bg-[#0097b2] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {salvando ? 'Salvando...' : '💾 Salvar prazos'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
