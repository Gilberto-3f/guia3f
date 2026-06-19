-- Recomendações entre profissionais (indicação de perfil profissional a turista)
CREATE TABLE IF NOT EXISTS public.recomendacoes_profissional (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_indicador_id UUID NOT NULL REFERENCES public.profissionais (id) ON DELETE CASCADE,
  profissional_indicado_id UUID NOT NULL REFERENCES public.profissionais (id) ON DELETE CASCADE,
  turista_canal TEXT,
  turista_whatsapp_final TEXT,
  turista_whatsapp_ddd TEXT,
  turista_email_prefix TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (profissional_indicador_id <> profissional_indicado_id)
);

CREATE INDEX IF NOT EXISTS idx_recomendacoes_profissional_indicado
  ON public.recomendacoes_profissional (profissional_indicado_id);

CREATE INDEX IF NOT EXISTS idx_recomendacoes_profissional_indicador
  ON public.recomendacoes_profissional (profissional_indicador_id);

CREATE INDEX IF NOT EXISTS idx_recomendacoes_profissional_data
  ON public.recomendacoes_profissional (created_at);

ALTER TABLE public.recomendacoes_profissional ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recomendacoes_profissional insert indicador" ON public.recomendacoes_profissional;
CREATE POLICY "recomendacoes_profissional insert indicador" ON public.recomendacoes_profissional FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profissionais p
    WHERE p.id = recomendacoes_profissional.profissional_indicador_id
      AND p.usuario_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "recomendacoes_profissional select indicador" ON public.recomendacoes_profissional;
CREATE POLICY "recomendacoes_profissional select indicador" ON public.recomendacoes_profissional FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.profissionais p
    WHERE p.id = recomendacoes_profissional.profissional_indicador_id
      AND p.usuario_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "recomendacoes_profissional select indicado" ON public.recomendacoes_profissional;
CREATE POLICY "recomendacoes_profissional select indicado" ON public.recomendacoes_profissional FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.profissionais p
    WHERE p.id = recomendacoes_profissional.profissional_indicado_id
      AND p.usuario_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "recomendacoes_profissional select admin" ON public.recomendacoes_profissional;
CREATE POLICY "recomendacoes_profissional select admin" ON public.recomendacoes_profissional FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND u.role = 'admin'
  )
);

COMMENT ON TABLE public.recomendacoes_profissional IS 'Indicações de profissionais a outros profissionais (cartão de visita / funil).';

-- Parcerias firmadas entre profissionais (avaliação cruzada no cartão de visita)
CREATE TABLE IF NOT EXISTS public.parcerias_profissionais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_a_id UUID NOT NULL REFERENCES public.profissionais (id) ON DELETE CASCADE,
  profissional_b_id UUID NOT NULL REFERENCES public.profissionais (id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'fechada' CHECK (status IN ('pendente', 'fechada', 'cancelada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profissional_a_id, profissional_b_id),
  CHECK (profissional_a_id < profissional_b_id)
);

CREATE INDEX IF NOT EXISTS idx_parcerias_profissionais_a ON public.parcerias_profissionais (profissional_a_id);
CREATE INDEX IF NOT EXISTS idx_parcerias_profissionais_b ON public.parcerias_profissionais (profissional_b_id);
CREATE INDEX IF NOT EXISTS idx_parcerias_profissionais_status ON public.parcerias_profissionais (status);

ALTER TABLE public.parcerias_profissionais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parcerias_profissionais select participante" ON public.parcerias_profissionais;
CREATE POLICY "parcerias_profissionais select participante" ON public.parcerias_profissionais FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.profissionais p
    WHERE p.usuario_id = auth.uid()
      AND (p.id = parcerias_profissionais.profissional_a_id OR p.id = parcerias_profissionais.profissional_b_id)
  )
);

DROP POLICY IF EXISTS "parcerias_profissionais select admin" ON public.parcerias_profissionais;
CREATE POLICY "parcerias_profissionais select admin" ON public.parcerias_profissionais FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND u.role = 'admin'
  )
);

COMMENT ON TABLE public.parcerias_profissionais IS 'Parcerias fechadas entre profissionais (habilita avaliação no cartão de visita).';
