'use client'

import { useState } from 'react'
import { MapPin, Phone, User, Globe, Clock, Facebook, Instagram, Music2, ChevronDown, ChevronUp } from 'lucide-react'
import BotaoChamarCorrida from '@/components/BotaoChamarCorrida'
import { whatsappWebSendUrl, digitsWhatsapp } from '@/lib/whatsapp-empresa'
import HorariosFuncionamento from '@/components/HorariosFuncionamento'
import StatusDisponibilidadeHospedagem from '@/components/StatusDisponibilidadeHospedagem'

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
function SecaoColapsavel({ titulo, Icon, children, defaultAberto = true }) {
  const [aberto, setAberto] = useState(defaultAberto)

  return (
    <section className="border-t border-gray-100 pt-5">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
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
  const mapSrc = mapaCoordOk
    ? `https://maps.google.com/maps?q=${lat},${lng}&hl=pt&z=16&output=embed`
    : queryEndereco !== ''
      ? `https://maps.google.com/maps?q=${encodeURIComponent(queryEndereco)}&hl=pt&z=16&output=embed`
      : null

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
    <div className="space-y-6 pb-0 text-gray-900 [&>section:last-child]:mb-0">
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
            nomeDestino={nomeDestino}
          />
        </section>
      ) : null}

      {!locacaoBloqueada ? (
        <section className="space-y-2 border-t border-gray-100 pt-5">
          <TituloSecao Icon={MapPin} titulo="Endereço" />
          <div className="min-w-0">
            <p className="text-base font-medium text-gray-900">{empresa.endereco}</p>
            {empresa.bairro != null && String(empresa.bairro).trim() !== '' ? (
              <p className="mt-0.5 text-base text-gray-600">{String(empresa.bairro).trim()}</p>
            ) : null}
            {empresa.cidade ? <p className="mt-0.5 text-base text-gray-600">{empresa.cidade}</p> : null}
          </div>
        </section>
      ) : null}

      {exibirDisponibilidadeHospedagem ? (
        <section className="border-t border-gray-100 pt-5">
          <StatusDisponibilidadeHospedagem disponibilidade={hospedagemDisponibilidade ?? 'livre'} />
        </section>
      ) : null}

      <SecaoColapsavel titulo="Horário de Funcionamento" Icon={Clock}>
        <HorariosFuncionamento horarios={empresa.horarios || {}} />
      </SecaoColapsavel>

      {(empresa.whatsapp || empresa.telefone) && (
        <section className="space-y-4 border-t border-gray-100 pt-5">
          <TituloSecao Icon={Phone} titulo="Contato" />
          {empresa.whatsapp ? (
            <div>
              <p className="mb-1.5 text-sm font-medium text-gray-600">WhatsApp</p>
              <a
                href={whatsappWebSendUrl(digitsWhatsapp(empresa.whatsapp))}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-base font-normal text-gray-900 hover:text-[#0097b2]"
              >
                {empresa.whatsapp}
              </a>
            </div>
          ) : null}
          {empresa.telefone ? (
            <div>
              <p className="mb-1.5 text-sm font-medium text-gray-600">Telefone</p>
              <a href={`tel:${empresa.telefone}`} className="block text-base font-normal text-gray-900 hover:text-[#0097b2]">
                {empresa.telefone}
              </a>
            </div>
          ) : null}
        </section>
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
        <section className="border-t border-gray-100 pt-5">
          <TituloSecao Icon={Globe} titulo="Website" />
          <a
            href={siteHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 text-lg font-semibold text-gray-900 hover:text-[#0097b2]"
          >
            <Globe size={28} className="shrink-0 text-[#0097b2]" aria-hidden />
            <span className="break-all">{labelWebsite(siteHref)}</span>
          </a>
        </section>
      ) : null}

      {!locacaoBloqueada && mapSrc ? (
        <section className="mb-0 border-t border-gray-100 pt-5 pb-0">
          <TituloSecao Icon={MapPin} titulo="Mapa" />
          <div className="mb-0 overflow-hidden rounded-xl border border-gray-200 bg-gray-100 leading-none shadow-sm">
            <iframe
              title="Localização no mapa"
              src={mapSrc}
              className="block h-[min(280px,50vh)] w-full border-0 align-top"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
        </section>
      ) : null}
    </div>
  )
}
