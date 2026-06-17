'use client'

import { MapPin, Phone, User, Globe, Clock, Facebook, Instagram, Music2 } from 'lucide-react'
import BotaoChamarCorrida from '@/components/BotaoChamarCorrida'
import { whatsappWebSendUrl, digitsWhatsapp } from '@/lib/whatsapp-empresa'
import HorariosFuncionamento from '@/components/HorariosFuncionamento'

const ICON_CLASS = 'shrink-0 text-[#0097b2]'

/** Título de secção (Endereço, Horário, Contato, …): ícone + texto alinhados. */
function TituloSecao({ Icon, titulo }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <Icon className={`h-6 w-6 ${ICON_CLASS}`} strokeWidth={2} aria-hidden />
      <h3 className="text-lg font-bold text-gray-900">{titulo}</h3>
    </div>
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
 *   telefone: string | null
 *   whatsapp: string | null
 *   website: string | null
 *   redes_sociais?: unknown
 *   horarios: Record<string, { abre: string, fecha: string, fechado: boolean }>
 *   nome_fantasia?: string
 * }
 * mostrarChamarCorrida?: boolean
 * }} props
 */
export default function AbaEndereco({ empresa, mostrarChamarCorrida = false }) {
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

  return (
    <div className="space-y-6 pb-0 text-gray-900 [&>section:last-child]:mb-0">
      {mostrarChamarCorrida ? (
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

      <section className="border-t border-gray-100 pt-5">
        <TituloSecao Icon={Clock} titulo="Horário de Funcionamento" />
        <HorariosFuncionamento horarios={empresa.horarios || {}} />
      </section>

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

      {(redes.instagram || redes.facebook || redes.tiktok) && (
        <section className="border-t border-gray-100 pt-5">
          <TituloSecao Icon={User} titulo="Redes sociais" />
          <div className="flex flex-wrap gap-3">
            {redes.instagram && hrefInstagram(redes.instagram) ? (
              <a
                href={hrefInstagram(redes.instagram)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 shadow-sm hover:border-[#0097b2] hover:text-[#0097b2]"
              >
                <Instagram size={22} className="text-[#0097b2]" aria-hidden />
                Instagram
              </a>
            ) : null}
            {redes.facebook && hrefFacebook(redes.facebook) ? (
              <a
                href={hrefFacebook(redes.facebook)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 shadow-sm hover:border-[#0097b2] hover:text-[#0097b2]"
              >
                <Facebook size={22} className="text-[#0097b2]" aria-hidden />
                Facebook
              </a>
            ) : null}
            {redes.tiktok && hrefTiktok(redes.tiktok) ? (
              <a
                href={hrefTiktok(redes.tiktok)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 shadow-sm hover:border-[#0097b2] hover:text-[#0097b2]"
              >
                <Music2 size={22} className="text-[#0097b2]" aria-hidden />
                TikTok
              </a>
            ) : null}
          </div>
        </section>
      )}

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

      {mapSrc ? (
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
