import { supabase } from '@/lib/supabase'

let refs = 0

export function realtimeQuerido(): boolean {
  return refs > 0
}

/**
 * Realtime CDC só enquanto há ecrã de chat/lista inscrito.
 * Na home o websocket nem abre — evita saturar o pool postgres_cdc_rls.
 */
export function ativarRealtime(): () => void {
  if (typeof window === 'undefined') return () => {}
  refs += 1
  if (refs === 1) {
    try {
      supabase.realtime.connect()
    } catch {
      /* ignore */
    }
  }
  return () => {
    refs = Math.max(0, refs - 1)
    if (refs === 0) {
      try {
        supabase.realtime.disconnect()
      } catch {
        /* ignore */
      }
    }
  }
}
