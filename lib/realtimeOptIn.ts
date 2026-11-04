import { holdRealtime, realtimeQuerido } from '@/lib/realtimeFlag'
import { supabase } from '@/lib/supabase'

export { realtimeQuerido }

/**
 * Realtime CDC só enquanto há ecrã de chat/lista inscrito.
 * Na home o websocket nem abre — evita saturar o pool postgres_cdc_rls.
 */
export function ativarRealtime(): () => void {
  if (typeof window === 'undefined') return () => {}
  const soltar = holdRealtime()
  if (realtimeQuerido()) {
    try {
      supabase.realtime.connect()
    } catch {
      /* ignore */
    }
  }
  return () => {
    soltar()
    if (!realtimeQuerido()) {
      try {
        supabase.realtime.disconnect()
      } catch {
        /* ignore */
      }
    }
  }
}
