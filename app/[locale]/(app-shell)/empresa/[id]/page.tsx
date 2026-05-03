'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Camera, ChevronDown, ChevronUp, FileText, Globe2, MapPin, Star } from 'lucide-react'
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
import AbaFotosEmpresa from '@/components/empresa/AbaFotosEmpresa'
import AbaPostsEmpresa from '@/components/empresa/AbaPostsEmpresa'
import AbaTour360Empresa from '@/components/empresa/AbaTour360Empresa'
import UploadFotos360Adm from '@/components/empresa/UploadFotos360Adm'
import { getIconeAbaServico, getRotuloAbaServico } from '@/lib/empresaCategoria'
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
  const [abaExpandida, setAbaExpandida] = useState<null | 'avaliacoes' | 'endereco' | 'dinamico'>(null)
  const [subAbaAtiva, setSubAbaAtiva] = useState<'fotos' | 'posts' | 'tour360'>('fotos')
  const [usuarioId, setUsuarioId] = useState<string | null>(null)
  const [meuRole, setMeuRole] = useState<string | null>(null)
  const [adminLevel, setAdminLevel] = useState(0)
  const [meuEmail, setMeuEmail] = useState<string | null>(null)
  const [menuAberto, setMenuAberto] = useState(false)
  const [totalSeguidores, setTotalSeguidores] = useState<number | null>(null)
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
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const viewerUid = session?.user?.id ?? null

      const { data: empresaData, error } = await supabase.from('empresas').select('*').eq('id', empresaId).single()

      if (error || !empresaData) {
        setEmpresa(null)
        router.replace('/guia')
        return
      }

      const isPreview = Boolean((empresaData as { somente_modo_apresentacao?: boolean } | null)?.somente_modo_apresentacao)
      const donoId = (empresaData as { usuario_id?: string } | null)?.usuario_id ?? null
      if (isPreview && (!viewerUid || String(donoId ?? '') !== String(viewerUid))) {
        setEmpresa(null)
        router.replace('/guia')
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
      setTotalSeguidores(Number(empresaData.total_seguidores) || 0)
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
  const totalSeg = totalSeguidores != null ? totalSeguidores : Number(empresa.total_seguidores) || 0
  const categoria = String(empresa.categoria ?? '')
  const rotuloServico = getRotuloAbaServico(categoria)
  const IconeAbaServico = getIconeAbaServico(categoria)

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
  /** Apenas admin altera fotos 360° na página pública da empresa. */
  const podeEditarFotos360 = meuRole === 'admin'
  const modoEmpresaLayout = podeAbrirMenu

  const toggleAba = (aba: 'avaliacoes' | 'endereco' | 'dinamico') => {
    setAbaExpandida((atual) => (atual === aba ? null : aba))
  }

  const fotos360Lista = Array.isArray(empresa.fotos_360_url) ? /** @type {string[]} */ (empresa.fotos_360_url) : []
  const empresaUsuarioIdPosts = empresa.usuario_id != null ? String(empresa.usuario_id) : null

  const empresaEndereco = {
    id: empresaId,
    endereco: String(empresa.endereco ?? ''),
    bairro: empresa.bairro != null ? String(empresa.bairro) : null,
    cidade: String(empresa.cidade ?? ''),
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    telefone: empresa.telefone != null ? String(empresa.telefone) : null,
    whatsapp: empresa.whatsapp != null ? String(empresa.whatsapp) : null,
    website: empresa.website != null ? String(empresa.website) : null,
    redes_sociais: empresa.redes_sociais,
    horarios: horariosParsed,
    nome_fantasia: nomeFantasia,
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="sticky top-0 z-10 border-b border-gray-100 bg-white">
        <div className="flex items-center justify-between gap-2 px-4 py-1.5">
          <div className="flex min-w-0 items-center gap-2">
            {!modoEmpresaLayout ? <BotaoVoltar /> : null}
            <Username username={nomeUsuario} />
          </div>

          {podeAbrirMenu ? (
            <button
              type="button"
              onClick={() => setMenuAberto(true)}
              className="shrink-0 px-1 text-[30px] font-bold leading-none text-[#0097b2]"
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
          {!donoEmpresa && usuarioId ? (
            <BotaoSeguir
              empresaId={empresaId}
              isFollowing={Boolean(empresa.is_seguindo)}
              onToggle={(seguindo) => {
                setTotalSeguidores((prev) => {
                  const base = typeof prev === 'number' ? prev : totalSeg
                  const next = seguindo ? base + 1 : Math.max(0, base - 1)
                  return next
                })
                void carregarEmpresa()
              }}
            />
          ) : null}
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
            onClick={() => toggleAba('avaliacoes')}
            aria-label="Avaliações"
            aria-expanded={abaExpandida === 'avaliacoes'}
            className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 px-2 py-3 text-sm font-medium transition-colors ${
              abaExpandida === 'avaliacoes' ? 'border-b-2 border-[#0097b2] text-[#0097b2]' : 'text-gray-500'
            }`}
          >
            <Star className="h-4 w-4 shrink-0" aria-hidden />
            {abaExpandida === 'avaliacoes' ? <ChevronUp className="h-4 w-4 shrink-0" aria-hidden /> : <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />}
          </button>
          <button
            type="button"
            onClick={() => toggleAba('endereco')}
            aria-label="Endereço"
            aria-expanded={abaExpandida === 'endereco'}
            className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 px-2 py-3 text-sm font-medium transition-colors ${
              abaExpandida === 'endereco' ? 'border-b-2 border-[#0097b2] text-[#0097b2]' : 'text-gray-500'
            }`}
          >
            <MapPin className="h-4 w-4 shrink-0" aria-hidden />
            {abaExpandida === 'endereco' ? <ChevronUp className="h-4 w-4 shrink-0" aria-hidden /> : <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />}
          </button>
          <button
            type="button"
            onClick={() => toggleAba('dinamico')}
            aria-label={rotuloServico}
            aria-expanded={abaExpandida === 'dinamico'}
            className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 px-2 py-3 text-sm font-medium transition-colors ${
              abaExpandida === 'dinamico' ? 'border-b-2 border-[#0097b2] text-[#0097b2]' : 'text-gray-500'
            }`}
          >
            <IconeAbaServico className="h-4 w-4 shrink-0" aria-hidden />
            {abaExpandida === 'dinamico' ? <ChevronUp className="h-4 w-4 shrink-0" aria-hidden /> : <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />}
          </button>
        </div>
      </div>

      {abaExpandida ? (
        <div className="px-4 pt-4 pb-0">
          {abaExpandida === 'avaliacoes' ? (
            <AbaAvaliacoes
              empresaId={empresaId}
              podeResponder={donoEmpresa}
              empresaUsuarioId={empresa.usuario_id != null ? String(empresa.usuario_id) : null}
              empresaVerificada={
                Boolean(empresa.docs_verificado) || String(empresa.status ?? '') === 'ativo'
              }
              verificadoEm={
                empresa.docs_verificado_em != null
                  ? String(empresa.docs_verificado_em)
                  : empresa.verificado_em != null
                    ? String(empresa.verificado_em)
                    : null
              }
            />
          ) : null}
          {abaExpandida === 'endereco' ? <AbaEndereco empresa={empresaEndereco} /> : null}
          {abaExpandida === 'dinamico' ? (
            <AbaBotaoDinamico
              categoria={categoria}
              empresaId={empresaId}
              empresaNome={nomeFantasia}
              cidade={String(empresa.cidade ?? '')}
              horarios={horariosParsed}
              whatsapp={empresa.whatsapp != null ? String(empresa.whatsapp) : null}
              precoTicketInteira={precoTicketInteira}
              precoTicketMeia={precoTicketMeia}
              precoDiaria={precoDiaria}
            />
          ) : null}
        </div>
      ) : null}

      {abaExpandida == null ? (
        <div className="border-b border-gray-100 bg-white p-4">
          <div className="flex border-b border-[#E0E0E0] bg-white px-2">
            <button
              type="button"
              onClick={() => setSubAbaAtiva('fotos')}
              className={`flex flex-1 flex-col items-center gap-0.5 border-b-2 py-2 text-xs font-medium transition-colors ${
                subAbaAtiva === 'fotos' ? 'border-[#0097b2] text-[#0097b2]' : 'border-transparent text-gray-500'
              }`}
            >
              <Camera size={18} aria-hidden />
              <span>FOTOS</span>
            </button>
            <button
              type="button"
              onClick={() => setSubAbaAtiva('posts')}
              className={`flex flex-1 flex-col items-center gap-0.5 border-b-2 py-2 text-xs font-medium transition-colors ${
                subAbaAtiva === 'posts' ? 'border-[#0097b2] text-[#0097b2]' : 'border-transparent text-gray-500'
              }`}
            >
              <FileText size={18} aria-hidden />
              <span>POSTS</span>
            </button>
            <button
              type="button"
              onClick={() => setSubAbaAtiva('tour360')}
              className={`flex flex-1 flex-col items-center gap-0.5 border-b-2 py-2 text-xs font-medium transition-colors ${
                subAbaAtiva === 'tour360' ? 'border-[#0097b2] text-[#0097b2]' : 'border-transparent text-gray-500'
              }`}
            >
              <Globe2 size={18} aria-hidden />
              <span>TOUR 360°</span>
            </button>
          </div>

          {subAbaAtiva === 'tour360' && podeEditarFotos360 ? (
            <UploadFotos360Adm
              empresaId={empresaId}
              fotos360Atuais={fotos360Lista}
              onAtualizado={() => void carregarEmpresa()}
            />
          ) : null}

          <div className="min-h-0">
            {subAbaAtiva === 'fotos' ? (
              <AbaFotosEmpresa
                empresaUsuarioId={empresaUsuarioIdPosts}
                nomeFantasia={nomeFantasia}
                nomeUsuario={nomeUsuario}
                fotoPerfilUrl={fotoUrl}
              />
            ) : null}
            {subAbaAtiva === 'posts' ? <AbaPostsEmpresa empresaUsuarioId={empresaUsuarioIdPosts} /> : null}
            {subAbaAtiva === 'tour360' ? <AbaTour360Empresa fotos360Url={fotos360Lista} /> : null}
          </div>
        </div>
      ) : null}

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
