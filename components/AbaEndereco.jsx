'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { MapPin, Phone, User, Globe, Clock, Facebook, Instagram, Music2, ChevronDown, ChevronUp, Hotel } from 'lucide-react'
import BotaoChamarCorrida from '@/components/BotaoChamarCorrida'
import { whatsappWebSendUrl, digitsWhatsapp } from '@/lib/whatsapp-empresa'
import { formatarTelefoneExibicao } from '@/lib/formatarTelefoneExibicao'
import HorariosFuncionamento from '@/components/HorariosFuncionamento'
import StatusDisponibilidadeHospedagem from '@/components/StatusDisponibilidadeHospedagem'

const MapaEmpresaPagina = dynamic(() => import('@/components/empresa/MapaEmpresaPagina'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[min(280px,50vh)] items-center justify-center bg-[#e8f4f6] text-sm text-gray-500">
      Carregando mapa…
    </div>
  ),
})

const ICON_CLASS = 'shrink-0 text-[#0097b2]'

/** Título de secção (Endereço, Horário, Contato, …): ícone + texto alinhados. */
function TituloSecao({ Icon, titulo }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className={`h-6 w-6 ${ICON_CLASS}`} strokeWidth={2} aria-hidden />
      <h3 className="text-lg font-bold text-gray-900">{titulo}</h3>
    </div>
  )
}

/**
 * @param {{ titulo: string, Icon: import('lucide-react').LucideIcon, children: React.ReactNode, defaultAberto?: boolean }} props
 */
function SecaoColapsavel({ titulo, Icon, children, defaultAberto = false }) {
  const [aberto, setAberto] = useState(defaultAberto)

  return (
    <section className="border-t border-gray-100 pt-2">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center justify-between gap-2 py-1 text-left"
        aria-expanded={aberto}
      >
        <TituloSecao Icon={Icon} titulo={titulo} />
        {aberto ? (
          <ChevronUp className="h-5 w-5 shrink-0 text-[#0097b2]" aria-hidden />
        ) : (
          <ChevronDown className="h-5 w-5 shrink-0 text-[#0097b2]" aria-hidden />
        )}
      </button>
      {aberto ? <div className="mt-3">{children}</div> : null}
    </section>
  )
}

const BOTAO_REDE_CLS =
  'flex min-h-[5.25rem] flex-col items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-2 py-3 text-center shadow-sm transition hover:border-[#0097b2] hover:text-[#0097b2]'

const BOTAO_CONTATO_CLS =
  'flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-left shadow-sm transition hover:border-[#0097b2] hover:text-[#0097b2]'

/**
 * @param {{ tipo: 'whatsapp' | 'telefone', valor: string, cidade?: string | null, href: string, externo?: boolean }} props
 */
