-- Emergência turista: motivo do chat + localização em tempo real (Estou perdido).

ALTER TABLE public.ecossistema_conversas
ADD COLUMN IF NOT EXISTS motivo_emergencia TEXT CHECK (
  motivo_emergencia IS NULL
  OR motivo_emergencia IN ('socorro', 'perdido', 'item_esquecido')
);

ALTER TABLE public.ecossistema_conversas
ADD COLUMN IF NOT EXISTS loc_lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS loc_lng DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS loc_atualizada_em TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_ecossistema_conversas_motivo ON public.ecossistema_conversas (motivo_emergencia, urgente, status);

COMMENT ON COLUMN public.ecossistema_conversas.motivo_emergencia IS 'socorro | perdido | item_esquecido (turista — menu Emergência).';
