'use client'

import { ConfigPlanos } from './ConfigPlanos'
import { ConfigComissoes } from './ConfigComissoes'
import { ConfigServicosTabelados } from './ConfigServicosTabelados'
import { CadastroEmpresasParceiras } from './CadastroEmpresasParceiras'

export function FinanceiroAdm() {
  return (
    <div className="space-y-4">
      <ConfigPlanos />
      <ConfigComissoes />
      <ConfigServicosTabelados />
      <CadastroEmpresasParceiras />
    </div>
  )
}