function BotaoContatoTelefone({ tipo, valor, cidade, href, externo = false }) {
  const { texto, bandeira } = formatarTelefoneExibicao(valor, { cidadeFallback: cidade })
  const rotulo = tipo === 'whatsapp' ? 'WhatsApp' : 'Telefone'

  return (
    <a
      href={href}
      {...(externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={BOTAO_CONTATO_CLS}
      aria-label={`${rotulo}: ${texto || valor}`}
    >
      <span className="text-xl leading-none" aria-hidden>
        {bandeira}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-gray-500">{rotulo}</span>
        <span className="block text-base font-normal text-gray-900">{texto || valor}</span>
      </span>
    </a>
  )
}

/**
 * @param {unknown} raw
 * @returns {{ instagram: string, facebook: string, tiktok: string }}
 */
function parseRedesSociais(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { instagram: '', facebook: '', tiktok: '' }
  }
  const o = /** @type {Record<string, unknown>} */ (raw)
  return {
    instagram: String(o.instagram ?? '').trim(),
    facebook: String(o.facebook ?? '').trim(),
    tiktok: String(o.tiktok ?? '').trim(),
  }
}

/**
 * @param {string} val
 * @returns {string | null}
 */
function hrefInstagram(val) {
  if (!val) return null
  if (/^https?:\/\//i.test(val)) return val
  const u = val.replace(/^@/, '').replace(/^\//, '').split('/')[0]
  if (!u) return null
  return `https://www.instagram.com/${u}/`
}

/**
 * @param {string} val
 * @returns {string | null}
 */
function hrefFacebook(val) {
  if (!val) return null
  if (/^https?:\/\//i.test(val)) return val
  const u = val.replace(/^@/, '').trim()
  if (!u) return null
  return `https://www.facebook.com/${u}`
}

/**
 * @param {string} val
 * @returns {string | null}
 */
function hrefTiktok(val) {
  if (!val) return null
  if (/^https?:\/\//i.test(val)) return val
  const u = val.replace(/^@/, '').replace(/^\//, '').split('/')[0]
  if (!u) return null
  return `https://www.tiktok.com/@${u}`
}

/**
 * @param {string | null | undefined} raw
 * @returns {string | null}
 */
function hrefWebsite(raw) {
  if (raw == null || !String(raw).trim()) return null
  const t = String(raw).trim()
  if (/^https?:\/\//i.test(t)) return t
  return `https://${t.replace(/^\/+/, '')}`
}

/**
 * @param {string} href
 */
function labelWebsite(href) {
  try {
    const u = new URL(href)
    return (u.host + u.pathname).replace(/\/$/, '') || href
  } catch {
    return href.replace(/^https?:\/\//i, '')
  }
}

/**
 * Monta texto de morada para pesquisa no mapa (fallback sem lat/lng).
 * @param {{ endereco: string, bairro?: string | null, cidade?: string | null }} e
 */
function montarQueryMapaEndereco(e) {
  const partes = [
    String(e.endereco ?? '').trim(),
    e.bairro != null && String(e.bairro).trim() !== '' ? String(e.bairro).trim() : '',
    e.cidade != null && String(e.cidade).trim() !== '' ? String(e.cidade).trim() : '',
  ].filter(Boolean)
  return partes.length ? partes.join(', ') : ''
}

/**
 * @param {{ empresa: {
 *   id?: string
 *   endereco: string
 *   bairro?: string | null
 *   cidade: string
 *   latitude: number | string | null
 *   longitude: number | string | null
 *   foto_url?: string | null
 *   telefone: string | null
 *   whatsapp: string | null
 *   website: string | null
 *   redes_sociais?: unknown
 *   horarios: Record<string, { abre: string, fecha: string, fechado: boolean }>
 *   nome_fantasia?: string
 * }
 * mostrarChamarCorrida?: boolean
 * locacaoBloqueada?: boolean
 * exibirDisponibilidadeHospedagem?: boolean
 * hospedagemDisponibilidade?: string | null
 * }} props
 */
export default function AbaEndereco({
  empresa,
  mostrarChamarCorrida = false,
  locacaoBloqueada = false,
  exibirDisponibilidadeHospedagem = false,
  hospedagemDisponibilidade = null,
}) {
  const nomeDestino = empresa.nome_fantasia || ''
  const redes = parseRedesSociais(empresa.redes_sociais)

  const lat = empresa.latitude != null && empresa.latitude !== '' ? Number(empresa.latitude) : NaN
  const lng = empresa.longitude != null && empresa.longitude !== '' ? Number(empresa.longitude) : NaN
  const mapaCoordOk = Number.isFinite(lat) && Number.isFinite(lng)
  const queryEndereco = montarQueryMapaEndereco({
    endereco: empresa.endereco,
    bairro: empresa.bairro,
    cidade: empresa.cidade,
  })
  const labelDestinoCorrida = queryEndereco || nomeDestino
  const temMapa = mapaCoordOk || queryEndereco !== ''
  const siteHref = hrefWebsite(empresa.website)

  const linksRedes = [
    redes.instagram && hrefInstagram(redes.instagram)
      ? { key: 'instagram', href: hrefInstagram(redes.instagram), label: 'Instagram', Icon: Instagram }
      : null,
    redes.facebook && hrefFacebook(redes.facebook)
      ? { key: 'facebook', href: hrefFacebook(redes.facebook), label: 'Facebook', Icon: Facebook }
      : null,
    redes.tiktok && hrefTiktok(redes.tiktok)
      ? { key: 'tiktok', href: hrefTiktok(redes.tiktok), label: 'TikTok', Icon: Music2 }
      : null,
  ].filter(Boolean)

  return (
    <div className="space-y-3 pb-4 text-gray-900 [&>section:last-child]:mb-0">
      {locacaoBloqueada ? (
        <section className="rounded-xl border border-[#45B7D1]/30 bg-[#45B7D1]/5 px-4 py-4 text-sm text-gray-800">
          <p className="font-semibold text-[#0097b2]">Endereço disponível após confirmação</p>
          <p className="mt-2 leading-relaxed text-gray-700">
            Solicite uma reserva na aba de hospedagem. O endereço, o mapa e a opção de chamar corrida serão
            liberados quando a empresa confirmar sua solicitação.
          </p>
        </section>
      ) : null}

      {!locacaoBloqueada && mostrarChamarCorrida ? (
        <section className="space-y-3">
          <BotaoChamarCorrida
            variant="empresa"
            empresaId={empresa.id != null ? String(empresa.id) : ''}
            horarios={empresa.horarios}
            latitude={empresa.latitude}
            longitude={empresa.longitude}
            nomeDestino={labelDestinoCorrida}
          />
        </section>
      ) : null}

      {!locacaoBloqueada ? (
        <SecaoColapsavel titulo="Localização" Icon={MapPin}>
          <div className="min-w-0">
            <p className="text-base font-medium text-gray-900">{empresa.endereco}</p>
            {empresa.bairro != null && String(empresa.bairro).trim() !== '' ? (
              <p className="mt-0.5 text-base text-gray-600">{String(empresa.bairro).trim()}</p>
            ) : null}
            {empresa.cidade ? <p className="mt-0.5 text-base text-gray-600">{empresa.cidade}</p> : null}
          </div>
          {temMapa ? (
            <div className="mt-3 overflow-hidden rounded-xl border border-[#0097b2] bg-gray-100 leading-none shadow-sm">
              {mapaCoordOk ? (
                <MapaEmpresaPagina
                  latitude={lat}
                  longitude={lng}
                  nome={nomeDestino}
                  fotoUrl={empresa.foto_url != null ? String(empresa.foto_url) : null}
                />
              ) : (
                <p className="bg-[#e8f4f6] px-4 py-8 text-center text-sm text-gray-600">
                  Localização ainda sem coordenadas. Endereço: {queryEndereco}
                </p>
              )}
            </div>
          ) : null}
        </SecaoColapsavel>
      ) : null}

      {exibirDisponibilidadeHospedagem ? (
        <SecaoColapsavel titulo="Disponibilidade" Icon={Hotel}>
          <StatusDisponibilidadeHospedagem disponibilidade={hospedagemDisponibilidade ?? 'livre'} />
        </SecaoColapsavel>
      ) : null}

      <SecaoColapsavel titulo="Funcionamento" Icon={Clock}>
        <HorariosFuncionamento horarios={empresa.horarios || {}} />
      </SecaoColapsavel>

      {(empresa.whatsapp || empresa.telefone) && (
        <SecaoColapsavel titulo="Contato" Icon={Phone}>
          <div className="flex flex-col gap-3">
            {empresa.whatsapp ? (
              <BotaoContatoTelefone
                tipo="whatsapp"
                valor={empresa.whatsapp}
                cidade={empresa.cidade}
                href={whatsappWebSendUrl(digitsWhatsapp(empresa.whatsapp))}
                externo
              />
            ) : null}
            {empresa.telefone ? (
              <BotaoContatoTelefone
                tipo="telefone"
                valor={empresa.telefone}
                cidade={empresa.cidade}
                href={`tel:${digitsWhatsapp(empresa.telefone)}`}
              />
            ) : null}
          </div>
        </SecaoColapsavel>
      )}

      {linksRedes.length > 0 ? (
        <SecaoColapsavel titulo="Redes sociais" Icon={User}>
          <div className="grid grid-cols-3 gap-3">
            {linksRedes.map((item) => {
              const IconRede = item.Icon
              return (
                <a
                  key={item.key}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${BOTAO_REDE_CLS} text-gray-900`}
                >
                  <IconRede size={22} className="shrink-0 text-[#0097b2]" aria-hidden />
                  <span className="w-full text-xs font-semibold leading-tight">{item.label}</span>
                </a>
              )
            })}
          </div>
        </SecaoColapsavel>
      ) : null}

      {siteHref ? (
        <SecaoColapsavel titulo="Website" Icon={Globe}>
          <a
            href={siteHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-lg font-semibold text-gray-900 hover:text-[#0097b2]"
          >
            <span className="break-all">{labelWebsite(siteHref)}</span>
          </a>
        </SecaoColapsavel>
      ) : null}
    </div>
  )
}
