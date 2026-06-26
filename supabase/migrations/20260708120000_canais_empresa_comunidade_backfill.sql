-- Corrige canais legados de empresa: comunidade_prof NULL com nome "Comunidade - Empresa".

-- 1) Preencher comunidade_prof a partir do prefixo do nome
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
WHERE c.empresa_id IS NOT NULL
  AND c.tipo_publico = 'empresa'
  AND c.comunidade_prof IS NULL
  AND c.nome ILIKE v.pattern;

-- 2) Desativar canais antigos por empresa (ADM/Financeiro/Turista com empresa_id)
UPDATE public.canais
SET ativo = FALSE
WHERE empresa_id IS NOT NULL
  AND tipo_publico = 'empresa'
  AND comunidade_prof IS NULL
  AND (
    nome ILIKE 'adm - %'
    OR nome ILIKE 'financeiro - %'
    OR nome ILIKE 'turista - %'
  );

-- 3) RPC: corrige legado antes de garantir os 5 canais
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
    ON CONFLICT (empresa_id, comunidade_prof) DO UPDATE
    SET
      nome = EXCLUDED.nome,
      empresa_categoria = EXCLUDED.empresa_categoria,
      ativo = TRUE;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.garantir_canais_empresa_comunidade(UUID) IS
  'Corrige canais legados, desativa lixo ADM/Financeiro/Turista por empresa e garante os 5 canais de comunidade.';
