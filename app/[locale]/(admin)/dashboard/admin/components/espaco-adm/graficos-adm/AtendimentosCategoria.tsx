'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { DadosAtendimentosCategoria } from '../../../hooks/useGraficosAdm'

function formatNumber(value: unknown) {
  const n = typeof value === 'number' ? value : Number(value ?? 0)
  return Number.isFinite(n) ? n.toLocaleString('pt-BR') : '0'
}

export default function AtendimentosCategoria({ dados }: { dados: DadosAtendimentosCategoria[] }) {
  return (
    <div className="mx-auto mt-3 h-56 w-full max-w-lg">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="categoria" tick={{ fontSize: 11 }} interval={0} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip
            formatter={(value: unknown) => [formatNumber(value), 'Total']}
            labelFormatter={(label) => String(label)}
          />
          <Bar dataKey="total" fill="#0097b2" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

