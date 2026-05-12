-- Remove notificações/atividades quando uma curtida é desfeita.
CREATE OR REPLACE FUNCTION public.trg_limpar_atividades_apos_curtida_apagada ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.atividades
  WHERE (
    OLD.post_id IS NOT NULL
    AND tipo = 'curtiu_post'
    AND (
      coalesce(dados_extras->>'curtida_id', '') = OLD.id::text
      OR (alvo_id = OLD.post_id AND autor_id = OLD.usuario_id)
    )
  )
  OR (
    OLD.comentario_id IS NOT NULL
    AND tipo = 'curtiu_comentario'
    AND (
      coalesce(dados_extras->>'curtida_id', '') = OLD.id::text
      OR (alvo_id = OLD.comentario_id AND autor_id = OLD.usuario_id)
    )
  );

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_limpar_atividades_curtida_apagada ON public.curtidas;

CREATE TRIGGER trg_limpar_atividades_curtida_apagada
AFTER DELETE ON public.curtidas FOR EACH ROW
EXECUTE FUNCTION public.trg_limpar_atividades_apos_curtida_apagada ();
