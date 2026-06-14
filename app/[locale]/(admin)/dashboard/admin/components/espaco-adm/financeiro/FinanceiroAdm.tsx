'use client'

import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { CreditCard, Handshake, Percent, Tag } from 'lucide-react'
import { AdminSecaoChevron } from '../../shared/AdminSecaoChevron'
import { ConfigPlanos } from './ConfigPlanos'
import { ConfigComissoes } from './ConfigComissoes'
import { ConfigServicosTabelados } from './ConfigServicosTabelados'
import { CadastroEmpresasParceiras } from './CadastroEmpresasParceiras'

const COR_LOGO = '#0097b2'

type SecaoId = 'planos' | 'comissoes' | 'preco-net' | 'parceiras'

type SecaoMeta = {
  titulo: string
  Icon: LucideIcon
  descricao: string
}

const SECOES: Record<SecaoId, SecaoMeta> = {
  planos: {
    titulo: 'Configuração de Planos',
    Icon: CreditCard,
    descricao: 'Valores e condições dos planos contratados pelas empresas na plataforma.',
  },
  comissoes: {
    titulo: 'Configuração de Comissões',
    Icon: Percent,
    descricao: 'Regras de divisão de comissões por tipo de serviço e modelo de indicação.',
  },
  'preco-net': {
    titulo: 'Configurações de Preço NET',
    Icon: Tag,
    descricao: 'Tabela de preços NET para tickets, reservas e serviços tabelados.',
  },
  parceiras: {
    titulo: 'Cadastro de Empresas Parceiras',
    Icon: Handshake,
    descricao: 'Cadastro e gestão das empresas parceiras da rede.',
  },
}

const ORDEM_SECOES: SecaoId[] = ['planos', 'comissoes', 'preco-net', 'parceiras']

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
      case 'comissoes':
        return <ConfigComissoes />
      case 'preco-net':
        return <ConfigServicosTabelados />
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
