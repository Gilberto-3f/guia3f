-- Garante canais de comunidade para empresa existente (idempotente; dono ou ADM).

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
  'Cria/atualiza os 5 canais de comunidade da empresa (dono ou ADM).';

GRANT EXECUTE ON FUNCTION public.garantir_canais_empresa_comunidade(UUID) TO authenticated;
