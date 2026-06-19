-- Remove notificação de seguir quando a relação em redecontatos é desfeita.
CREATE OR REPLACE FUNCTION public.trg_limpar_atividades_apos_deixar_seguir ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.atividades
  WHERE
    tipo = 'seguiu'
    AND autor_id = OLD.seguidor_id
    AND usuario_id = OLD.seguido_id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_limpar_atividades_deixar_seguir ON public.redecontatos;

CREATE TRIGGER trg_limpar_atividades_deixar_seguir
AFTER DELETE ON public.redecontatos FOR EACH ROW
EXECUTE FUNCTION public.trg_limpar_atividades_apos_deixar_seguir ();

COMMENT ON FUNCTION public.trg_limpar_atividades_apos_deixar_seguir () IS 'Elimina atividade seguiu quando o seguidor deixa de seguir o perfil.';

-- Remove notificação de seguir empresa quando o favorito é desfeito.
CREATE OR REPLACE FUNCTION public.trg_limpar_atividades_apos_desfavoritar_empresa ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(OLD.alvo_tipo, '') = 'empresa' THEN
    DELETE FROM public.atividades
    WHERE
      tipo = 'seguiu_empresa'
      AND autor_id = OLD.usuario_id
      AND alvo_id = OLD.alvo_id;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_limpar_atividades_desfavoritar_empresa ON public.favoritos;

CREATE TRIGGER trg_limpar_atividades_desfavoritar_empresa
AFTER DELETE ON public.favoritos FOR EACH ROW
EXECUTE FUNCTION public.trg_limpar_atividades_apos_desfavoritar_empresa ();

COMMENT ON FUNCTION public.trg_limpar_atividades_apos_desfavoritar_empresa () IS 'Elimina atividade seguiu_empresa quando o usuário deixa de seguir a empresa.';
