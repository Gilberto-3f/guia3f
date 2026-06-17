'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  mapCategoriaProfissionalParaTabelado,
  mapCidadeAtuacaoParaTabelado,
  mapRotaTabeladaRow,
  type CategoriaTabeladoId,
  type CidadeOrigemTabeladoId,
  type RotaTabelada,
} from '@/lib/servicosTabeladosCatalogo'

export function useServicosTabeladosProfissional(
  usuarioId: string | null,
  placaVermelha: boolean,
) {
  const [categoria, setCategoria] = useState<CategoriaTabeladoId | null>(null)
  const [cidadeCadastro, setCidadeCadastro] = useState<CidadeOrigemTabeladoId | null>(null)
  const [rotas, setRotas] = useState<RotaTabelada[]>([])
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    if (!usuarioId || !placaVermelha) {
      setCategoria(null)
      setCidadeCadastro(null)
      setRotas([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const { data: prof, error: profErr } = await supabase
        .from('profissionais')
        .select('categorias, placa_vermelha, cidade_atuacao')
        .eq('usuario_id', usuarioId)
        .maybeSingle()

      if (profErr) throw profErr
      if (!prof?.placa_vermelha) {
        setCategoria(null)
        setCidadeCadastro(null)
        setRotas([])
        return
      }

      const cat = mapCategoriaProfissionalParaTabelado(
        prof.categorias as string[] | string | null,
      )
      setCategoria(cat)

      const cidadesAtuacao = Array.isArray(prof.cidade_atuacao)
        ? prof.cidade_atuacao
        : prof.cidade_atuacao != null
          ? [String(prof.cidade_atuacao)]
          : []
      const primeiraCidade = cidadesAtuacao[0]
      setCidadeCadastro(mapCidadeAtuacaoParaTabelado(primeiraCidade))

      if (!cat) {
        setRotas([])
        return
      }

      const { data, error } = await supabase
        .from('servicos_tabelados_rotas')
        .select('*')
        .eq('ativo', true)
        .eq('categoria', cat)
        .order('cidade_origem', { ascending: true })
        .order('destino_final', { ascending: true })

      if (error) throw error
      setRotas((data ?? []).map((r) => mapRotaTabeladaRow(r as Record<string, unknown>)))
    } catch {
      setCategoria(null)
      setCidadeCadastro(null)
      setRotas([])
    } finally {
      setLoading(false)
    }
  }, [placaVermelha, usuarioId])

  useEffect(() => {
    void carregar()
  }, [carregar])

  return { categoria, cidadeCadastro, rotas, loading, refetch: carregar }
}
