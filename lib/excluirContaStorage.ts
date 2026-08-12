import type { SupabaseClient } from '@supabase/supabase-js'

const PAGE = 1000
const REMOVE_BATCH = 100

async function listRecursive(
  admin: SupabaseClient,
  bucket: string,
  folder: string,
): Promise<string[]> {
  const paths: string[] = []
  const { data, error } = await admin.storage.from(bucket).list(folder, { limit: PAGE })
  if (error || !data?.length) return paths

  for (const item of data) {
    const path = folder ? `${folder}/${item.name}` : item.name
    if (!item.name) continue
    // Pastas no Storage listam com id null.
    if (item.id == null) {
      const nested = await listRecursive(admin, bucket, path)
      paths.push(...nested)
    } else {
      paths.push(path)
    }
  }
  return paths
}

async function removePrefix(admin: SupabaseClient, bucket: string, prefix: string): Promise<void> {
  const paths = await listRecursive(admin, bucket, prefix)
  for (let i = 0; i < paths.length; i += REMOVE_BATCH) {
    const chunk = paths.slice(i, i + REMOVE_BATCH)
    if (!chunk.length) continue
    const { error } = await admin.storage.from(bucket).remove(chunk)
    if (error) {
      console.warn('[excluirContaStorage] remove', bucket, error.message)
    }
  }
}

/**
 * Apaga arquivos do titular nos buckets conhecidos.
 * Falha de Storage não deve reverter a exclusão da conta (só loga).
 */
export async function purgeUserStorage(
  admin: SupabaseClient,
  userId: string,
  empresaIds: string[],
): Promise<void> {
  const jobs: Promise<void>[] = [
    removePrefix(admin, 'posts', userId),
    removePrefix(admin, 'stories', userId),
    removePrefix(admin, 'fotos-perfil', userId),
    removePrefix(admin, 'documentos', `documentos/${userId}`),
    removePrefix(admin, 'documentos', userId),
    removePrefix(admin, 'mensagens', userId),
  ]

  for (const empresaId of empresaIds) {
    jobs.push(removePrefix(admin, 'empresas', `empresas/${empresaId}`))
    jobs.push(removePrefix(admin, 'empresas', empresaId))
    jobs.push(removePrefix(admin, 'anuncios', empresaId))
  }

  const results = await Promise.allSettled(jobs)
  for (const r of results) {
    if (r.status === 'rejected') {
      console.warn('[excluirContaStorage]', r.reason)
    }
  }
}
