'use client'

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

import type { DadosAtendimentosCidade } from '../../../hooks/useGraficosAdm'

const COLORS = ['#0097b2', '#22c55e', '#f97316', '#a855f7', '#ef4444', '#64748b']

function formatNumber(value: unknown) {
  const n = typeof value === 'number' ? value : Number(value ?? 0)
  return Number.isFinite(n) ? n.toLocaleString('pt-BR') : '0'
}

export default function AtendimentosCidade({ dados }: { dados: DadosAtendimentosCidade[] }) {
  return (
    <div className="mx-auto mt-3 h-56 w-full max-w-lg">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={dados} dataKey="total" nameKey="cidade" outerRadius={78} innerRadius={40} paddingAngle={2}>
            {dados.map((_, idx) => (
              <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: unknown, _name: unknown, props: unknown) => {
              const payload = (props as { payload?: { percentual?: number } } | null)?.payload
              const pct = typeof payload?.percentual === 'number' ? payload.percentual : 0
              return [`${formatNumber(value)} • ${pct.toFixed(1)}%`, 'Atendimentos']
            }}
            labelFormatter={(label) => String(label)}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

