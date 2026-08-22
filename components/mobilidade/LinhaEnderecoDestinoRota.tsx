'use client'

import { useEffect, useState } from 'react'

type Props = {
  empresaId?: string | null
  destinoNome?: string | null
}

function partesEndereco(json: Record<string, unknown>): string {
  return [json.endereco, json.bairro, json.cidade]
    .map((p) => String(p ?? '').trim())
    .filter(Boolean)
    .join(', ')
}

/** Linha de endereço abaixo do nome fantasia no card azul de rota. */
export default function LinhaEnderecoDestinoRota({ empresaId, destinoNome }: Props) {
  const [linha, setLinha] = useState<string | null>(null)

  useEffect(() => {
    const id = String(empresaId ?? '').trim()
    if (!id) {
      setLinha(null)
      return
    }
    let ativo = true
    void fetch(`/api/mobilidade/empresa-destino?id=${encodeURIComponent(id)}`)
      .then(async (r) => {
        const json = (await r.json()) as { empresa?: Record<string, unknown> }
        if (!ativo || !r.ok) return
        const emp =
          json.empresa && typeof json.empresa === 'object' ? json.empresa : {}
        const s = partesEndereco(emp)
        const nome = String(destinoNome ?? '')
        if (!s || (nome && nome.toLowerCase().includes(s.toLowerCase()))) {
          setLinha(null)
          return
        }
        setLinha(s)
      })
      .catch(() => {
        if (ativo) setLinha(null)
      })
    return () => {
      ativo = false
    }
  }, [empresaId, destinoNome])

  if (!linha) return null
  return <p className="mt-0.5 text-xs leading-snug text-white/90">{linha}</p>
}
