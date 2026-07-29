-- Status de presença na Mobilidade (online / offline / em atendimento) + GPS.

ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS mobilidade_status TEXT NOT NULL DEFAULT 'offline',
  ADD COLUMN IF NOT EXISTS mobilidade_status_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mobilidade_online_desde TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mobilidade_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS mobilidade_lng DOUBLE PRECISION;

ALTER TABLE public.profissionais
  DROP CONSTRAINT IF EXISTS profissionais_mobilidade_status_check;

ALTER TABLE public.profissionais
  ADD CONSTRAINT profissionais_mobilidade_status_check
  CHECK (mobilidade_status IN ('offline', 'online', 'em_atendimento'));

COMMENT ON COLUMN public.profissionais.mobilidade_status IS
  'Presença na Mobilidade: offline | online | em_atendimento.';
COMMENT ON COLUMN public.profissionais.mobilidade_online_desde IS
  'Início do período online (timer 2h sem aceite).';
COMMENT ON COLUMN public.profissionais.mobilidade_lat IS
  'Última latitude conhecida enquanto online / em atendimento.';
COMMENT ON COLUMN public.profissionais.mobilidade_lng IS
  'Última longitude conhecida enquanto online / em atendimento.';

CREATE INDEX IF NOT EXISTS idx_profissionais_mobilidade_status
  ON public.profissionais (mobilidade_status)
  WHERE mobilidade_status IN ('online', 'em_atendimento');
