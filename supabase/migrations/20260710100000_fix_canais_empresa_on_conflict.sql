-- Corrige ON CONFLICT em canais de empresa: índice parcial exige cláusula WHERE na inferência.
-- Erro em produção: 42P10 "there is no unique or exclusion constraint matching the ON CONFLICT specification"

DROP INDEX IF EXISTS canais_unique_empresa_comunidade;
CREATE UNIQUE INDEX canais_unique_empresa_comunidade
ON public.canais (empresa_id, comunidade_prof)
WHERE empresa_id IS NOT NULL AND tipo_publico = 'empresa';

-- Trigger ao criar empresa
CREATE OR REPLACE FUNCTION public.criar_canais_empresa_comunidade ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  comunidades TEXT[] := ARRAY['Guia', 'Taxista', 'Van', 'Motorista de App', 'Anfitriao'];
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
      NEW.categoria
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
  comunidades TEXT[] := ARRAY['Guia', 'Taxista', 'Van', 'Motorista de App', 'Anfitriao'];
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

  -- Backfill legado (idempotente)
  UPDATE public.canais c
  SET comunidade_prof = v.comunidade
  FROM (
    VALUES
      ('Guia', 'guia - %'),
      ('Taxista', 'taxista - %'),
      ('Van', 'van - %'),
      ('Motorista de App', 'motorista%app - %'),
      ('Anfitriao', 'anfitri% - %')
  ) AS v(comunidade, pattern)
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
      v_empresa.categoria
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
  'Corrige canais legados, desativa lixo ADM/Financeiro/Turista e garante os 5 canais de comunidade (ON CONFLICT com índice parcial).';

GRANT EXECUTE ON FUNCTION public.garantir_canais_empresa_comunidade(UUID) TO authenticated;

-- Backfill: empresas sem os 5 canais ativos (ex.: conta nova após falha da RPC)
DO $$
DECLARE
  r RECORD;
  comunidades TEXT[] := ARRAY['Guia', 'Taxista', 'Van', 'Motorista de App', 'Anfitriao'];
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
        r.categoria
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
