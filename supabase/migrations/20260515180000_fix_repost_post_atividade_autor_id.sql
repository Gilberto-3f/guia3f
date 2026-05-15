-- Repost de post: notifica o autor do post original em `atividades`.
-- Corrige erro 23502 (autor_id NULL) causado por triggers legados em produção.
--
-- Diagnóstico (rodar no SQL Editor):
--   \i supabase/scripts/diagnostico_triggers_posts.sql
-- ou copiar o conteúdo desse arquivo.

-- Remove triggers/funções legadas com nomes usados em produção (idempotente).
DROP TRIGGER IF EXISTS trigger_repost_empresa_atividade ON public.posts;

DROP TRIGGER IF EXISTS trg_repost_empresa_atividade ON public.posts;

DROP TRIGGER IF EXISTS notificar_repost_empresa ON public.posts;

DROP TRIGGER IF EXISTS trg_notificar_repost_empresa ON public.posts;

DROP TRIGGER IF EXISTS trg_atividades_repost_post ON public.posts;

DROP FUNCTION IF EXISTS public.trigger_repost_empresa_atividade ();

DROP FUNCTION IF EXISTS public.trg_repost_empresa_atividade ();

DROP FUNCTION IF EXISTS public.notificar_repost_empresa ();

DROP FUNCTION IF EXISTS public.trg_notificar_repost_empresa ();

CREATE OR REPLACE FUNCTION public.trg_atividade_repost_post ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_autor_original UUID;
BEGIN
  IF NEW.post_original_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.autor_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    p.autor_id INTO v_autor_original
  FROM
    public.posts p
  WHERE
    p.id = NEW.post_original_id
    AND p.deleted_at IS NULL;

  IF NOT FOUND OR v_autor_original IS NULL THEN
    RETURN NEW;
  END IF;

  -- Não notificar republicação do próprio conteúdo.
  IF v_autor_original = NEW.autor_id THEN
    RETURN NEW;
  END IF;

  -- usuario_id = destinatário (dono do post original); autor_id = quem repostou.
  INSERT INTO public.atividades (usuario_id, autor_id, tipo, alvo_id, alvo_tipo, dados_extras)
  VALUES (
    v_autor_original,
    NEW.autor_id,
    'repostou_post',
    NEW.id,
    'post',
    jsonb_build_object(
      'post_id',
      NEW.id,
      'post_original_id',
      NEW.post_original_id
    )
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trg_atividade_repost_post () IS 'Após INSERT de repost (post_original_id preenchido), cria atividade para o autor do post original.';

CREATE TRIGGER trg_atividades_repost_post
AFTER INSERT ON public.posts FOR EACH ROW
WHEN (NEW.post_original_id IS NOT NULL)
EXECUTE FUNCTION public.trg_atividade_repost_post ();
