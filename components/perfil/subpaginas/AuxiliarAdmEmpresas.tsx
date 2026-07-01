'use client'

import { useCallback, useEffect, useState } from 'react'
import { Building2, Loader2 } from 'lucide-react'
import AvatarImage from '@/components/AvatarImage'
import { Link } from '@/i18n/navigation'

type EmpresaAtribuida = {
  id: string
  empresa_id: string
  empresa: {
    empresa_id: string
    usuario_id: string | null
    nome: string
    username: string
    foto_url: string | null
  } | null
}

export default function AuxiliarAdmEmpresas() {
  const [items, setItems] = useState<EmpresaAtribuida[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const res = await fetch('/api/admin/auxiliar-adm-empresa')
      const json = (await res.json()) as { ok?: boolean; items?: EmpresaAtribuida[]; error?: string }
      if (!res.ok || !json.ok) {
        setErro(json.error ?? 'Não foi possível carregar empresas.')
        setItems([])
        return
      }
      setItems(json.items ?? [])
    } catch {
      setErro('Falha de conexão.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        Carregando empresas…
      </div>
    )
  }

  return (
    <div className="space-y-4 pt-2">
      <p className="text-sm text-gray-600">
        Empresas com Auxiliar ADM atribuído a você. Gerencie a conta de cada assinante pelo Dashboard ADM.
      </p>
      {erro ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{erro}</p> : null}
      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">Nenhuma empresa atribuída no momento.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const emp = item.empresa
            if (!emp) return null
            return (
              <li key={item.id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <AvatarImage
                  src={emp.foto_url}
                  alt={emp.nome}
                  className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-gray-100"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[#001f3f]">{emp.nome}</p>
                  <p className="truncate text-xs text-gray-500">@{emp.username || 'empresa'}</p>
                </div>
                <Link
                  href={`/empresa/${emp.empresa_id}`}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#0097b2]/10 px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#0097b2] hover:bg-[#0097b2]/15"
                >
                  <Building2 className="h-4 w-4" aria-hidden />
                  Ver
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
