'use client'

import { ConfigPlanos } from './ConfigPlanos'
import { ConfigComissoes } from './ConfigComissoes'
import { ConfigServicosTabelados } from './ConfigServicosTabelados'
import { CadastroEmpresasParceiras } from './CadastroEmpresasParceiras'
import { CanalFinanceiroAdm } from './CanalFinanceiroAdm'

export function FinanceiroAdm() {
  return (
    <div className="space-y-4">
      <CanalFinanceiroAdm />
      <ConfigPlanos />
      <ConfigComissoes />
      <ConfigServicosTabelados />
      <CadastroEmpresasParceiras />
    </div>
  )
}

