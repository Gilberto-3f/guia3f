-- Corrige ON CONFLICT (índice parcial) + comunidade_prof em slugs + empresa_categoria canônica.
-- Erros em produção:
--   42P10 ON CONFLICT sem WHERE no índice parcial
--   23514 canais_comunidade_prof_check (rótulos "Guia" vs slug "guia")
--   23514 canais_empresa_categoria_check (slug "gastronomia" vs "Restaurantes")

-- Normaliza empresas.categoria / slugs legados → rótulo aceito em canais.empresa_categoria
CREATE OR REPLACE FUNCTION public.empresa_categoria_canal_valida(p_categoria TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v text;
BEGIN
  IF p_categoria IS NULL OR btrim(p_categoria) = '' THEN
    RETURN NULL;
  END IF;

  IF p_categoria IN (
    'Restaurantes', 'Atrativos', 'Lojas', 'Hospedagem', 'Serviços Locais'
  ) THEN
    RETURN p_categoria;
  END IF;

  IF p_categoria = 'Servicos Locais' THEN
    RETURN 'Serviços Locais';
  END IF;

  v := lower(btrim(p_categoria));
  v := translate(
    v,
    'áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ',
    'aaaaeeiooouucAAAAEEIOOOUUC'
  );
  v := regexp_replace(v, '\s+', '_', 'g');

  IF v IN ('gastronomia', 'restaurantes', 'restaurante') THEN RETURN 'Restaurantes'; END IF;
  IF v IN ('passeios', 'atrativos', 'atracao', 'atracoes') THEN RETURN 'Atrativos'; END IF;
  IF v IN ('lojas', 'loja') THEN RETURN 'Lojas'; END IF;
  IF v IN ('hospedagem') THEN RETURN 'Hospedagem'; END IF;
  IF v IN ('servicos_locais', 'servicos_locais', 'servicos') THEN RETURN 'Serviços Locais'; END IF;

  RETURN NULL;
END;
$$;

DROP INDEX IF EXISTS canais_unique_empresa_comunidade;
CREATE UNIQUE INDEX canais_unique_empresa_comunidade
ON public.canais (empresa_id, comunidade_prof)
WHERE empresa_id IS NOT NULL AND tipo_publico = 'empresa';

-- Garantir constraint documentada (idempotente)
ALTER TABLE public.canais DROP CONSTRAINT IF EXISTS canais_comunidade_prof_check;
ALTER TABLE public.canais ADD CONSTRAINT canais_comunidade_prof_check CHECK (
  comunidade_prof IS NULL
  OR comunidade_prof IN ('guia', 'taxista', 'van', 'motorista_app', 'anfitriao')
);

-- 1) Legado: inferir slug pelo prefixo do nome
UPDATE public.canais c
SET comunidade_prof = v.slug
FROM (
  VALUES
    ('guia', 'guia - %'),
    ('taxista', 'taxista - %'),
    ('van', 'van - %'),
    ('motorista_app', 'motorista%app - %'),
    ('anfitriao', 'anfitri% - %')
) AS v(slug, pattern)
WHERE c.empresa_id IS NOT NULL
  AND c.tipo_publico = 'empresa'
  AND c.comunidade_prof IS NULL
  AND c.nome ILIKE v.pattern;

-- 2) Normalizar rótulos antigos → slug (ex.: "Guia" → guia)
UPDATE public.canais c
SET comunidade_prof = s.slug
FROM (
  SELECT
    id,
    public.slug_categoria_profissional(comunidade_prof) AS slug
  FROM public.canais
  WHERE empresa_id IS NOT NULL
    AND tipo_publico = 'empresa'
    AND comunidade_prof IS NOT NULL
) s
WHERE c.id = s.id
  AND s.slug IN ('guia', 'taxista', 'van', 'motorista_app', 'anfitriao')
  AND c.comunidade_prof IS DISTINCT FROM s.slug;

-- 3) Remover duplicatas (empresa_id + slug) mantendo o registro mais recente
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY empresa_id, comunidade_prof
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.canais
  WHERE empresa_id IS NOT NULL
    AND tipo_publico = 'empresa'
    AND comunidade_prof IS NOT NULL
)
DELETE FROM public.canais d
USING ranked r
WHERE d.id = r.id
  AND r.rn > 1;

-- 4) Normalizar empresa_categoria em canais existentes
UPDATE public.canais c
SET empresa_categoria = public.empresa_categoria_canal_valida(c.empresa_categoria)
WHERE c.empresa_id IS NOT NULL
  AND c.tipo_publico = 'empresa'
  AND c.empresa_categoria IS NOT NULL
  AND public.empresa_categoria_canal_valida(c.empresa_categoria) IS DISTINCT FROM c.empresa_categoria;

