'use client'

import { useEffect, useState } from 'react'
import type { ConfigAPIs } from '../../types/admin.types'
import { useConfiguracoes } from '../../hooks/useConfiguracoes'

export function GestaoAPIs() {
  const { apis, loading, salvarAPIs, podeEditarAPIs, error: hookError } = useConfiguracoes()
  const [localApis, setLocalApis] = useState<ConfigAPIs | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null)

  useEffect(() => {
    if (apis) setLocalApis({ ...apis })
  }, [apis])

  const handleSalvar = async () => {
    if (!localApis) return
    setSalvando(true)
    setMensagem(null)
    try {
      await salvarAPIs(localApis)
      setMensagem({ tipo: 'sucesso', texto: 'Configurações salvas com sucesso!' })
      window.setTimeout(() => setMensagem(null), 3000)
    } catch {
      setMensagem({ tipo: 'erro', texto: 'Erro ao salvar configurações' })
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
  if (!localApis) {
    return <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">Nenhuma configuração encontrada</div>
  }

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

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-4 text-sm font-bold text-[#001f3f]">💳 Sistema de pagamento</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-gray-700">
            Gateway
            <select
              value={localApis.gateway}
              onChange={(e) => setLocalApis({ ...localApis, gateway: e.target.value })}
              disabled={!podeEditarAPIs}
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm disabled:opacity-60"
            >
              <option value="stripe">Stripe</option>
              <option value="mercadopago">Mercado Pago</option>
              <option value="pagseguro">PagSeguro</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-gray-700">
            Ambiente
            <select
              value={localApis.ambiente}
              onChange={(e) => setLocalApis({ ...localApis, ambiente: e.target.value as ConfigAPIs['ambiente'] })}
              disabled={!podeEditarAPIs}
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm disabled:opacity-60"
            >
              <option value="teste">Teste</option>
              <option value="producao">Produção</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-gray-700">
            Chave pública
            <input
              type="text"
              value={localApis.chave_publica}
              onChange={(e) => setLocalApis({ ...localApis, chave_publica: e.target.value })}
              disabled={!podeEditarAPIs}
              className="mt-1 w-full rounded-xl border border-gray-200 p-2 text-sm disabled:opacity-60"
              placeholder="pk_test_xxxxx"
            />
          </label>
          <label className="text-sm font-semibold text-gray-700">
            Chave secreta
            <input
              type="password"
              value={localApis.chave_secreta}
              onChange={(e) => setLocalApis({ ...localApis, chave_secreta: e.target.value })}
              disabled={!podeEditarAPIs}
              className="mt-1 w-full rounded-xl border border-gray-200 p-2 text-sm disabled:opacity-60"
              placeholder="sk_test_xxxxx"
            />
          </label>
          <label className="text-sm font-semibold text-gray-700 md:col-span-2">
            Webhook secret
            <input
              type="text"
              value={localApis.webhook_secret}
              onChange={(e) => setLocalApis({ ...localApis, webhook_secret: e.target.value })}
              disabled={!podeEditarAPIs}
              className="mt-1 w-full rounded-xl border border-gray-200 p-2 text-sm disabled:opacity-60"
              placeholder="whsec_xxxxx"
            />
          </label>
          <div className="md:col-span-2">
            <div className="text-sm font-semibold text-gray-700">Moedas</div>
            <div className="mt-2 space-y-2 rounded-xl border border-gray-200 p-3">
              {['BRL', 'PYG', 'ARS', 'USD', 'EUR'].map((moeda) => (
                <label key={moeda} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={localApis.moedas.includes(moeda)}
                    onChange={(e) => {
                      const novasMoedas = e.target.checked
                        ? [...localApis.moedas, moeda]
                        : localApis.moedas.filter((m) => m !== moeda)
                      setLocalApis({ ...localApis, moedas: novasMoedas })
                    }}
                    disabled={!podeEditarAPIs}
                  />
                  <span>{moeda}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-4 text-sm font-bold text-[#001f3f]">🚗 Mobilidade</h3>
        <div className="grid grid-cols-1 gap-4">
          <label className="text-sm font-semibold text-gray-700">
            API URL
            <input
              type="text"
              value={localApis.api_mobilidade_url}
              onChange={(e) => setLocalApis({ ...localApis, api_mobilidade_url: e.target.value })}
              disabled={!podeEditarAPIs}
              className="mt-1 w-full rounded-xl border border-gray-200 p-2 text-sm disabled:opacity-60"
              placeholder="https://api.parceiro.com/v1"
            />
          </label>
          <label className="text-sm font-semibold text-gray-700">
            API key
            <input
              type="password"
              value={localApis.api_mobilidade_key}
              onChange={(e) => setLocalApis({ ...localApis, api_mobilidade_key: e.target.value })}
              disabled={!podeEditarAPIs}
              className="mt-1 w-full rounded-xl border border-gray-200 p-2 text-sm disabled:opacity-60"
              placeholder="api_key_xxxxx"
            />
          </label>
        </div>
      </div>

      {podeEditarAPIs ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSalvar}
            disabled={salvando}
            className="rounded-xl bg-[#0097b2] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {salvando ? 'Salvando...' : '💾 Salvar configurações'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
