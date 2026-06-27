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
    </div>
  )
}
