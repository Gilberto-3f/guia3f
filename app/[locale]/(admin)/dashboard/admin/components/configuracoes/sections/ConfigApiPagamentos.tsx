'use client'

import type { ConfigAPIs } from '../../../types/admin.types'

export function ConfigApiPagamentos({
  localApis,
  setLocalApis,
  podeEditar,
}: {
  localApis: ConfigAPIs
  setLocalApis: (next: ConfigAPIs) => void
  podeEditar: boolean
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <label className="text-sm font-semibold text-gray-700">
        Gateway
        <select
          value={localApis.gateway}
          onChange={(e) => setLocalApis({ ...localApis, gateway: e.target.value })}
          disabled={!podeEditar}
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
          disabled={!podeEditar}
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
          disabled={!podeEditar}
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
          disabled={!podeEditar}
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
          disabled={!podeEditar}
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
                disabled={!podeEditar}
              />
              <span>{moeda}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
