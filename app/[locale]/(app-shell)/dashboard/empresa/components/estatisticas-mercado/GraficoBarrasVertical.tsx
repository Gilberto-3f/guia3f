'use client'

interface ItemBarra {
  label: string
  valor: number
  cor?: string
}

interface Props {
  dados: ItemBarra[]
  titulo?: string
  semTitulo?: boolean
  embed?: boolean
}

export default function GraficoBarrasVertical({ dados, titulo = '', semTitulo = false, embed = false }: Props) {
  const maxValor = Math.max(...dados.map((d) => d.valor), 1)
  const wrap = embed ? '' : 'rounded-lg border bg-white p-4'

  return (
    <div className={wrap}>
      {!semTitulo && titulo ? <h3 className="mb-4 text-center font-bold text-[#001f3f]">{titulo}</h3> : null}
      <div className="flex items-end justify-center gap-2 sm:gap-3" style={{ minHeight: '11rem' }}>
        {dados.map((item, i) => {
          const alturaPct = maxValor > 0 ? (item.valor / maxValor) * 100 : 0
          const cor = item.cor ?? '#0097b2'
          return (
            <div key={`${item.label}-${i}`} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span className="text-[10px] font-bold tabular-nums text-[#001f3f] sm:text-xs">
                {item.valor.toLocaleString('pt-BR')}
              </span>
              <div className="flex w-full max-w-[3.5rem] flex-1 items-end justify-center" style={{ height: '8rem' }}>
                <div
                  className="w-full min-h-[2px] rounded-t-md transition-all"
                  style={{ height: `${Math.max(alturaPct, item.valor > 0 ? 4 : 0)}%`, backgroundColor: cor }}
                  title={`${item.label}: ${item.valor}`}
                />
              </div>
              <span className="max-w-full truncate text-center text-[9px] leading-tight text-gray-600 sm:text-[10px]">
                {item.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
