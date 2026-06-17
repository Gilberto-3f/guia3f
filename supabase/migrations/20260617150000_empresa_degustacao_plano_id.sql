-- Degustação vinculada ao plano escolhido pelo ADM

ALTER TABLE public.empresa_degustacoes
  ADD COLUMN IF NOT EXISTS plano_id UUID NULL REFERENCES public.planos (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_empresa_degustacoes_plano ON public.empresa_degustacoes (plano_id);

COMMENT ON COLUMN public.empresa_degustacoes.plano_id IS
  'Plano cujos serviços são liberados durante o período de degustação.';
