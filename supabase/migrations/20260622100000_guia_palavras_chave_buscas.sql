-- Palavras-chave (meta tags) por empresa + log de buscas no guia turístico.

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS palavras_chave JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.empresas.palavras_chave IS
  'Até 5 termos invisíveis na página pública; usados no motor de busca do guia por segmento.';

CREATE TABLE IF NOT EXISTS public.buscas_guia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  termo_busca TEXT NOT NULL,
  segmento_guia VARCHAR(50) NOT NULL,
  usuario_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buscas_guia_segmento ON public.buscas_guia (segmento_guia);
CREATE INDEX IF NOT EXISTS idx_buscas_guia_created ON public.buscas_guia (created_at);
CREATE INDEX IF NOT EXISTS idx_buscas_guia_termo ON public.buscas_guia (termo_busca);

ALTER TABLE public.buscas_guia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "buscas_guia insert autenticado" ON public.buscas_guia;
CREATE POLICY "buscas_guia insert autenticado" ON public.buscas_guia FOR INSERT
WITH CHECK (auth.role () = 'authenticated');

DROP POLICY IF EXISTS "buscas_guia select gestor empresa" ON public.buscas_guia;
CREATE POLICY "buscas_guia select gestor empresa" ON public.buscas_guia FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.empresas e WHERE e.usuario_id = auth.uid ()
  )
  OR EXISTS (
    SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid () AND u.role = 'admin'
  )
);

COMMENT ON TABLE public.buscas_guia IS 'Termos pesquisados no motor de busca do guia turístico, por segmento.';

-- Top termos por segmento (dashboard empresa — estatísticas de mercado)
CREATE OR REPLACE FUNCTION public.rpc_busca_guia_top_termos(
  p_desde TIMESTAMPTZ DEFAULT NULL,
  p_limite INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limite INTEGER := GREATEST(1, LEAST(COALESCE(p_limite, 10), 50));
BEGIN
  IF NOT public.pode_acessar_analise_mercado() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'segmento_guia', s.segmento,
          'termos',
          COALESCE(
            (
              SELECT jsonb_agg(
                jsonb_build_object('termo', t.termo_busca, 'total', t.total)
                ORDER BY t.total DESC
              )
              FROM (
                SELECT
                  lower(trim(both FROM termo_busca)) AS termo_busca,
                  COUNT(*)::bigint AS total
                FROM public.buscas_guia b
                WHERE b.segmento_guia = s.segmento
                  AND (p_desde IS NULL OR b.created_at >= p_desde)
                  AND trim(both FROM termo_busca) <> ''
                GROUP BY lower(trim(both FROM termo_busca))
                ORDER BY COUNT(*) DESC
                LIMIT v_limite
              ) t
            ),
            '[]'::jsonb
          )
        )
        ORDER BY s.ordem
      ),
      '[]'::jsonb
    )
    FROM (
      SELECT *
      FROM (
        VALUES
          ('gastronomia', 1),
          ('passeios', 2),
          ('lojas', 3),
          ('hospedagem', 4),
          ('servicos_locais', 5)
      ) AS v(segmento, ordem)
    ) s
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_busca_guia_top_termos(TIMESTAMPTZ, INTEGER) TO authenticated;
