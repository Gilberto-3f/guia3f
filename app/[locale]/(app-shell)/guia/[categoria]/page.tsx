'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import FiltroPais from '@/components/FiltroPais'
import Ordenacao from '@/components/Ordenacao'
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

/** Filtro país → empresas.cidade no cadastro */
const CIDADE_POR_FILTRO: Record<string, string> = {
  foz: 'Foz do Iguacu',
  cde: 'Ciudad del Este',
  puerto: 'Puerto Iguazu',
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
  foto_url: string | null
  descricao_curta: string
  nota_media: number
  categoria: string
  cidade: string
  whatsapp?: string | null
  preco_ticket_inteira?: number | null
  preco_ticket_meia?: number | null
  preco_diaria?: number | null
  is_seguindo?: boolean
}

export default function ListagemCategoriaPage() {
  const params = useParams()
  const router = useRouter()
  const slug = typeof params.categoria === 'string' ? params.categoria : params.categoria?.[0] ?? ''

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)
  const [paisSelecionado, setPaisSelecionado] = useState('foz')
  const [ordenacao, setOrdenacao] = useState<'avaliacoes' | 'proximidade'>('avaliacoes')
  const [usuarioId, setUsuarioId] = useState<string | null>(null)
  const [erroLista, setErroLista] = useState('')

  const categoriaDb = SLUG_PARA_CATEGORIA_DB[slug] ?? slug
  const cidadeDb = CIDADE_POR_FILTRO[paisSelecionado]

  const carregarEmpresas = useCallback(async () => {
    setLoading(true)
    setErroLista('')
    try {
      if (!cidadeDb) {
        setEmpresas([])
        setLoading(false)
        return
      }

      let query = supabase
        .from('empresas')
        .select('*')
        .eq('categoria', categoriaDb)
        .eq('cidade', cidadeDb)

      if (ordenacao === 'avaliacoes') {
        query = query.order('nota_media', { ascending: false })
      } else {
        // Proximidade real exige coordenadas nas empresas; fallback até o backend geo existir
        query = query.order('nome_fantasia', { ascending: true })
      }

      const { data: empresasData, error } = await query

      if (error) {
        setErroLista(error.message)
        setEmpresas([])
        return
      }

      let seguindoIds = /** @type {string[]} */ ([])
      if (usuarioId && empresasData?.length) {
        const { data: favoritos } = await supabase
          .from('favoritos')
          .select('alvo_id')
          .eq('usuario_id', usuarioId)
          .eq('alvo_tipo', 'empresa')

        seguindoIds = favoritos?.map((f) => f.alvo_id).filter((id) => id !== null && id !== undefined && id !== '') ?? []
      }

      const empresasComStatus =
        empresasData?.map((emp) => ({
          ...emp,
          nota_media: emp.nota_media != null ? Number(emp.nota_media) : 0,
          is_seguindo: seguindoIds.includes(emp.id),
          preco_ticket_inteira: emp.preco_ticket_inteira != null ? Number(emp.preco_ticket_inteira) : null,
          preco_ticket_meia: emp.preco_ticket_meia != null ? Number(emp.preco_ticket_meia) : null,
          preco_diaria: emp.preco_diaria != null ? Number(emp.preco_diaria) : null,
        })) ?? []

      setEmpresas(empresasComStatus as Empresa[])
    } finally {
      setLoading(false)
    }
  }, [categoriaDb, cidadeDb, ordenacao, usuarioId])

  useEffect(() => {
    const getUsuario = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      setUsuarioId(session?.user?.id ?? null)
    }
    getUsuario()
  }, [])

  useEffect(() => {
    carregarEmpresas()
  }, [carregarEmpresas])

  const titulo = TITULO_CATEGORIA[slug] ?? slug

  return (
    <>
      <div className="sticky top-0 z-10 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-3 p-4">
          <button type="button" onClick={() => router.back()} className="-ml-1 p-1" aria-label="Voltar">
            <ArrowLeft size={24} className="text-gray-600" />
          </button>
          <h1 className="text-xl font-bold text-gray-800">{titulo}</h1>
        </div>
      </div>

      <FiltroPais paisSelecionado={paisSelecionado} onPaisChange={setPaisSelecionado} />
      <Ordenacao ordenacao={ordenacao} onOrdenacaoChange={setOrdenacao} />

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
          <div className="grid grid-cols-2 gap-4">
            {empresas.map((empresa) => (
              <CardAtrativo
                key={empresa.id}
                empresa={empresa}
                onSeguirToggle={carregarEmpresas}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
