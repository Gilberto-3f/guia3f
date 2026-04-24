'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BotaoVoltar from '@/components/BotaoVoltar'
import Username from '@/components/Username'
import FotoHero from '@/components/FotoHero'
import MenuLateral from '@/components/perfil/MenuLateral'
import NomeEmpresa from '@/components/NomeEmpresa'
import BotaoSeguir from '@/components/BotaoSeguir'
import ContadorSeguidores from '@/components/ContadorSeguidores'
import NotaMedia from '@/components/NotaMedia'
import StatusAtendimento from '@/components/StatusAtendimento'
import DescricaoLonga from '@/components/DescricaoLonga'
import AbaAvaliacoes from '@/components/AbaAvaliacoes'
import AbaEndereco from '@/components/AbaEndereco'
import AbaBotaoDinamico from '@/components/AbaBotaoDinamico'
import { getRotuloAbaServico } from '@/lib/empresaCategoria'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'

function asHorarios(value: unknown) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const p = JSON.parse(value)
      return typeof p === 'object' && p !== null ? p : {}
    } catch {
      return {}
    }
  }
  return {}
}

function asJsonArray(v: unknown) {
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string')
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v)
      return Array.isArray(p) ? p.filter((x) => typeof x === 'string') : []
    } catch {
      return []
    }
  }
  return []
}

