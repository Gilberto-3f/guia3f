-- Banners do ADM geral na home, por ecossistema.
-- empresa_id passa a ser opcional (anúncio institucional).
-- periodo_fim NULL = recorrente até finalizar.
-- 1 banner ADM ativo por eco (índice único parcial).

ALTER TABLE public.anuncios
  ALTER COLUMN empresa_id DROP NOT NULL;

ALTER TABLE public.anuncios
  ADD COLUMN IF NOT EXISTS ecossistema_id uuid REFERENCES public.ecossistemas (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS anuncios_ecossistema_idx
  ON public.anuncios (ecossistema_id)
  WHERE ecossistema_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS anuncios_adm_home_ativo_eco
  ON public.anuncios (ecossistema_id)
  WHERE tipo = 'home'
    AND status = 'ativo'
    AND empresa_id IS NULL
    AND ecossistema_id IS NOT NULL;

ALTER TABLE public.anuncios
  DROP CONSTRAINT IF EXISTS anuncios_empresa_ou_eco;

ALTER TABLE public.anuncios
  ADD CONSTRAINT anuncios_empresa_ou_eco
  CHECK (empresa_id IS NOT NULL OR ecossistema_id IS NOT NULL);

DROP POLICY IF EXISTS "anuncios_select_home_publico_ativo" ON public.anuncios;
CREATE POLICY "anuncios_select_home_publico_ativo" ON public.anuncios FOR
SELECT TO anon, authenticated USING (
  tipo = 'home'
  AND status = 'ativo'
  AND periodo_inicio <= CURRENT_DATE
  AND (periodo_fim IS NULL OR periodo_fim >= CURRENT_DATE)
);

COMMENT ON COLUMN public.anuncios.ecossistema_id IS
  'Eco do banner institucional (ADM). Empresa continua filtrada por empresa_ecossistemas.';
COMMENT ON COLUMN public.anuncios.periodo_fim IS
  'Fim da vigência. NULL = recorrente até o ADM finalizar.';
