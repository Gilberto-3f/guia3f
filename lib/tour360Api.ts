import type { TourConfig } from '@/lib/tour360Types'

type PatchBody = {
  empresaId: string
  fotos_360_url?: string[]
  tour_config?: TourConfig
}

type DeleteBody = {
  empresaId: string
  url: string
}

export async function patchEmpresaTour360(body: PatchBody): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('/api/admin/empresa-tour-360', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) return { ok: false, error: data.error ?? `Erro ${res.status}` }
  return { ok: true }
}

export async function deleteFoto360Empresa(body: DeleteBody): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('/api/admin/empresa-tour-360', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) return { ok: false, error: data.error ?? `Erro ${res.status}` }
  return { ok: true }
}
