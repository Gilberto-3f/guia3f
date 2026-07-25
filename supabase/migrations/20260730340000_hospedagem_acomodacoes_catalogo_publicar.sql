-- Hospedagem: rascunho/publicado (lista plana — espelho atrativos/serviços)
-- Data: 2026-07-25

ALTER TABLE public.hospedagem_acomodacoes
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS site_url TEXT;

-- Acomodações já existentes: mantém visíveis no drawer público
UPDATE public.hospedagem_acomodacoes
SET ativo = TRUE
WHERE ativo IS DISTINCT FROM TRUE;

CREATE INDEX IF NOT EXISTS idx_hospedagem_acomodacoes_ativo
  ON public.hospedagem_acomodacoes (ativo);

COMMENT ON COLUMN public.hospedagem_acomodacoes.ativo IS
  'false = rascunho; true = publicado no drawer/feed.';

COMMENT ON COLUMN public.hospedagem_acomodacoes.site_url IS
  'Link externo opcional.';

-- Leitura: público só ativos; dono/admin veem rascunhos
DROP POLICY IF EXISTS "Leitura acomodacoes hospedagem" ON public.hospedagem_acomodacoes;
DROP POLICY IF EXISTS "hospedagem_acomodacoes leitura publicos ativos" ON public.hospedagem_acomodacoes;
CREATE POLICY "hospedagem_acomodacoes leitura publicos ativos" ON public.hospedagem_acomodacoes FOR
SELECT
  USING (
    COALESCE(ativo, FALSE) = TRUE
    OR EXISTS (
      SELECT 1 FROM public.empresas e
      WHERE e.id = hospedagem_acomodacoes.empresa_id AND e.usuario_id = auth.uid ()
    )
    OR EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid () AND u.role = 'admin'
    )
  );
