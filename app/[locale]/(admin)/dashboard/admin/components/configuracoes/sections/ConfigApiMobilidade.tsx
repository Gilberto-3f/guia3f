'use client'

import type { ConfigAPIs } from '../../../types/admin.types'

function CamposCanalMobilidade({
  titulo,
  descricao,
  localApis,
  setLocalApis,
  podeEditar,
  prefix,
}: {
  titulo: string
  descricao: string
  localApis: ConfigAPIs
  setLocalApis: (next: ConfigAPIs) => void
  podeEditar: boolean
  prefix: 'foz' | 'cde'
}) {
  const urlKey = prefix === 'foz' ? 'api_mobilidade_url_foz' : 'api_mobilidade_url_cde'
  const keyKey = prefix === 'foz' ? 'api_mobilidade_key_foz' : 'api_mobilidade_key_cde'
  const linkKey = prefix === 'foz' ? 'app_parceiro_link_foz' : 'app_parceiro_link_cde'

  return (
    <div className="rounded-xl border border-gray-100 bg-[#f5f5f5] p-3">
      <p className="text-sm font-bold text-[#0097b2]">{titulo}</p>
      <p className="mt-0.5 text-xs text-gray-500">{descricao}</p>
      <div className="mt-3 grid grid-cols-1 gap-3">
        <label className="text-sm font-semibold text-gray-700">
          API URL
          <input
            type="text"
            value={localApis[urlKey]}
            onChange={(e) => setLocalApis({ ...localApis, [urlKey]: e.target.value })}
            disabled={!podeEditar}
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm disabled:opacity-60"
            placeholder="https://api.parceiro-local.com/v1"
          />
        </label>
        <label className="text-sm font-semibold text-gray-700">
          API key
          <input
            type="password"
            value={localApis[keyKey]}
            onChange={(e) => setLocalApis({ ...localApis, [keyKey]: e.target.value })}
            disabled={!podeEditar}
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm disabled:opacity-60"
            placeholder="api_key_xxxxx"
          />
        </label>
        <label className="text-sm font-semibold text-gray-700">
          Link do app parceiro (profissionais)
          <span className="mt-0.5 block text-xs font-normal text-gray-500">
            Botão APP PARCEIRO no Espaço Profissional (loja ou deep link).
          </span>
          <input
            type="url"
            value={localApis[linkKey]}
            onChange={(e) => setLocalApis({ ...localApis, [linkKey]: e.target.value })}
            disabled={!podeEditar}
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm disabled:opacity-60"
            placeholder="https://play.google.com/store/apps/details?id=..."
          />
        </label>
      </div>
    </div>
  )
}

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
      <p className="text-xs text-gray-500">
        Dois canais independentes: deslocamento urbano dentro de Foz usa o parceiro de Foz;
        dentro de CDE, o parceiro de CDE.
      </p>
      <CamposCanalMobilidade
        titulo="Foz do Iguaçu"
        descricao="Solicitações com partida e destino em Foz."
        localApis={localApis}
        setLocalApis={setLocalApis}
        podeEditar={podeEditar}
        prefix="foz"
      />
      <CamposCanalMobilidade
        titulo="Ciudad del Este (CDE)"
        descricao="Solicitações com partida e destino em CDE."
        localApis={localApis}
        setLocalApis={setLocalApis}
        podeEditar={podeEditar}
        prefix="cde"
      />
    </div>
  )
}
