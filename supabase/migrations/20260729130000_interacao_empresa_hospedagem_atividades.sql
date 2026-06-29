-- Interações sociais do anfitrião em modo hospedagem aparecem como empresa nas atividades.

ALTER TABLE public.curtidas
  ADD COLUMN IF NOT EXISTS empresa_interator_id UUID REFERENCES public.empresas (id) ON DELETE SET NULL;

ALTER TABLE public.comentarios
  ADD COLUMN IF NOT EXISTS empresa_interator_id UUID REFERENCES public.empresas (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_curtidas_empresa_interator
  ON public.curtidas (empresa_interator_id)
  WHERE empresa_interator_id IS NOT NULL;

COMMENT ON COLUMN public.curtidas.empresa_interator_id IS 'Empresa (modo hospedagem) quando o anfitrião curte como negócio.';
COMMENT ON COLUMN public.comentarios.empresa_interator_id IS 'Empresa (modo hospedagem) quando o anfitrião comenta como negócio.';

CREATE OR REPLACE FUNCTION public.trg_atividade_curtida_post ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_autor_post UUID;
BEGIN
  IF NEW.post_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT autor_id INTO v_autor_post
  FROM public.posts
  WHERE id = NEW.post_id AND deleted_at IS NULL;

  IF NOT FOUND OR v_autor_post IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_autor_post = NEW.usuario_id THEN
    RETURN NEW;
  END IF;

  IF public.deve_bloquear_atividade_entre_empresas(v_autor_post, NEW.usuario_id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.atividades (usuario_id, autor_id, tipo, alvo_id, alvo_tipo, dados_extras)
  VALUES (
    v_autor_post,
    NEW.usuario_id,
    'curtiu_post',
    NEW.post_id,
    'post',
    jsonb_strip_nulls(
      jsonb_build_object(
        'post_id', NEW.post_id,
        'curtida_id', NEW.id,
        'empresa_interator_id', NEW.empresa_interator_id
      )
    )
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_atividade_curtida_comentario ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_autor_comentario UUID;
  v_post UUID;
  v_texto TEXT;
BEGIN
  IF NEW.comentario_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT autor_id, post_id, texto
  INTO v_autor_comentario, v_post, v_texto
  FROM public.comentarios
  WHERE id = NEW.comentario_id;

  IF NOT FOUND OR v_autor_comentario IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_autor_comentario = NEW.usuario_id THEN
    RETURN NEW;
  END IF;

  IF public.deve_bloquear_atividade_entre_empresas(v_autor_comentario, NEW.usuario_id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.atividades (usuario_id, autor_id, tipo, alvo_id, alvo_tipo, dados_extras)
  VALUES (
    v_autor_comentario,
    NEW.usuario_id,
    'curtiu_comentario',
    NEW.comentario_id,
    'comentario',
    jsonb_strip_nulls(
      jsonb_build_object(
        'comentario_id', NEW.comentario_id,
        'post_id', v_post,
        'texto', v_texto,
        'curtida_id', NEW.id,
        'empresa_interator_id', NEW.empresa_interator_id
      )
    )
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_atividade_comentario ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_autor_post UUID;
BEGIN
  SELECT autor_id INTO v_autor_post
  FROM public.posts
  WHERE id = NEW.post_id AND deleted_at IS NULL;

  IF NOT FOUND OR v_autor_post IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_autor_post = NEW.autor_id THEN
    RETURN NEW;
  END IF;

  IF public.deve_bloquear_atividade_entre_empresas(v_autor_post, NEW.autor_id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.atividades (usuario_id, autor_id, tipo, alvo_id, alvo_tipo, dados_extras)
  VALUES (
    v_autor_post,
    NEW.autor_id,
    'comentou',
    NEW.post_id,
    'post',
    jsonb_strip_nulls(
      jsonb_build_object(
        'post_id', NEW.post_id,
        'comentario_id', NEW.id,
        'texto', NEW.texto,
        'empresa_interator_id', NEW.empresa_interator_id
      )
    )
  );

  RETURN NEW;
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
    IF (elem ->> 'usuario_id') = (v_uid::text) THEN
      v_has := true;
      EXIT;
    END IF;
  END LOOP;

  IF v_has THEN
    SELECT COALESCE(
      (
        SELECT jsonb_agg(e)
        FROM jsonb_array_elements(v_arr) AS e
        WHERE (e ->> 'usuario_id') IS DISTINCT FROM v_uid::text
      ),
      '[]'::jsonb
    ) INTO v_new;

    UPDATE stories SET curtidas = v_new WHERE id = p_story_id;

    DELETE FROM atividades
    WHERE tipo = 'curtiu_story'
      AND autor_id = v_uid
      AND alvo_id = p_story_id
      AND usuario_id = v_autor;

    RETURN jsonb_build_object('liked', false, 'curtidas', v_new);
  END IF;

  v_new := v_arr || jsonb_build_array(
    jsonb_build_object(
      'usuario_id', v_uid::text,
      'created_at', (NOW() AT TIME ZONE 'utc')::text
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
