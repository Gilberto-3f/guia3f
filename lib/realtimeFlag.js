/** Contador sem importar o cliente Supabase (evita import circular). */
let refs = 0

export function realtimeQuerido() {
  return refs > 0
}

export function holdRealtime() {
  refs += 1
  return () => {
    refs = Math.max(0, refs - 1)
  }
}
