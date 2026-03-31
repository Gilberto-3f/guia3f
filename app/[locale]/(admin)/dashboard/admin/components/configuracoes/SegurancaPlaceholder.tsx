'use client'

export function SegurancaPlaceholder() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
        <div className="mb-4 text-4xl">🔒</div>
        <h3 className="mb-2 text-lg font-bold text-[#001f3f]">Protocolos de segurança</h3>
        <p className="text-sm text-gray-500">Módulo em desenvolvimento. Em breve você poderá configurar:</p>
        <ul className="mt-4 list-inside list-disc text-left text-sm text-gray-500">
          <li>Autenticação em dois fatores (2FA)</li>
          <li>Políticas de senha</li>
          <li>Bloqueio de IP suspeitos</li>
          <li>Logs de acesso</li>
        </ul>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
        <div className="mb-4 text-4xl">⚡</div>
        <h3 className="mb-2 text-lg font-bold text-[#001f3f]">Protocolos de reação rápida</h3>
        <p className="text-sm text-gray-500">Módulo em desenvolvimento. Em breve você poderá configurar:</p>
        <ul className="mt-4 list-inside list-disc text-left text-sm text-gray-500">
          <li>Ações automáticas em caso de ataques</li>
          <li>Notificações de emergência</li>
          <li>Modo de contingência</li>
        </ul>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
        <div className="mb-4 text-4xl">📜</div>
        <h3 className="mb-2 text-lg font-bold text-[#001f3f]">Conformidade LGPD</h3>
        <p className="text-sm text-gray-500">Módulo em desenvolvimento. Em breve você poderá configurar:</p>
        <ul className="mt-4 list-inside list-disc text-left text-sm text-gray-500">
          <li>Consentimento de dados</li>
          <li>Portabilidade de dados</li>
          <li>Direito de exclusão</li>
          <li>Relatórios de auditoria</li>
        </ul>
      </div>
    </div>
  )
}
