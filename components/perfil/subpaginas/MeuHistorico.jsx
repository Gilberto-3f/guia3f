'use client'

/**
 * @param {{ tipo: string }} props
 */
export default function MeuHistorico({ tipo }) {
  const titulos = {
    contratacoes: 'Contratações',
    compras: 'Compras',
    parcerias: 'Parcerias',
    recomendacoes: 'Recomendações',
  }
  const t = titulos[tipo] || 'Histórico'

  return (
    <div className="space-y-3 px-1">
      <p className="text-sm text-gray-600">
        Aqui aparecerão suas {t.toLowerCase()} registradas no Guia 3F. Funcionalidade em evolução.
      </p>
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-10 text-center text-sm text-gray-400">
        Nenhum registro ainda
      </div>
    </div>
  )
}
