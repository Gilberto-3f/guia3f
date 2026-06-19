-- Parceria automática na contratação via recomendação profissional + manifesto turista.

ALTER TABLE public.recomendacoes_profissional
ADD COLUMN IF NOT EXISTS turista_usuario_id UUID REFERENCES public.usuarios (id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS contratado_em TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_recomendacoes_profissional_contratado
  ON public.recomendacoes_profissional (contratado_em)
  WHERE contratado_em IS NOT NULL;

ALTER TABLE public.parcerias_profissionais
ADD COLUMN IF NOT EXISTS recomendacao_id UUID REFERENCES public.recomendacoes_profissional (id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS turista_usuario_id UUID REFERENCES public.usuarios (id) ON DELETE SET NULL;

ALTER TABLE public.parcerias_profissionais DROP CONSTRAINT IF EXISTS parcerias_profissionais_status_check;
ALTER TABLE public.parcerias_profissionais
ADD CONSTRAINT parcerias_profissionais_status_check
CHECK (status IN ('pendente', 'fechada', 'cancelada', 'em_andamento', 'concluida'));

ALTER TABLE public.manifesto
ADD COLUMN IF NOT EXISTS turista_usuario_id UUID REFERENCES public.usuarios (id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS recomendacao_id UUID REFERENCES public.recomendacoes_profissional (id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS profissional_indicador_id UUID REFERENCES public.profissionais (id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS dados_atendimento JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.manifesto
ALTER COLUMN empresa_destino_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_manifesto_turista ON public.manifesto (turista_usuario_id);
CREATE INDEX IF NOT EXISTS idx_parcerias_recomendacao ON public.parcerias_profissionais (recomendacao_id);

COMMENT ON COLUMN public.recomendacoes_profissional.contratado_em IS 'Quando o turista contratou o profissional indicado via link de recomendação.';
COMMENT ON COLUMN public.parcerias_profissionais.status IS 'em_andamento = parceria ativa por contratação via recomendação.';
