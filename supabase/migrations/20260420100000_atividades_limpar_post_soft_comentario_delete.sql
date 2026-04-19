-- Garantir limpeza de `atividades` quando o post é soft-deleted sem passar pelo RPC
-- e quando um comentário é apagado (DELETE), removendo curtidas/comentário nas notificações.

CREATE OR REPLACE FUNCTION public.trg_limpar_atividades_apos_post_soft_delete ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    PERFORM public.limpar_interacoes_post_sem_auth (NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_limpar_atividades_post_soft_delete ON public.posts;

CREATE TRIGGER trg_limpar_atividades_post_soft_delete
AFTER UPDATE OF deleted_at ON public.posts FOR EACH ROW
EXECUTE FUNCTION public.trg_limpar_atividades_apos_post_soft_delete ();

CREATE OR REPLACE FUNCTION public.trg_limpar_atividades_apos_comentario_apagado ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.atividades
  WHERE (tipo = 'curtiu_comentario' AND alvo_id = OLD.id)
  OR (
    tipo = 'comentou'
    AND coalesce(dados_extras->>'comentario_id', '') = OLD.id::text
  );
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_limpar_atividades_comentario_apagado ON public.comentarios;

CREATE TRIGGER trg_limpar_atividades_comentario_apagado
AFTER DELETE ON public.comentarios FOR EACH ROW
EXECUTE FUNCTION public.trg_limpar_atividades_apos_comentario_apagado ();
