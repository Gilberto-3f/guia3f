-- Atividade `repostou_story`: criada ao repostar; removida quando o repost expira ou é apagado.

CREATE OR REPLACE FUNCTION public.trg_atividade_repost_story ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_autor_original UUID;
  v_username_original TEXT;
BEGIN
  IF NEW.repost_story_id IS NULL OR NEW.autor_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    s.autor_id INTO v_autor_original
  FROM
    public.stories s
  WHERE
    s.id = NEW.repost_story_id;

  IF NOT FOUND OR v_autor_original IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_autor_original = NEW.autor_id THEN
    RETURN NEW;
  END IF;

  IF public.deve_bloquear_atividade_entre_empresas (v_autor_original, NEW.autor_id) THEN
    RETURN NEW;
  END IF;

  SELECT
    COALESCE(NULLIF(TRIM(p.username), ''), 'usuario') INTO v_username_original
  FROM
    public.perfis_para_busca p
  WHERE
    p.usuario_id = v_autor_original
  LIMIT
    1;

  IF v_username_original IS NULL THEN
    v_username_original := 'usuario';
  END IF;

  INSERT INTO public.atividades (usuario_id, autor_id, tipo, alvo_id, alvo_tipo, dados_extras, created_at)
  VALUES (
    v_autor_original,
    NEW.autor_id,
    'repostou_story',
    NEW.id,
    'story',
    jsonb_build_object(
      'story_id',
      NEW.id::text,
      'story_original_id',
      NEW.repost_story_id::text,
      'autor_original_id',
      v_autor_original::text,
      'story_original_author_username',
      v_username_original,
      'conteudo_url',
      NEW.conteudo_url,
      'expira_em',
      NEW.expira_em
    ),
    NOW()
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trg_atividade_repost_story () IS 'Após INSERT de repost de story, notifica o autor do story original (Minha conta) e expõe em Amigos via autor_id.';

DROP TRIGGER IF EXISTS trg_atividades_repost_story ON public.stories;

CREATE TRIGGER trg_atividades_repost_story
AFTER INSERT ON public.stories FOR EACH ROW
WHEN (NEW.repost_story_id IS NOT NULL)
EXECUTE FUNCTION public.trg_atividade_repost_story ();

CREATE OR REPLACE FUNCTION public.trg_atividade_limpar_repost_story ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.atividades
  WHERE
    tipo = 'repostou_story'
    AND (
      alvo_id = OLD.id
      OR (dados_extras ->> 'story_id') = OLD.id::text
    );

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_atividades_limpar_repost_story ON public.stories;

CREATE TRIGGER trg_atividades_limpar_repost_story
AFTER DELETE ON public.stories FOR EACH ROW
EXECUTE FUNCTION public.trg_atividade_limpar_repost_story ();

CREATE OR REPLACE FUNCTION public.limpar_atividades_repost_story_expiradas ()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.atividades a
  WHERE
    a.tipo = 'repostou_story'
    AND (
      EXISTS (
        SELECT
          1
        FROM
          public.stories s
        WHERE
          s.id = a.alvo_id
          AND s.expira_em <= NOW()
      )
      OR (
        a.dados_extras ? 'expira_em'
        AND (a.dados_extras ->> 'expira_em')::timestamptz <= NOW()
      )
      OR NOT EXISTS (
        SELECT
          1
        FROM
          public.stories s
        WHERE
          s.id = a.alvo_id
      )
    );
END;
$$;
