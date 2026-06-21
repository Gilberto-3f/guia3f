-- Inclui `conteudo_url` em `dados_extras` ao curtir story (miniatura na aba Minha Conta / Seguindo).

CREATE OR REPLACE FUNCTION public.toggle_story_curtida (p_story_id uuid)
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
  v_uid := auth.uid ();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT
    autor_id,
    conteudo_url,
    COALESCE(curtidas, '[]'::jsonb) INTO v_autor,
    v_conteudo_url,
    v_curtidas
  FROM
    stories
  WHERE
    id = p_story_id
    AND expira_em > NOW ();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'story_not_found';
  END IF;

  IF jsonb_typeof (v_curtidas) = 'array' THEN
    v_arr := v_curtidas;
  ELSE
    v_arr := '[]'::jsonb;
  END IF;

  FOR elem IN SELECT
    *
  FROM
    jsonb_array_elements (v_arr) LOOP
      IF (elem ->> 'usuario_id') = (v_uid::text) THEN
        v_has := true;
        EXIT;
      END IF;
    END LOOP;

  IF v_has THEN
    SELECT
      COALESCE(
        (
          SELECT
            jsonb_agg (e)
          FROM
            jsonb_array_elements (v_arr) AS e
          WHERE
            (e ->> 'usuario_id') IS DISTINCT FROM v_uid::text
        ),
        '[]'::jsonb
      ) INTO v_new;

    UPDATE stories
    SET
      curtidas = v_new
    WHERE
      id = p_story_id;

    DELETE FROM atividades
    WHERE
      tipo = 'curtiu_story'
      AND autor_id = v_uid
      AND alvo_id = p_story_id
      AND usuario_id = v_autor;

    RETURN jsonb_build_object('liked', false, 'curtidas', v_new);
  END IF;

  v_new := v_arr || jsonb_build_array(
    jsonb_build_object(
      'usuario_id',
      v_uid::text,
      'created_at',
      (NOW() AT TIME ZONE 'utc')::text
    )
  );

  UPDATE stories
  SET
    curtidas = v_new
  WHERE
    id = p_story_id;

  IF v_autor IS DISTINCT FROM v_uid THEN
    INSERT INTO atividades (usuario_id, autor_id, tipo, alvo_id, alvo_tipo, dados_extras)
    VALUES (
      v_autor,
      v_uid,
      'curtiu_story',
      p_story_id,
      'story',
      jsonb_build_object(
        'story_id',
        p_story_id::text,
        'conteudo_url',
        COALESCE(v_conteudo_url, '')
      )
    );
  END IF;

  RETURN jsonb_build_object('liked', true, 'curtidas', v_new);
END;
$$;

ALTER FUNCTION public.toggle_story_curtida (uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.toggle_story_curtida (uuid) TO authenticated;
