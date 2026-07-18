'use client'

import { useMemo, useState } from 'react'
import { History, PackageSearch, ShoppingCart, type LucideIcon } from 'lucide-react'
import { useEmpresaServicosPlano } from '@/hooks/useEmpresaServicosPlano'
import { empresaEhSegmentoLojasParaguai } from '@/lib/cidade-empresa'
import { useDashboardEmpresa } from '../../hooks/useDashboardEmpresa'
import AbaCatalogo from './AbaCatalogo'
import AbaComprasCde from './AbaComprasCde'
import AbaHistorico from './AbaHistorico'

const VERDE = '#00D443'

type AbaInterna = 'catalogo' | 'compras' | 'historico'

const ABAS: { id: AbaInterna; label: string; Icon: LucideIcon }[] = [
  { id: 'catalogo', label: 'Catálogo', Icon: PackageSearch },
  { id: 'compras', label: 'Compras CDE', Icon: ShoppingCart },
  { id: 'historico', label: 'Histórico', Icon: History },
]

export default function DrenaStok() {
  const { dados: empresa } = useDashboardEmpresa()
  const { temServico } = useEmpresaServicosPlano(empresa?.plano, empresa?.id)
  const [aba, setAba] = useState<AbaInterna>('catalogo')

  const isCDE = useMemo(() => {
    const cidadeOk = empresaEhSegmentoLojasParaguai(empresa?.categoria, empresa?.cidade)
    return Boolean(cidadeOk && temServico('compras_paraguai_drena'))
  }, [empresa?.categoria, empresa?.cidade, temServico])

  if (!isCDE) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-8 text-center">
        <p className="text-yellow-800">
          Drena-Stok é exclusivo para empresas de Ciudad del Este com o serviço Compras CDE no plano
          contratado.
        </p>
        <p className="mt-2 text-sm text-yellow-700">
          Faça um upgrade do seu plano para acessar esta funcionalidade.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div
        className="flex gap-1.5 rounded-2xl bg-gray-100 p-1.5 sm:gap-2"
        role="tablist"
        aria-label="Seções Drena-Stok"
      >
        {ABAS.map(({ id, label, Icon }) => {
          const ativa = aba === id
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={ativa}
              aria-label={label}
              title={label}
              onClick={() => setAba(id)}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold text-white transition sm:gap-2 sm:py-3 ${
                ativa
                  ? 'min-w-0 flex-1 px-2.5 shadow-md sm:px-3'
                  : 'w-10 shrink-0 px-0 opacity-80 hover:opacity-100 sm:w-12'
              }`}
              style={{ backgroundColor: VERDE }}
            >
              <Icon className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
              {ativa ? <span className="truncate">{label}</span> : <span className="sr-only">{label}</span>}
            </button>
          )
        })}
      </div>

      {aba === 'catalogo' ? <AbaCatalogo empresaId={empresa?.id != null ? String(empresa.id) : null} /> : null}
      {aba === 'compras' ? <AbaComprasCde /> : null}
      {aba === 'historico' ? <AbaHistorico /> : null}

      <p className="text-center text-[11px] text-gray-400">
        Dados baseados em intenções e recomendações do Compras CDE. Snapshot mensal no dia 1.
      </p>
    </div>
  )
}
