-- Corrige canais de empresa para segmento Serviços Locais e empresas em degustação.
-- Erro em produção: canais_empresa_categoria_check rejeitava 'Serviços Locais'.

ALTER TABLE public.canais DROP CONSTRAINT IF EXISTS canais_empresa_categoria_check;

ALTER TABLE public.canais ADD CONSTRAINT canais_empresa_categoria_check CHECK (
  empresa_categoria IS NULL
  OR public.empresa_categoria_canal_valida(empresa_categoria) IS NOT NULL
);

COMMENT ON CONSTRAINT canais_empresa_categoria_check ON public.canais IS
  'Categoria comercial da empresa no canal (Restaurantes, Atrativos, Lojas, Hospedagem, Serviços Locais).';

-- Normalizar canais existentes com rótulo/slug legado
UPDATE public.canais c
SET empresa_categoria = public.empresa_categoria_canal_valida(c.empresa_categoria)
WHERE c.empresa_id IS NOT NULL
  AND c.tipo_publico = 'empresa'
  AND c.empresa_categoria IS NOT NULL
  AND public.empresa_categoria_canal_valida(c.empresa_categoria) IS DISTINCT FROM c.empresa_categoria;

-- Backfill: empresas reais (incl. degustação) sem os 5 canais de comunidade
DO $$
DECLARE
  r RECORD;
  comunidades TEXT[] := ARRAY['guia', 'taxista', 'van', 'motorista_app', 'anfitriao'];
  c TEXT;
  v_cat TEXT;
BEGIN
  FOR r IN
    SELECT e.id, e.nome_fantasia, e.categoria
    FROM public.empresas e
    WHERE COALESCE(e.somente_modo_apresentacao, FALSE) = FALSE
      AND NOT EXISTS (
        SELECT 1
        FROM public.canais ch
        WHERE ch.empresa_id = e.id
          AND ch.tipo_publico = 'empresa'
          AND ch.comunidade_prof = 'guia'
          AND COALESCE(ch.ativo, TRUE) = TRUE
      )
  LOOP
    v_cat := public.empresa_categoria_canal_valida(r.categoria);

    FOREACH c IN ARRAY comunidades LOOP
      INSERT INTO public.canais (
        nome,
        tipo_publico,
        categoria,
        pais,
        ordem_tipo,
        ordem_posicao,
        ativo,
        empresa_id,
        comunidade_prof,
        empresa_categoria
      )
      VALUES (
        r.nome_fantasia,
        'empresa',
        NULL,
        'geral',
        'rotativo',
        NULL,
        TRUE,
        r.id,
        c,
        v_cat
      )
      ON CONFLICT (empresa_id, comunidade_prof)
        WHERE empresa_id IS NOT NULL AND tipo_publico = 'empresa'
      DO UPDATE
      SET
        nome = EXCLUDED.nome,
        empresa_categoria = EXCLUDED.empresa_categoria,
        ativo = TRUE;
    END LOOP;
  END LOOP;
END $$;
