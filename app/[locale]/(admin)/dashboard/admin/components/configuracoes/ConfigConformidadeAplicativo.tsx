'use client'

import { useEffect, useState } from 'react'
import { FileText, ScrollText, Leaf } from 'lucide-react'
import { AdminSecaoChevron } from '../shared/AdminSecaoChevron'
import { useConfiguracoes } from '../../hooks/useConfiguracoes'
import { ConfigPoliticaTexto, type CampoPolitica } from './sections/ConfigPoliticaTexto'
import type { ConfigGeral } from '../../types/admin.types'

const POLITICAS: { chave: CampoPolitica; titulo: string; Icon: typeof FileText }[] = [
  { chave: 'politicas_privacidade', titulo: 'Políticas de privacidade', Icon: ScrollText },
  { chave: 'termos_uso', titulo: 'Termos de uso', Icon: FileText },
  { chave: 'regras_ecossistema', titulo: 'Regras do ecossistema', Icon: Leaf },
]

export function ConfigConformidadeAplicativo() {
  const { geral, loading, salvarGeral, podeEditarGeral, error: hookError } = useConfiguracoes()
  const [localGeral, setLocalGeral] = useState<ConfigGeral | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null)
  const [abertas, setAbertas] = useState<Record<CampoPolitica, boolean>>({
    politicas_privacidade: true,
    termos_uso: false,
    regras_ecossistema: false,
  })

  useEffect(() => {
    if (geral) setLocalGeral({ ...geral })
  }, [geral])

  const salvar = async () => {
    if (!localGeral) return
    setSalvando(true)
    setMensagem(null)
    try {
      await salvarGeral(localGeral)
      setMensagem({ tipo: 'sucesso', texto: 'Texto salvo com sucesso!' })
      window.setTimeout(() => setMensagem(null), 3000)
    } catch {
      setMensagem({ tipo: 'erro', texto: 'Erro ao salvar' })
      throw new Error('save_failed')
    } finally {
      setSalvando(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
        Carregando...
      </div>
    )
  }
  if (hookError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        Erro: {hookError.message}
      </div>
    )
  }
  if (!localGeral) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
        Nenhuma configuração encontrada
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {mensagem ? (
        <div
          className={`rounded-xl p-3 text-sm ${
            mensagem.tipo === 'sucesso' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
          }`}
        >
          {mensagem.texto}
        </div>
      ) : null}

      {POLITICAS.map(({ chave, titulo, Icon }) => (
        <AdminSecaoChevron
          key={chave}
          titulo={titulo}
          aberta={abertas[chave]}
          onToggle={() => setAbertas((prev) => ({ ...prev, [chave]: !prev[chave] }))}
          icone={Icon}
          corTitulo="#0097b2"
        >
          <ConfigPoliticaTexto
            chave={chave}
            localGeral={localGeral}
            setLocalGeral={setLocalGeral}
            podeEditar={podeEditarGeral}
            salvando={salvando}
            onSalvar={salvar}
          />
        </AdminSecaoChevron>
      ))}
    </div>
  )
}
