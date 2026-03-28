'use client'

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

import type { DadosComissoesCategoria } from '../../../hooks/useGraficosAdm'

const COLORS = ['#0ea5e9', '#22c55e', '#f97316', '#a855f7', '#ef4444', '#64748b']

function formatBRL(value: unknown) {
  const n = typeof value === 'number' ? value : Number(value ?? 0)
  if (!Number.isFinite(n)) return 'R$ 0,00'
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

export default function ComissoesPagas({ dados }: { dados: DadosComissoesCategoria[] }) {
  return (
    <div className="mt-3 h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={dados} dataKey="total" nameKey="categoria" outerRadius={78} innerRadius={40} paddingAngle={2}>
            {dados.map((_, idx) => (
              <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: unknown, _name: unknown, props: unknown) => {
              const payload = (props as { payload?: { percentual?: number } } | null)?.payload
              const pct = typeof payload?.percentual === 'number' ? payload.percentual : 0
              return [`${formatBRL(value)} • ${pct.toFixed(1)}%`, 'Total']
            }}
            labelFormatter={(label) => String(label)}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

