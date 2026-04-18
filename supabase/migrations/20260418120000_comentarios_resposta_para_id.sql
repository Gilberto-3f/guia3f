-- Respostas aninhadas: referência ao comentário pai (mesmo post).

ALTER TABLE public.comentarios
ADD COLUMN IF NOT EXISTS resposta_para_id UUID REFERENCES public.comentarios (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_comentarios_resposta_para ON public.comentarios (resposta_para_id);

COMMENT ON COLUMN public.comentarios.resposta_para_id IS 'Comentário pai (thread); NULL = comentário no topo do post.';

-- Garante que o pai pertence ao mesmo post e não está apagado (soft delete).
CREATE OR REPLACE FUNCTION public.validar_comentario_resposta_mesmo_post ()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
BEGIN
  IF NEW.resposta_para_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT
      1
    FROM
      public.comentarios p
    WHERE
      p.id = NEW.resposta_para_id
      AND p.post_id = NEW.post_id
      AND p.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'resposta_para_id invalido ou comentario pai noutro post';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_comentarios_validar_resposta_mesmo_post ON public.comentarios;

CREATE TRIGGER trg_comentarios_validar_resposta_mesmo_post
  BEFORE INSERT OR UPDATE OF resposta_para_id,
  post_id ON public.comentarios
  FOR EACH ROW
  EXECUTE FUNCTION public.validar_comentario_resposta_mesmo_post ();
