'use client'

import type { ConfigAPIs } from '../../../types/admin.types'

export function ConfigApiMobilidade({
  localApis,
  setLocalApis,
  podeEditar,
}: {
  localApis: ConfigAPIs
  setLocalApis: (next: ConfigAPIs) => void
  podeEditar: boolean
}) {
  return (
    <div className="grid grid-cols-1 gap-4">
      <label className="text-sm font-semibold text-gray-700">
        API URL
        <span className="mt-0.5 block text-xs font-normal text-gray-500">
          Redireciona turistas, empresas e adm ao contratar motorista de app.
        </span>
        <input
          type="text"
          value={localApis.api_mobilidade_url}
          onChange={(e) => setLocalApis({ ...localApis, api_mobilidade_url: e.target.value })}
          disabled={!podeEditar}
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
          disabled={!podeEditar}
          className="mt-1 w-full rounded-xl border border-gray-200 p-2 text-sm disabled:opacity-60"
          placeholder="api_key_xxxxx"
        />
      </label>
      <label className="text-sm font-semibold text-gray-700">
        Link do app parceiro (profissionais)
        <span className="mt-0.5 block text-xs font-normal text-gray-500">
          Aberto pelo botão APP PARCEIRO no Espaço Profissional (loja ou deep link).
        </span>
        <input
          type="url"
          value={localApis.app_parceiro_link}
          onChange={(e) => setLocalApis({ ...localApis, app_parceiro_link: e.target.value })}
          disabled={!podeEditar}
          className="mt-1 w-full rounded-xl border border-gray-200 p-2 text-sm disabled:opacity-60"
          placeholder="https://play.google.com/store/apps/details?id=..."
        />
      </label>
    </div>
  )
}
