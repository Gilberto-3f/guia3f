'use client'

interface Props {
  dados: { label: string; valor: number; percentual?: number; cor?: string }[]
  titulo?: string
  destaque?: string
  destaqueLabel?: string
  semTitulo?: boolean
  embed?: boolean
  /** Exibe barras mesmo com valor zero. */
  mostrarComZero?: boolean
}

export default function GraficoBarras({
  dados,
  titulo = '',
  destaque,
  destaqueLabel,
  semTitulo = false,
  embed = false,
  mostrarComZero = false,
}: Props) {
  const maxValor = Math.max(...dados.map((d) => d.valor), 1)
  const wrap = embed ? 'min-h-[12rem]' : 'min-h-[12rem] rounded-lg border bg-white p-4'
  const vazio = dados.length === 0 || (!mostrarComZero && dados.every((d) => d.valor === 0))

  if (vazio) {
    return (
      <div className={wrap}>
        {!semTitulo && titulo ? <h3 className="mb-4 font-bold text-[#001f3f]">{titulo}</h3> : null}
        <div className="flex h-48 items-center justify-center text-sm text-gray-500">Nenhum dado disponível no período</div>
      </div>
    )
  }

  return (
    <div className={wrap}>
      {!semTitulo && titulo ? <h3 className="mb-4 font-bold text-[#001f3f]">{titulo}</h3> : null}
      <div className="space-y-3">
        {dados.map((item) => (
          <div key={item.label} title={`${item.label}: ${item.valor.toLocaleString('pt-BR')}${item.percentual !== undefined ? ` (${item.percentual.toFixed(0)}%)` : ''}`}>
            <div className="mb-1 flex justify-between text-sm text-gray-900">
              <span className="truncate pr-2 font-medium text-gray-900">{item.label}</span>
              <span className="font-medium tabular-nums text-[#001f3f]">
                {item.valor.toLocaleString('pt-BR')}
                {item.percentual !== undefined ? ` (${item.percentual.toFixed(0)}%)` : ''}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-200">
              <div
                className={`h-2 rounded-full transition-all ${destaque === item.label ? 'bg-yellow-500' : ''}`}
                style={{
                  width: `${(item.valor / maxValor) * 100}%`,
                  backgroundColor: destaque === item.label ? undefined : item.cor ?? '#0097b2',
                  minWidth: item.valor > 0 ? '4px' : '0',
                }}
              />
            </div>
          </div>
        ))}
      </div>
      {destaqueLabel ? <p className="mt-3 text-xs text-gray-500">{destaqueLabel}</p> : null}
    </div>
  )
}
