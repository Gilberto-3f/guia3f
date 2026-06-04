'use client'

import { useProfissionalGate } from '@/context/ProfissionalGateContext'

/** Faixa superior: verificação pendente ou renovação de documentos (profissional). */
export default function ProfissionalGateBanner() {
  const { loading, perfilEhProfissional, recursosProfissionaisLiberados, diasAteRevisaoDocs } = useProfissionalGate()

  if (loading || !perfilEhProfissional) return null

  if (!recursosProfissionaisLiberados) {
    return null
  }

  if (diasAteRevisaoDocs == null) return null

  if (diasAteRevisaoDocs <= 7 && diasAteRevisaoDocs >= 0) {
    return (
      <div className="sticky top-0 z-[45] border-b border-red-200 bg-red-50 px-3 py-2 text-center text-xs leading-snug text-red-950 sm:text-sm">
        <strong>Renovação de documentos:</strong> faltam <strong>{diasAteRevisaoDocs}</strong> dia(s) para o prazo
        semestral. Envie nova documentação em <strong>Menu → USUÁRIO → Anexar Documentos</strong> para evitar bloqueio.
      </div>
    )
  }

  if (diasAteRevisaoDocs <= 15) {
    return (
      <div className="sticky top-0 z-[45] border-b border-orange-200 bg-orange-50 px-3 py-2 text-center text-xs leading-snug text-orange-950 sm:text-sm">
        <strong>Renovação em breve:</strong> faltam <strong>{diasAteRevisaoDocs}</strong> dias para enviar a atualização
        obrigatória da documentação.
      </div>
    )
  }

  return null
}
