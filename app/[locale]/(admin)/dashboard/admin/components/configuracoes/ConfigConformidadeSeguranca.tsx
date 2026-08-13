'use client'

import { useState } from 'react'
import { Lock, Zap } from 'lucide-react'
import { AdminSecaoChevron } from '../shared/AdminSecaoChevron'

function ConteudoProtocoloSeguranca() {
  return (
    <div className="space-y-3 text-sm text-gray-600">
      <p>Módulo em desenvolvimento. Em breve você poderá configurar:</p>
      <ul className="list-inside list-disc space-y-1">
        <li>Autenticação em dois fatores (2FA)</li>
        <li>Políticas de senha</li>
        <li>Bloqueio de IP suspeitos</li>
        <li>Logs de acesso</li>
      </ul>
    </div>
  )
}

function ConteudoProtocoloReacao() {
  return (
    <div className="space-y-3 text-sm text-gray-600">
      <p>Módulo em desenvolvimento. Em breve você poderá configurar:</p>
      <ul className="list-inside list-disc space-y-1">
        <li>Ações automáticas em caso de ataques</li>
        <li>Notificações de emergência</li>
        <li>Modo de contingência</li>
      </ul>
    </div>
  )
}

export function ConfigConformidadeSeguranca() {
  const [abertaSeguranca, setAbertaSeguranca] = useState(false)
  const [abertaReacao, setAbertaReacao] = useState(false)

  return (
    <div className="space-y-3">
      <AdminSecaoChevron
        titulo="Protocolos de segurança"
        aberta={abertaSeguranca}
        onToggle={() => setAbertaSeguranca((v) => !v)}
        icone={Lock}
        corTitulo="#0097b2"
      >
        <ConteudoProtocoloSeguranca />
      </AdminSecaoChevron>

      <AdminSecaoChevron
        titulo="Protocolos de reação rápida"
        aberta={abertaReacao}
        onToggle={() => setAbertaReacao((v) => !v)}
        icone={Zap}
        corTitulo="#0097b2"
      >
        <ConteudoProtocoloReacao />
      </AdminSecaoChevron>
    </div>
  )
}
