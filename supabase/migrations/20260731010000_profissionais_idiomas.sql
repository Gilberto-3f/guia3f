-- Idiomas falados pelo Guia de Turismo (filtro do algoritmo / matching).
ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS idiomas text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.profissionais.idiomas IS
  'Códigos de idioma (ex: pt, es, en) informados pelo guia — usados no filtro de mobilidade.';

CREATE INDEX IF NOT EXISTS idx_profissionais_idiomas
  ON public.profissionais USING GIN (idiomas)
  WHERE coalesce(cardinality(idiomas), 0) > 0;
