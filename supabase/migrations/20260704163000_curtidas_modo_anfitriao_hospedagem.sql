-- Curtidas separadas por modo: anfitrião (empresa_interator_id NULL) vs hospedagem (empresa vinculada).

DROP INDEX IF EXISTS public.idx_curtidas_post_usuario;
DROP INDEX IF EXISTS public.idx_curtidas_com_usuario;

DROP FUNCTION IF EXISTS public.limpar_atividades_apos_descurtir(UUID, UUID, UUID);

CREATE UNIQUE INDEX IF NOT EXISTS idx_curtidas_post_usuario_anfitriao
  ON public.curtidas (usuario_id, post_id)
  WHERE post_id IS NOT NULL AND empresa_interator_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_curtidas_post_usuario_empresa
  ON public.curtidas (usuario_id, post_id, empresa_interator_id)
  WHERE post_id IS NOT NULL AND empresa_interator_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_curtidas_com_usuario_anfitriao
  ON public.curtidas (usuario_id, comentario_id)
  WHERE comentario_id IS NOT NULL AND empresa_interator_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_curtidas_com_usuario_empresa
  ON public.curtidas (usuario_id, comentario_id, empresa_interator_id)
  WHERE comentario_id IS NOT NULL AND empresa_interator_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.limpar_atividades_apos_descurtir (
  p_post_id UUID DEFAULT NULL,
  p_comentario_id UUID DEFAULT NULL,
  p_usuario_id UUID DEFAULT NULL,
  p_curtida_id UUID DEFAULT NULL,
  p_empresa_interator_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n INTEGER := 0;
BEGIN
  IF p_usuario_id IS NULL THEN
    RETURN 0;
  END IF;

  IF p_post_id IS NOT NULL THEN
    DELETE FROM public.atividades
    WHERE
      tipo = 'curtiu_post'
      AND autor_id = p_usuario_id
      AND alvo_id = p_post_id
      AND (
        (p_curtida_id IS NOT NULL AND coalesce(dados_extras->>'curtida_id', '') = p_curtida_id::text)
        OR (
          p_curtida_id IS NULL
          AND (
            (p_empresa_interator_id IS NULL AND (dados_extras->>'empresa_interator_id') IS NULL)
            OR (
              p_empresa_interator_id IS NOT NULL
              AND (dados_extras->>'empresa_interator_id') = p_empresa_interator_id::text
            )
          )
        )
      );
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RETURN v_n;
  END IF;

  IF p_comentario_id IS NOT NULL THEN
    DELETE FROM public.atividades
    WHERE
      tipo = 'curtiu_comentario'
      AND autor_id = p_usuario_id
      AND alvo_id = p_comentario_id
      AND (
        (p_curtida_id IS NOT NULL AND coalesce(dados_extras->>'curtida_id', '') = p_curtida_id::text)
        OR (
          p_curtida_id IS NULL
          AND (
            (p_empresa_interator_id IS NULL AND (dados_extras->>'empresa_interator_id') IS NULL)
            OR (
              p_empresa_interator_id IS NOT NULL
              AND (dados_extras->>'empresa_interator_id') = p_empresa_interator_id::text
            )
          )
        )
      );
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RETURN v_n;
  END IF;

  RETURN 0;
END;
$$;

COMMENT ON FUNCTION public.limpar_atividades_apos_descurtir IS
'Remove atividades do modo descurtido (anfitrião ou hospedagem), sem apagar a interação do outro modo.';

GRANT EXECUTE ON FUNCTION public.limpar_atividades_apos_descurtir (UUID, UUID, UUID, UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.trg_limpar_atividades_apos_curtida_apagada ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.post_id IS NOT NULL AND OLD.usuario_id IS NOT NULL THEN
    PERFORM public.limpar_atividades_apos_descurtir(
      OLD.post_id,
      NULL,
      OLD.usuario_id,
      OLD.id,
      OLD.empresa_interator_id
    );
  END IF;

  IF OLD.comentario_id IS NOT NULL AND OLD.usuario_id IS NOT NULL THEN
    PERFORM public.limpar_atividades_apos_descurtir(
      NULL,
      OLD.comentario_id,
      OLD.usuario_id,
      OLD.id,
      OLD.empresa_interator_id
    );
  END IF;

  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_story_curtida (
  p_story_id uuid,
  p_empresa_interator_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_autor uuid;
  v_conteudo_url text;
  v_curtidas jsonb;
  v_uid uuid;
  v_arr jsonb := '[]'::jsonb;
  v_new jsonb;
  v_has boolean := false;
  elem jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT autor_id, conteudo_url, COALESCE(curtidas, '[]'::jsonb)
  INTO v_autor, v_conteudo_url, v_curtidas
  FROM stories
  WHERE id = p_story_id AND expira_em > NOW();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'story_not_found';
  END IF;

  IF jsonb_typeof(v_curtidas) = 'array' THEN
    v_arr := v_curtidas;
  ELSE
    v_arr := '[]'::jsonb;
  END IF;

  FOR elem IN SELECT * FROM jsonb_array_elements(v_arr) LOOP
    IF (elem ->> 'usuario_id') = v_uid::text THEN
      IF (
        (p_empresa_interator_id IS NULL AND (elem ->> 'empresa_interator_id') IS NULL)
        OR (
          p_empresa_interator_id IS NOT NULL
          AND (elem ->> 'empresa_interator_id') = p_empresa_interator_id::text
        )
      ) THEN
        v_has := true;
        EXIT;
      END IF;
    END IF;
  END LOOP;

  IF v_has THEN
    SELECT COALESCE(
      (
        SELECT jsonb_agg(e)
        FROM jsonb_array_elements(v_arr) AS e
        WHERE NOT (
          (e ->> 'usuario_id') = v_uid::text
          AND (
            (p_empresa_interator_id IS NULL AND (e ->> 'empresa_interator_id') IS NULL)
            OR (
              p_empresa_interator_id IS NOT NULL
              AND (e ->> 'empresa_interator_id') = p_empresa_interator_id::text
            )
          )
        )
      ),
      '[]'::jsonb
    ) INTO v_new;

    UPDATE stories SET curtidas = v_new WHERE id = p_story_id;

    DELETE FROM atividades
    WHERE tipo = 'curtiu_story'
      AND autor_id = v_uid
      AND alvo_id = p_story_id
      AND usuario_id = v_autor
      AND (
        (p_empresa_interator_id IS NULL AND (dados_extras->>'empresa_interator_id') IS NULL)
        OR (
          p_empresa_interator_id IS NOT NULL
          AND (dados_extras->>'empresa_interator_id') = p_empresa_interator_id::text
        )
      );

    RETURN jsonb_build_object('liked', false, 'curtidas', v_new);
  END IF;

  v_new := v_arr || jsonb_strip_nulls(
    jsonb_build_object(
      'usuario_id', v_uid::text,
      'created_at', (NOW() AT TIME ZONE 'utc')::text,
      'empresa_interator_id', p_empresa_interator_id
    )
  );

  UPDATE stories SET curtidas = v_new WHERE id = p_story_id;

  IF v_autor IS DISTINCT FROM v_uid THEN
    INSERT INTO atividades (usuario_id, autor_id, tipo, alvo_id, alvo_tipo, dados_extras)
    VALUES (
      v_autor,
      v_uid,
      'curtiu_story',
      p_story_id,
      'story',
      jsonb_strip_nulls(
        jsonb_build_object(
          'story_id', p_story_id::text,
          'conteudo_url', COALESCE(v_conteudo_url, ''),
          'empresa_interator_id', p_empresa_interator_id
        )
      )
    );
  END IF;

  RETURN jsonb_build_object('liked', true, 'curtidas', v_new);
END;
$$;
