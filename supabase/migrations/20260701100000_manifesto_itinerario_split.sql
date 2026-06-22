-- Separação conceitual: Manifesto (PAX) + Itinerário (paradas/atrativos).

-- PAX: campos para manifesto físico / aduanas
ALTER TABLE public.manifesto_passageiros
ADD COLUMN IF NOT EXISTS ordem INTEGER,
ADD COLUMN IF NOT EXISTS data_nascimento DATE,
ADD COLUMN IF NOT EXISTS nome_social TEXT,
ADD COLUMN IF NOT EXISTS contratacao_validada_em TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS foto_url TEXT;

CREATE INDEX IF NOT EXISTS idx_manifesto_passageiros_ordem ON public.manifesto_passageiros (manifesto_id, ordem);

-- Itinerário: renomear manifesto_atrativos → itinerario_paradas
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'manifesto_atrativos'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'itinerario_paradas'
  ) THEN
    ALTER TABLE public.manifesto_atrativos RENAME TO itinerario_paradas;
  END IF;
END $$;

ALTER TABLE public.itinerario_paradas
ADD COLUMN IF NOT EXISTS ordem_rota INTEGER;

-- Renomear índices legados (se existirem)
ALTER INDEX IF EXISTS idx_manifesto_atrativos_manifesto RENAME TO idx_itinerario_paradas_manifesto;
ALTER INDEX IF EXISTS idx_manifesto_atrativos_empresa RENAME TO idx_itinerario_paradas_empresa;
ALTER INDEX IF EXISTS idx_manifesto_atrativos_turista RENAME TO idx_itinerario_paradas_turista;

-- RLS itinerario_paradas (recriar com novo nome)
ALTER TABLE public.itinerario_paradas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manifesto_atrativos select" ON public.itinerario_paradas;
DROP POLICY IF EXISTS "itinerario_paradas select" ON public.itinerario_paradas;
CREATE POLICY "itinerario_paradas select" ON public.itinerario_paradas FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.manifesto_diario md
    JOIN public.profissionais p ON p.id = md.profissional_id
    WHERE md.id = itinerario_paradas.manifesto_id AND p.usuario_id = auth.uid()
  )
  OR itinerario_paradas.turista_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = itinerario_paradas.empresa_id AND e.usuario_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.manifesto_passageiros mp
    JOIN public.profissionais pi ON pi.id = mp.profissional_indireto_id
    WHERE mp.manifesto_id = itinerario_paradas.manifesto_id
      AND mp.turista_id IS NOT DISTINCT FROM itinerario_paradas.turista_id
      AND pi.usuario_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "manifesto_atrativos insert dono" ON public.itinerario_paradas;
DROP POLICY IF EXISTS "itinerario_paradas insert" ON public.itinerario_paradas;
CREATE POLICY "itinerario_paradas insert" ON public.itinerario_paradas FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.manifesto_diario md
    JOIN public.profissionais p ON p.id = md.profissional_id
    WHERE md.id = itinerario_paradas.manifesto_id AND p.usuario_id = auth.uid()
  )
  OR itinerario_paradas.turista_id = auth.uid()
);

DROP POLICY IF EXISTS "manifesto_atrativos update dono" ON public.itinerario_paradas;
DROP POLICY IF EXISTS "itinerario_paradas update dono" ON public.itinerario_paradas;
CREATE POLICY "itinerario_paradas update dono" ON public.itinerario_paradas FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.manifesto_diario md
    JOIN public.profissionais p ON p.id = md.profissional_id
    WHERE md.id = itinerario_paradas.manifesto_id AND p.usuario_id = auth.uid()
  )
);

-- Numeração retroativa de passageiros
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY manifesto_id ORDER BY entrou_em ASC) AS rn
  FROM public.manifesto_passageiros
  WHERE ordem IS NULL
)
UPDATE public.manifesto_passageiros mp
SET ordem = ranked.rn
FROM ranked
WHERE mp.id = ranked.id;

COMMENT ON TABLE public.itinerario_paradas IS 'Paradas do itinerário (atrativos escolhidos por passageiro).';
COMMENT ON COLUMN public.manifesto_passageiros.ordem IS 'Numeração na lista PAX do manifesto diário.';
COMMENT ON COLUMN public.manifesto_passageiros.data_nascimento IS 'Data de nascimento para manifesto físico/aduanas.';
COMMENT ON COLUMN public.manifesto_passageiros.contratacao_validada_em IS 'Quando o turista confirmou dados no popup complementar.';
