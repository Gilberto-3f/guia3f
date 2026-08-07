-- Cliente turista vinculado à recomendação direcionada (Ecossistema).
ALTER TABLE public.recomendacoes_profissional
  ADD COLUMN IF NOT EXISTS turista_usuario_id UUID REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_recomendacoes_profissional_turista
  ON public.recomendacoes_profissional (turista_usuario_id)
  WHERE turista_usuario_id IS NOT NULL;

COMMENT ON COLUMN public.recomendacoes_profissional.turista_usuario_id IS
  'Turista (auth.users) da recomendação direcionada via Ecossistema.';
