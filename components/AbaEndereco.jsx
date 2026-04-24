'use client'

import { MapPin, Phone, MessageCircle, Globe, Clock, Facebook, Instagram, Music2 } from 'lucide-react'
import BotaoChamarCorrida from '@/components/BotaoChamarCorrida'
import HorariosFuncionamento from '@/components/HorariosFuncionamento'

const ICON_CLASS = 'shrink-0 text-[#0097b2]'

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
 * @param {{ empresa: {
 *   endereco: string
 *   cidade: string
 *   latitude: number | string | null
 *   longitude: number | string | null
 *   telefone: string | null
 *   whatsapp: string | null
 *   website: string | null
 *   redes_sociais?: unknown
 *   horarios: Record<string, { abre: string, fecha: string, fechado: boolean }>
 *   nome_fantasia?: string
 * }}} props
 */
export default function AbaEndereco({ empresa }) {
  const nomeDestino = empresa.nome_fantasia || ''
  const redes = parseRedesSociais(empresa.redes_sociais)

  const lat = empresa.latitude != null && empresa.latitude !== '' ? Number(empresa.latitude) : NaN
  const lng = empresa.longitude != null && empresa.longitude !== '' ? Number(empresa.longitude) : NaN
  const mapaOk = Number.isFinite(lat) && Number.isFinite(lng)
  const mapSrc = mapaOk
    ? `https://maps.google.com/maps?q=${lat},${lng}&hl=pt&z=16&output=embed`
    : null

  const siteHref = hrefWebsite(empresa.website)

  return (
    <div className="space-y-6 text-gray-900">
      <section className="space-y-3">
        <div className="flex items-start gap-3">
          <MapPin size={22} className={`${ICON_CLASS} mt-0.5`} aria-hidden />
          <div className="min-w-0">
            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">Endereço</h3>
            <p className="mt-1 text-base font-medium text-gray-900">{empresa.endereco}</p>
            {empresa.cidade ? <p className="mt-0.5 text-base text-gray-600">{empresa.cidade}</p> : null}
          </div>
        </div>

        <BotaoChamarCorrida latitude={empresa.latitude} longitude={empresa.longitude} nomeDestino={nomeDestino} />
      </section>

      <section className="border-t border-gray-100 pt-5">
        <div className="mb-3 flex items-center gap-2">
          <Clock size={22} className={ICON_CLASS} aria-hidden />
          <h3 className="text-base font-bold text-gray-900">Horário de Funcionamento</h3>
        </div>
        <HorariosFuncionamento horarios={empresa.horarios || {}} />
      </section>

      {(empresa.whatsapp || empresa.telefone) && (
        <section className="space-y-4 border-t border-gray-100 pt-5">
          {empresa.whatsapp ? (
            <div>
              <h3 className="mb-2 text-base font-bold text-gray-900">WhatsApp</h3>
              <a
                href={`https://wa.me/${String(empresa.whatsapp).replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 text-lg font-semibold text-gray-900 hover:text-[#0097b2]"
              >
                <MessageCircle size={28} className="shrink-0 text-[#0097b2]" aria-hidden />
                <span>{empresa.whatsapp}</span>
              </a>
            </div>
          ) : null}
          {empresa.telefone ? (
            <div>
              <h3 className="mb-2 text-base font-bold text-gray-900">Telefone</h3>
              <a href={`tel:${empresa.telefone}`} className="inline-flex items-center gap-3 text-lg font-semibold text-gray-900 hover:text-[#0097b2]">
                <Phone size={28} className="shrink-0 text-[#0097b2]" aria-hidden />
                <span>{empresa.telefone}</span>
              </a>
            </div>
          ) : null}
        </section>
      )}

      {(redes.instagram || redes.facebook || redes.tiktok) && (
        <section className="border-t border-gray-100 pt-5">
          <h3 className="mb-3 text-base font-bold text-gray-900">Redes sociais</h3>
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
          <h3 className="mb-2 text-base font-bold text-gray-900">Website</h3>
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
        <section className="border-t border-gray-100 pt-5">
          <h3 className="mb-3 text-base font-bold text-gray-900">Mapa</h3>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-100 shadow-sm">
            <iframe
              title="Localização no mapa"
              src={mapSrc}
              className="h-[min(280px,50vh)] w-full"
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
