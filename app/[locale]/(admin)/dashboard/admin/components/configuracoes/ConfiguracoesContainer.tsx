'use client'

import { useMemo } from 'react'
import { useAdminNav } from '../../context/AdminNavContext'
import { useSharedAdminGate } from '../../context/AdminPermissaoContext'
import { podeAcessar } from '../../utils/permissoes'
import {
  ConfiguracoesTabs,
  coerceConfigSubaba,
  configSubPrincipal,
  parseConfigSub,
} from './ConfiguracoesTabs'
import { SubabasConformidade } from './SubabasConformidade'
import { ConfigGeralPastas } from './ConfigGeralPastas'
import { ConfigConformidadeAplicativo } from './ConfigConformidadeAplicativo'
import { ConfigConformidadeSeguranca } from './ConfigConformidadeSeguranca'

export function ConfiguracoesBarraFixa({ sub }: { sub: string }) {
  const { selectSub } = useAdminNav()
  const parsed = useMemo(() => parseConfigSub(sub), [sub])
  const activeMain = coerceConfigSubaba(sub)

  return (
    <div className="space-y-2 border-t border-gray-100 bg-white px-3 py-2.5 sm:px-4">
      <ConfiguracoesTabs
        value={activeMain}
        onChange={(next) => {
          if (next === 'conformidade') {
            selectSub('configuracoes', configSubPrincipal('conformidade', parsed.conformidade))
          } else {
            selectSub('configuracoes', 'geral')
          }
        }}
      />
      {activeMain === 'conformidade' ? <SubabasConformidade value={parsed.conformidade} /> : null}
    </div>
  )
}

export function ConfiguracoesContainer({ sub }: { sub: string }) {
  const gate = useSharedAdminGate()
  const parsed = useMemo(() => parseConfigSub(sub), [sub])

  if (gate.status !== 'ok') return null
  const admin = gate.admin

  const allowed =
    parsed.main === 'geral'
      ? podeAcessar(admin, 'configuracoes.apis') || podeAcessar(admin, 'configuracoes.geral')
      : parsed.conformidade === 'aplicativo'
        ? podeAcessar(admin, 'configuracoes.geral')
        : podeAcessar(admin, 'configuracoes.seguranca')

  return (
    <div className="space-y-4">
      {!allowed ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Você não tem permissão para acessar esta seção.
        </div>
      ) : parsed.main === 'geral' ? (
        <ConfigGeralPastas />
      ) : parsed.conformidade === 'aplicativo' ? (
        <ConfigConformidadeAplicativo />
      ) : (
        <ConfigConformidadeSeguranca />
      )}
    </div>
  )
}
