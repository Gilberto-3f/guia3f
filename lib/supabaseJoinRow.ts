/** Normaliza relação Supabase (objeto ou array de 1 item) para um único registro. */
export function joinSupabaseRow(value: unknown): Record<string, unknown> | null {
  if (value == null) return null
  const row = Array.isArray(value) ? value[0] : value
  if (row != null && typeof row === 'object' && !Array.isArray(row)) {
    return row as Record<string, unknown>
  }
  return null
}
