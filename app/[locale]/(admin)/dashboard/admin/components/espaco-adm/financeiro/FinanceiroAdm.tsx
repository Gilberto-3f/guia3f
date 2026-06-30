'use client'

import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { CreditCard, Handshake, Percent, Users } from 'lucide-react'
import { AdminSecaoChevron } from '../../shared/AdminSecaoChevron'
import { ConfigPlanos } from './ConfigPlanos'
import { ConfigComissoes } from './ConfigComissoes'
import { CadastroEmpresasParceiras } from './CadastroEmpresasParceiras'
import { GestaoAssinaturas } from './GestaoAssinaturas'

const COR_LOGO = '#0097b2'

type SecaoId = 'planos' | 'assinaturas' | 'comissoes' | 'parceiras'

type SecaoMeta = {
  titulo: string
  Icon: LucideIcon
  descricao: string
}

const SECOES: Record<SecaoId, SecaoMeta> = {
  planos: {
    titulo: 'Configuração de Planos',
    Icon: CreditCard,
    descricao: '',
  },
  assinaturas: {
    titulo: 'Gestão de Assinaturas',
    Icon: Users,
    descricao: 'Solicitações em dinheiro e assinantes ativos, inativos ou em degustação.',
  },
  comissoes: {
    titulo: 'Gestão de Comissões',
    Icon: Percent,
    descricao: 'Regras de divisão de comissões por tipo de serviço e modelo de indicação.',
  },
  parceiras: {
    titulo: 'Empresas Parceiras',
    Icon: Handshake,
    descricao: 'Cadastro e gestão das empresas parceiras da rede.',
  },
}

const ORDEM_SECOES: SecaoId[] = ['planos', 'assinaturas', 'comissoes', 'parceiras']

export function FinanceiroAdm() {
  const [secoes, setSecoes] = useState<Record<SecaoId, boolean>>(() =>
    Object.fromEntries(ORDEM_SECOES.map((id) => [id, false])) as Record<SecaoId, boolean>,
  )

  const toggle = (id: SecaoId) => {
    setSecoes((p) => ({ ...p, [id]: !p[id] }))
  }

  function renderConteudo(id: SecaoId) {
    switch (id) {
      case 'planos':
        return <ConfigPlanos />
      case 'assinaturas':
        return <GestaoAssinaturas />
      case 'comissoes':
        return <ConfigComissoes />
      case 'parceiras':
        return <CadastroEmpresasParceiras />
      default:
        return null
    }
  }

  return (
    <div className="space-y-2">
      {ORDEM_SECOES.map((id) => {
        const meta = SECOES[id]
        return (
          <AdminSecaoChevron
            key={id}
            titulo={meta.titulo}
            tituloGrande
            icone={meta.Icon}
            corTitulo={COR_LOGO}
            aberta={secoes[id]}
            onToggle={() => toggle(id)}
            descricao={meta.descricao}
          >
            {renderConteudo(id)}
          </AdminSecaoChevron>
        )
      })}
    </div>
  )
}
