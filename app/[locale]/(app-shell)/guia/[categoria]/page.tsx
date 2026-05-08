'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import CardAtrativo from '@/components/CardAtrativo'

/** Slug da URL (GradeFiltros) → valor de empresas.categoria no cadastro */
const SLUG_PARA_CATEGORIA_DB: Record<string, string> = {
  gastronomia: 'Restaurantes',
  passeios: 'Atrativos',
  lojas: 'Lojas',
  hospedagem: 'Hospedagem',
  compras: 'Compras Paraguai',
  eventos: 'Eventos',
  mobilidade: 'Mobilidade',
}

// FIX: apenas 3 filtros fixos (bandeiras)
type PaisFiltro = 'br' | 'py' | 'ar'

// FIX: bandeira → empresas.cidade no cadastro
// Observação: mantemos os nomes já usados no projeto para compatibilidade.
const CIDADE_POR_PAIS: Record<PaisFiltro, string> = {
  br: 'Foz do Iguaçu',
  py: 'Ciudad del Este',
  ar: 'Puerto Iguazu',
}

const TITULO_CATEGORIA: Record<string, string> = {
  gastronomia: 'Gastronomia',
  passeios: 'Passeios',
  lojas: 'Lojas',
  hospedagem: 'Hospedagem',
  compras: 'Compras Paraguai',
  eventos: 'Eventos',
  mobilidade: 'Mobilidade',
}

type Empresa = {
  id: string
  nome_fantasia: string
  nome_usuario: string | null
  foto_url: string | null
  descricao_curta: string | null
  nota_media: number | null
  categoria: string
  cidade: string
  status?: string | null
  whatsapp?: string | null
  preco_ticket_inteira?: number | null
  preco_ticket_meia?: number | null
  preco_diaria?: number | null
}

export default function ListagemCategoriaPage() {
  const params = useParams()
  const router = useRouter()
  const slug = typeof params.categoria === 'string' ? params.categoria : params.categoria?.[0] ?? ''

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)
  const [erroLista, setErroLista] = useState('')
  const [pais, setPais] = useState<PaisFiltro>('br')

  const categoriaDb = SLUG_PARA_CATEGORIA_DB[slug] ?? slug
  const cidadeDb = useMemo(() => CIDADE_POR_PAIS[pais], [pais])

  const carregarEmpresas = useCallback(async () => {
    setLoading(true)
    setErroLista('')
    try {
      const { data: empresasData, error } = await supabase
        .from('empresas')
        // FIX: seleciona só o necessário (melhor para tsc/typing e rede)
        .select(
          'id, nome_fantasia, nome_usuario, descricao_curta, categoria, cidade, status, nota_media, foto_url, whatsapp, preco_ticket_inteira, preco_ticket_meia, preco_diaria'
        )
        .eq('categoria', categoriaDb)
        .eq('cidade', cidadeDb)
        // FIX: apenas aprovadas
        .eq('status', 'aprovado')
        // FIX: exibir apenas com foto
        .not('foto_url', 'is', null)
        // FIX: melhores avaliados primeiro
        .order('nota_media', { ascending: false })

      if (error) {
        setErroLista(error.message)
        setEmpresas([])
        return
      }
      setEmpresas((empresasData ?? []) as Empresa[])
    } finally {
      setLoading(false)
    }
  }, [categoriaDb, cidadeDb])

  useEffect(() => {
    carregarEmpresas()
  }, [carregarEmpresas])

  const titulo = TITULO_CATEGORIA[slug] ?? slug

  return (
    <>
      <div className="sticky top-0 z-20 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-3 p-4">
          <button type="button" onClick={() => router.back()} className="-ml-1 p-1" aria-label="Voltar">
            <ArrowLeft size={24} className="text-gray-600" />
          </button>
          <h1 className="text-xl font-bold text-gray-800">{titulo}</h1>
        </div>

        {/* FIX: cabeçalho de filtros com 3 bandeiras reais */}
        <div className="px-4 pb-3">
          <div className="flex items-center justify-center gap-3">
            {(
              [
                { id: 'br', src: '/flags/br.svg', alt: 'Brasil' },
                { id: 'py', src: '/flags/py.svg', alt: 'Paraguai' },
                { id: 'ar', src: '/flags/ar.svg', alt: 'Argentina' },
              ] as const
            ).map((f) => {
              const ativo = pais === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setPais(f.id)}
                  aria-label={f.alt}
                  className={`relative rounded-full p-1 transition ${
                    ativo ? 'ring-2 ring-[#0097b2]' : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  <Image
                    src={f.src}
                    alt={f.alt}
                    width={44}
                    height={44}
                    className={`h-11 w-11 rounded-full object-cover ${ativo ? 'brightness-110' : ''}`}
                  />
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="p-4">
        {erroLista ? <p className="mb-4 text-center text-sm text-red-600">{erroLista}</p> : null}
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-pulse text-gray-400">Carregando...</div>
          </div>
        ) : empresas.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-gray-400">Nenhuma empresa encontrada nesta região</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {empresas.map((empresa) => (
              <CardAtrativo key={empresa.id} empresa={empresa} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