-- Trigger ao criar empresa
CREATE OR REPLACE FUNCTION public.criar_canais_empresa_comunidade ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  comunidades TEXT[] := ARRAY['guia', 'taxista', 'van', 'motorista_app', 'anfitriao'];
  c TEXT;
BEGIN
  IF COALESCE(NEW.somente_modo_apresentacao, FALSE) THEN
    RETURN NEW;
  END IF;

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
      NEW.nome_fantasia,
      'empresa',
      NULL,
      'geral',
      'rotativo',
      NULL,
      TRUE,
      NEW.id,
      c,
      public.empresa_categoria_canal_valida(NEW.categoria)
    )
    ON CONFLICT (empresa_id, comunidade_prof)
      WHERE empresa_id IS NOT NULL AND tipo_publico = 'empresa'
    DO UPDATE
    SET
      nome = EXCLUDED.nome,
      empresa_categoria = EXCLUDED.empresa_categoria,
      ativo = TRUE;
  END LOOP;

  RETURN NEW;
END;
$$;

-- RPC chamada pelo app ao abrir canais da empresa
CREATE OR REPLACE FUNCTION public.garantir_canais_empresa_comunidade(p_empresa_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa RECORD;
  comunidades TEXT[] := ARRAY['guia', 'taxista', 'van', 'motorista_app', 'anfitriao'];
  c TEXT;
BEGIN
  SELECT id, nome_fantasia, categoria, usuario_id, COALESCE(somente_modo_apresentacao, FALSE) AS preview
  INTO v_empresa
  FROM public.empresas
  WHERE id = p_empresa_id;

  IF v_empresa.id IS NULL THEN
    RAISE EXCEPTION 'Empresa não encontrada';
  END IF;

  IF v_empresa.preview THEN
    RETURN;
  END IF;

  IF NOT (
    EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.role = 'admin')
    OR v_empresa.usuario_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Sem permissão para garantir canais desta empresa';
  END IF;

  UPDATE public.canais c
  SET comunidade_prof = v.slug
  FROM (
    VALUES
      ('guia', 'guia - %'),
      ('taxista', 'taxista - %'),
      ('van', 'van - %'),
      ('motorista_app', 'motorista%app - %'),
      ('anfitriao', 'anfitri% - %')
  ) AS v(slug, pattern)
  WHERE c.empresa_id = p_empresa_id
    AND c.tipo_publico = 'empresa'
    AND c.comunidade_prof IS NULL
    AND c.nome ILIKE v.pattern;

  UPDATE public.canais
  SET ativo = FALSE
  WHERE empresa_id = p_empresa_id
    AND tipo_publico = 'empresa'
    AND comunidade_prof IS NULL
    AND (
      nome ILIKE 'adm - %'
      OR nome ILIKE 'financeiro - %'
      OR nome ILIKE 'turista - %'
    );

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
      v_empresa.nome_fantasia,
      'empresa',
      NULL,
      'geral',
      'rotativo',
      NULL,
      TRUE,
      v_empresa.id,
      c,
      public.empresa_categoria_canal_valida(v_empresa.categoria)
    )
    ON CONFLICT (empresa_id, comunidade_prof)
      WHERE empresa_id IS NOT NULL AND tipo_publico = 'empresa'
    DO UPDATE
    SET
      nome = EXCLUDED.nome,
      empresa_categoria = EXCLUDED.empresa_categoria,
      ativo = TRUE;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.garantir_canais_empresa_comunidade(UUID) IS
  'Corrige canais legados, desativa lixo ADM/Financeiro/Turista e garante os 5 canais de comunidade (slugs + ON CONFLICT parcial).';

GRANT EXECUTE ON FUNCTION public.garantir_canais_empresa_comunidade(UUID) TO authenticated;

-- Backfill: garantir 5 canais por empresa
DO $$
DECLARE
  r RECORD;
  comunidades TEXT[] := ARRAY['guia', 'taxista', 'van', 'motorista_app', 'anfitriao'];
  c TEXT;
BEGIN
  FOR r IN
    SELECT e.id, e.nome_fantasia, e.categoria
    FROM public.empresas e
    WHERE COALESCE(e.somente_modo_apresentacao, FALSE) = FALSE
  LOOP
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
        public.empresa_categoria_canal_valida(r.categoria)
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
