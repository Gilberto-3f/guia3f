'use client'

export function MetricaResumoCentral({
  valor,
  unidade,
  observacao,
}: {
  valor: string | number
  unidade?: string
  observacao?: string
}) {
  return (
    <div className="mx-auto max-w-sm py-2 text-center">
      <p className="text-3xl font-bold text-gray-900">{valor}</p>
      {unidade ? <p className="mt-1 text-xs font-medium text-gray-500">{unidade}</p> : null}
      {observacao ? <p className="mt-2 text-xs text-gray-400">{observacao}</p> : null}
    </div>
  )
}