export default function EmpresaPage() {
  const params = useParams()
  const router = useRouter()
  const empresaId = typeof params.id === 'string' ? params.id : params.id?.[0] ?? ''

  const [empresa, setEmpresa] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [abaAtiva, setAbaAtiva] = useState<'avaliacoes' | 'endereco' | 'dinamico'>('avaliacoes')
  const [usuarioId, setUsuarioId] = useState<string | null>(null)
  const [meuRole, setMeuRole] = useState<string | null>(null)
  const [adminLevel, setAdminLevel] = useState(0)
  const [meuEmail, setMeuEmail] = useState<string | null>(null)
  const [menuAberto, setMenuAberto] = useState(false)
  const { modoAtivo } = useModoApresentacao()

  useEffect(() => {
    const getUsuario = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const uid = session?.user?.id ?? null
      setMeuEmail(session?.user?.email ?? null)
      setUsuarioId(uid)
      if (!uid) {
        setMeuRole(null)
        setAdminLevel(0)
        return
      }
      const { data } = await supabase.from('usuarios').select('role, admin_level').eq('id', uid).maybeSingle()
      setMeuRole(data?.role != null ? String(data.role) : null)
      setAdminLevel(typeof data?.admin_level === 'number' ? data.admin_level : 0)
    }
    getUsuario()
  }, [])

  const carregarEmpresa = useCallback(async () => {
    if (!empresaId) return
    setLoading(true)
    try {
      const { data: empresaData, error } = await supabase.from('empresas').select('*').eq('id', empresaId).single()

      if (error || !empresaData) {
        setEmpresa(null)
        return
      }

      let isSeguindo = false
      if (usuarioId) {
        const { data: favorito } = await supabase
          .from('favoritos')
          .select('id')
          .eq('usuario_id', usuarioId)
          .eq('empresa_id', empresaId)
          .maybeSingle()

        isSeguindo = Boolean(favorito)
      }

      setEmpresa({
        ...empresaData,
        is_seguindo: isSeguindo,
        horarios: asHorarios(empresaData.horarios),
        fotos_url: asJsonArray(empresaData.fotos_url),
        fotos_360_url: asJsonArray(empresaData.fotos_360_url),
      })
    } finally {
      setLoading(false)
    }
  }, [empresaId, usuarioId])

  useEffect(() => {
    carregarEmpresa()
  }, [carregarEmpresa])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-gray-400">Carregando...</div>
      </div>
    )
  }

  if (!empresa) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <p className="text-gray-500">Empresa não encontrada</p>
        <button type="button" onClick={() => router.back()} className="mt-4 text-[#0097b2]">
          Voltar
        </button>
      </div>
    )
  }

  const nomeFantasia = String(empresa.nome_fantasia ?? '')
  const nomeUsuario = String(empresa.nome_usuario ?? '')
  const fotoUrl = empresa.foto_url ? String(empresa.foto_url) : null
  const descLonga = empresa.descricao_longa != null ? String(empresa.descricao_longa) : null
  const notaMedia = Number(empresa.nota_media) || 0
  const totalAval = Number(empresa.total_avaliacoes) || 0
  const totalSeg = Number(empresa.total_seguidores) || 0
  const categoria = String(empresa.categoria ?? '')
  const rotuloServico = getRotuloAbaServico(categoria)

  const precoTicketInteira = Number(empresa.preco_ticket_inteira) || 0
  const precoTicketMeia = Number(empresa.preco_ticket_meia) || 0
  const precoDiaria = Number(empresa.preco_diaria) || 0

  type HorariosMap = Record<string, { abre: string; fecha: string; fechado: boolean }>
  const horariosParsed = asHorarios(empresa.horarios) as HorariosMap

  const latRaw = empresa.latitude
  const lngRaw = empresa.longitude
  const latitude =
    latRaw == null || typeof latRaw === 'object' ? null : typeof latRaw === 'number' ? latRaw : Number(latRaw)
  const longitude =
    lngRaw == null || typeof lngRaw === 'object' ? null : typeof lngRaw === 'number' ? lngRaw : Number(lngRaw)

  const donoEmpresa = usuarioId != null && String(empresa.usuario_id ?? '') === usuarioId && meuRole === 'empresa'
  const podeAbrirMenu =
    donoEmpresa || (meuRole === 'admin' && typeof adminLevel === 'number' && adminLevel === 1 && modoAtivo)
  const modoEmpresaLayout = podeAbrirMenu

  const empresaEndereco = {
    endereco: String(empresa.endereco ?? ''),
    cidade: String(empresa.cidade ?? ''),
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    telefone: empresa.telefone != null ? String(empresa.telefone) : null,
    whatsapp: empresa.whatsapp != null ? String(empresa.whatsapp) : null,
    website: empresa.website != null ? String(empresa.website) : null,
    horarios: horariosParsed,
    nome_fantasia: nomeFantasia,
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="sticky top-0 z-10 border-b border-gray-100 bg-white">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {!modoEmpresaLayout ? <BotaoVoltar /> : null}
            <Username username={nomeUsuario} />
          </div>

          {podeAbrirMenu ? (
            <button
              type="button"
              onClick={() => setMenuAberto(true)}
              className="shrink-0 rounded-full bg-black/5 px-3 py-2 text-lg font-bold leading-none text-gray-900 hover:bg-black/10"
              aria-label="Menu"
            >
              ☰⋮
            </button>
          ) : null}
        </div>
      </div>

      <FotoHero fotoUrl={fotoUrl} nome={nomeFantasia} />

      <div className="border-b border-gray-100 bg-white p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <NomeEmpresa nome={nomeFantasia} />
          <BotaoSeguir
            empresaId={empresaId}
            isFollowing={Boolean(empresa.is_seguindo)}
            onToggle={() => carregarEmpresa()}
          />
        </div>

        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <ContadorSeguidores empresaId={empresaId} total={totalSeg} />
          <NotaMedia nota={notaMedia} total={totalAval} />
          <StatusAtendimento horarios={empresaEndereco.horarios} />
        </div>

        <DescricaoLonga descricao={descLonga} />
      </div>

      <div className="border-b border-gray-100 bg-white">
        <div className="flex">
          <button
            type="button"
            onClick={() => setAbaAtiva('avaliacoes')}
            className={`flex-1 py-3 text-center text-sm font-medium transition-colors ${
              abaAtiva === 'avaliacoes' ? 'border-b-2 border-[#0097b2] text-[#0097b2]' : 'text-gray-500'
            }`}
          >
            Avaliações
          </button>
          <button
            type="button"
            onClick={() => setAbaAtiva('endereco')}
            className={`flex-1 py-3 text-center text-sm font-medium transition-colors ${
              abaAtiva === 'endereco' ? 'border-b-2 border-[#0097b2] text-[#0097b2]' : 'text-gray-500'
            }`}
          >
            Endereço
          </button>
          <button
            type="button"
            onClick={() => setAbaAtiva('dinamico')}
            className={`flex-1 py-3 text-center text-sm font-medium transition-colors ${
              abaAtiva === 'dinamico' ? 'border-b-2 border-[#0097b2] text-[#0097b2]' : 'text-gray-500'
            }`}
          >
            {rotuloServico}
          </button>
        </div>
      </div>

      <div className="p-4">
        {abaAtiva === 'avaliacoes' ? <AbaAvaliacoes empresaId={empresaId} /> : null}
        {abaAtiva === 'endereco' ? <AbaEndereco empresa={empresaEndereco} /> : null}
        {abaAtiva === 'dinamico' ? (
          <AbaBotaoDinamico
            categoria={categoria}
            empresaId={empresaId}
            empresaNome={nomeFantasia}
            whatsapp={empresa.whatsapp != null ? String(empresa.whatsapp) : null}
            precoTicketInteira={precoTicketInteira}
            precoTicketMeia={precoTicketMeia}
            precoDiaria={precoDiaria}
          />
        ) : null}
      </div>

      {podeAbrirMenu && usuarioId ? (
        meuRole === 'admin' && typeof adminLevel === 'number' && adminLevel === 1 && modoAtivo ? (
          <MenuLateral
            aberto={menuAberto}
            onFechar={() => setMenuAberto(false)}
            variant="admin"
            adminLevel={adminLevel}
            nome="Admin"
            username={meuEmail ? meuEmail.split('@')[0] : 'admin'}
            fotoUrl={null}
            usuarioId={usuarioId}
          />
        ) : (
          <MenuLateral
            aberto={menuAberto}
            onFechar={() => setMenuAberto(false)}
            variant="empresa"
            nome={nomeFantasia}
            username={nomeUsuario}
            fotoUrl={fotoUrl}
            usuarioId={usuarioId}
            empresa={empresa}
            empresaId={empresaId}
            onPerfilAtualizado={() => void carregarEmpresa()}
          />
        )
      ) : null}
    </div>
  )
}
